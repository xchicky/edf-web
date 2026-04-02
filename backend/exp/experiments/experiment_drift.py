"""
漂移信号实验模块

测试分析工具对各种漂移信号的鲁棒性，包括：
- 线性漂移 (b*x 模式)
- 正弦漂移 (a*sin(x) 模式)
- 组合漂移 (a*sin(x) + b*x 模式)
- 指数漂移
- 多项式漂移

特别关注用户请求的 a*sin(x) + b*x 漂移模式。
"""

import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from typing import Dict, Any, List, Tuple
import json
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.analysis_service import AnalysisService
from app.services.preprocessing import SignalPreprocessor, PreprocessMethod
from exp.fixtures.synthetic_signals import SyntheticSignalGenerator
from exp.fixtures.drift_signals import DriftGenerator, DRIFT_TEST_CASES
from exp.utils.visualization import plot_comparison
from exp.utils.metrics import calculate_snr, calculate_sar, mse
from exp.utils.analysis_validator import AnalysisValidator


class DriftExperiments:
    """漂移信号实验类"""

    def __init__(self, sfreq: float = 500.0, report_dir: str = None):
        """
        初始化漂移实验

        Args:
            sfreq: 采样率
            report_dir: 报告保存目录
        """
        self.sfreq = sfreq
        self.report_dir = Path(report_dir) if report_dir else Path(__file__).parent.parent / "reports" / "drift"
        self.report_dir.mkdir(parents=True, exist_ok=True)

        # 初始化生成器
        self.sig_gen = SyntheticSignalGenerator(sfreq)
        self.drift_gen = DriftGenerator(sfreq)

        # 初始化验证器
        self.validator = AnalysisValidator()

        # 创建图像目录
        self.images_dir = self.report_dir / "images"
        self.images_dir.mkdir(exist_ok=True)

    def run_linear_drift_experiment(
        self,
        slopes: List[float] = None,
        base_frequencies: List[float] = None
    ) -> Dict[str, Any]:
        """
        线性漂移实验

        测试公式: signal + b*x
        其中 b 是斜率 (µV/s)，x 是时间

        Args:
            slopes: 斜率列表 (µV/s)
            base_frequencies: 基础信号频率列表 (Hz)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 1: 线性漂移 (Linear Drift: signal + b*x)")
        print("=" * 60)

        slopes = slopes or [1.0, 5.0, 10.0, 20.0, 50.0, 100.0]
        base_frequencies = base_frequencies or [2.0, 10.0, 20.0]  # Delta, Alpha, Beta

        results = []
        summary = {
            "experiment": "linear_drift",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"slopes": slopes, "base_frequencies": base_frequencies},
            "results": []
        }

        duration = 2.0
        t = np.arange(0, duration, 1 / self.sfreq)

        for base_freq in base_frequencies:
            # 生成基础信号
            clean_signal = self.sig_gen.generate_sine_wave(freq=base_freq, duration=duration)[1]

            for slope in slopes:
                # 添加线性漂移: signal + b*x
                drifted_signal = self.drift_gen.add_linear_drift(
                    clean_signal.copy(),
                    slope=slope
                )

                # 计算指标
                snr = calculate_snr(drifted_signal, self.sfreq)
                drift_magnitude = abs(slope * duration)  # 总漂移幅度

                # 计算频带功率
                clean_bands = self._calculate_band_power(clean_signal)
                drifted_bands = self._calculate_band_power(drifted_signal)

                # 识别主频带
                expected_band = self._classify_frequency(base_freq)
                actual_band = self._get_dominant_band(drifted_bands)

                # 计算误差
                band_error = abs(clean_bands[expected_band]["relative"] - drifted_bands[expected_band]["relative"])

                result = {
                    "base_frequency": base_freq,
                    "expected_band": expected_band,
                    "actual_band": actual_band,
                    "slope": slope,
                    "drift_magnitude": drift_magnitude,
                    "snr": snr,
                    "clean_band_power": clean_bands[expected_band]["relative"],
                    "drifted_band_power": drifted_bands[expected_band]["relative"],
                    "band_error": band_error,
                    "passed": band_error < 30 and actual_band == expected_band
                }
                results.append(result)

                # 打印结果
                intensity = "极强" if slope >= 50 else "强" if slope >= 20 else "中等" if slope >= 10 else "弱"
                status = "✓" if result["passed"] else "✗"
                print(f"{status} {base_freq}Hz | b={slope}µV/s({intensity}) | "
                      f"漂移={drift_magnitude:.1f}µV | SNR={snr:.1f}dB | "
                      f"{expected_band}误差={band_error:.1f}%")

                # 保存可视化 (关键案例)
                if len(results) <= 9:
                    self._save_linear_drift_plot(
                        t, clean_signal, drifted_signal,
                        base_freq, slope, snr, band_error
                    )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "linear_drift.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_sinusoidal_drift_experiment(
        self,
        amplitudes: List[float] = None,
        freqs: List[float] = None,
        base_frequencies: List[float] = None
    ) -> Dict[str, Any]:
        """
        正弦漂移实验

        测试公式: signal + a*sin(2*pi*f*t)

        Args:
            amplitudes: 正弦漂移幅度列表 (µV)
            freqs: 正弦漂移频率列表 (Hz)
            base_frequencies: 基础信号频率列表 (Hz)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 2: 正弦漂移 (Sinusoidal Drift: signal + a*sin(2*pi*f*t))")
        print("=" * 60)

        amplitudes = amplitudes or [10, 20, 50, 100]
        freqs = freqs or [0.05, 0.1, 0.2, 0.5]
        base_frequencies = base_frequencies or [10.0]

        results = []
        summary = {
            "experiment": "sinusoidal_drift",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "amplitudes": amplitudes,
                "freqs": freqs,
                "base_frequencies": base_frequencies
            },
            "results": []
        }

        duration = 2.0
        t = np.arange(0, duration, 1 / self.sfreq)

        for base_freq in base_frequencies:
            clean_signal = self.sig_gen.generate_sine_wave(freq=base_freq, duration=duration)[1]

            for amp in amplitudes:
                for freq in freqs:
                    # 添加正弦漂移
                    drifted_signal = self.drift_gen.add_sinusoidal_drift(
                        clean_signal.copy(),
                        amplitude=amp,
                        freq=freq
                    )

                    # 计算指标
                    snr = calculate_snr(drifted_signal, self.sfreq)

                    # 计算频带功率
                    clean_bands = self._calculate_band_power(clean_signal)
                    drifted_bands = self._calculate_band_power(drifted_signal)

                    expected_band = self._classify_frequency(base_freq)
                    band_error = abs(clean_bands[expected_band]["relative"] - drifted_bands[expected_band]["relative"])

                    result = {
                        "base_frequency": base_freq,
                        "expected_band": expected_band,
                        "drift_amplitude": amp,
                        "drift_frequency": freq,
                        "snr": snr,
                        "clean_band_power": clean_bands[expected_band]["relative"],
                        "drifted_band_power": drifted_bands[expected_band]["relative"],
                        "band_error": band_error,
                        "passed": band_error < 25
                    }
                    results.append(result)

                    # 打印结果
                    speed = "快" if freq >= 0.2 else "中" if freq >= 0.1 else "慢"
                    status = "✓" if result["passed"] else "✗"
                    print(f"{status} a={amp}µV@{freq}Hz({speed}) | "
                          f"SNR={snr:.1f}dB | {expected_band}误差={band_error:.1f}%")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "sinusoidal_drift.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_combined_drift_experiment(
        self,
        a_values: List[float] = None,
        b_values: List[float] = None,
        sine_freq: float = 0.1,
        base_frequency: float = 10.0
    ) -> Dict[str, Any]:
        """
        组合漂移实验 (a*sin(x) + b*x)

        特别关注用户请求的模式: signal + a*sin(2*pi*f*t) + b*x

        Args:
            a_values: 正弦分量幅度列表 (µV)
            b_values: 线性分量斜率列表 (µV/s)
            sine_freq: 正弦漂移频率 (Hz)
            base_frequency: 基础信号频率 (Hz)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 70)
        print("实验 3: 组合漂移 (Combined: signal + a*sin(x) + b*x)")
        print("=" * 70)

        a_values = a_values or [5, 10, 20, 50, 100]
        b_values = b_values or [1, 5, 10, 20, 50]

        results = []
        summary = {
            "experiment": "combined_drift",
            "timestamp": datetime.now().isoformat(),
            "formula": "signal + a*sin(2*pi*f*t) + b*x",
            "parameters": {
                "a_values": a_values,  # 正弦幅度
                "b_values": b_values,  # 线性斜率
                "sine_freq": sine_freq,
                "base_frequency": base_frequency
            },
            "results": []
        }

        duration = 2.0
        t = np.arange(0, duration, 1 / self.sfreq)

        # 生成基础信号 (10Hz Alpha)
        clean_signal = self.sig_gen.generate_sine_wave(freq=base_frequency, duration=duration)[1]

        for a in a_values:
            for b in b_values:
                # 添加组合漂移: a*sin(x) + b*x
                # 首先添加线性漂移
                drifted_signal = self.drift_gen.add_linear_drift(
                    clean_signal.copy(),
                    slope=b
                )
                # 然后添加正弦漂移
                drifted_signal = self.drift_gen.add_sinusoidal_drift(
                    drifted_signal,
                    amplitude=a,
                    freq=sine_freq
                )

                # 计算指标
                snr = calculate_snr(drifted_signal, self.sfreq)

                # 计算漂移幅度
                linear_drift = abs(b * duration)
                sine_drift = a * 2  # 峰峰值
                total_drift_range = linear_drift + sine_drift

                # 计算频带功率
                clean_bands = self._calculate_band_power(clean_signal)
                drifted_bands = self._calculate_band_power(drifted_signal)

                expected_band = self._classify_frequency(base_frequency)
                band_error = abs(clean_bands[expected_band]["relative"] - drifted_bands[expected_band]["relative"])

                result = {
                    "a": a,  # 正弦幅度
                    "b": b,  # 线性斜率
                    "linear_drift": linear_drift,
                    "sine_drift": sine_drift,
                    "total_drift_range": total_drift_range,
                    "snr": snr,
                    "clean_alpha": clean_bands["alpha"]["relative"],
                    "drifted_alpha": drifted_bands["alpha"]["relative"],
                    "alpha_error": band_error,
                    "passed": band_error < 30
                }
                results.append(result)

                # 打印结果
                a_desc = f"a={a}µV" if a < 20 else f"a={a}µV(中)" if a < 50 else f"a={a}µV(强)"
                b_desc = f"b={b}µV/s" if b < 10 else f"b={b}µV/s(中)" if b < 20 else f"b={b}µV/s(强)"
                status = "✓" if result["passed"] else "✗"
                print(f"{status} {a_desc}, {b_desc} | 总漂移={total_drift_range:.1f}µV | "
                      f"SNR={snr:.1f}dB | Alpha误差={band_error:.1f}%")

                # 保存可视化 (关键组合)
                if (a == 10 or a == 50) and (b == 5 or b == 20):
                    self._save_combined_drift_plot(
                        t, clean_signal, drifted_signal,
                        a, b, sine_freq, snr, band_error
                    )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "combined_drift.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 70)

        return summary

    def run_exponential_drift_experiment(
        self,
        amplitudes: List[float] = None,
        rates: List[float] = None
    ) -> Dict[str, Any]:
        """
        指数漂移实验

        测试指数增长/衰减漂移

        Args:
            amplitudes: 漂移幅度列表 (µV)
            rates: 增长率列表 (1/s)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 4: 指数漂移 (Exponential Drift)")
        print("=" * 60)

        amplitudes = amplitudes or [20, 50, 100, 200]
        rates = rates or [0.2, 0.5, 0.8, 1.0]

        results = []
        summary = {
            "experiment": "exponential_drift",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"amplitudes": amplitudes, "rates": rates},
            "results": []
        }

        duration = 2.0
        t = np.arange(0, duration, 1 / self.sfreq)
        clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)[1]

        for amp in amplitudes:
            for rate in rates:
                # 添加指数漂移
                drifted_signal = self.drift_gen.add_exponential_drift(
                    clean_signal.copy(),
                    amplitude=amp,
                    rate=rate
                )

                # 计算指标
                snr = calculate_snr(drifted_signal, self.sfreq)

                # 计算频带功率
                clean_bands = self._calculate_band_power(clean_signal)
                drifted_bands = self._calculate_band_power(drifted_signal)

                alpha_error = abs(clean_bands["alpha"]["relative"] - drifted_bands["alpha"]["relative"])

                result = {
                    "amplitude": amp,
                    "rate": rate,
                    "snr": snr,
                    "clean_alpha": clean_bands["alpha"]["relative"],
                    "drifted_alpha": drifted_bands["alpha"]["relative"],
                    "alpha_error": alpha_error,
                    "passed": alpha_error < 35  # 指数漂移影响较大
                }
                results.append(result)

                # 打印结果
                growth = "快" if rate >= 0.8 else "中" if rate >= 0.5 else "慢"
                status = "✓" if result["passed"] else "✗"
                print(f"{status} {amp}µV@{rate}/s({growth}) | SNR={snr:.1f}dB | Alpha误差={alpha_error:.1f}%")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "exponential_drift.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_polynomial_drift_experiment(
        self,
        coefficients_list: List[Tuple[float, ...]] = None
    ) -> Dict[str, Any]:
        """
        多项式漂移实验

        测试二次、三次等高阶多项式漂移

        Args:
            coefficients_list: 多项式系数列表

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 5: 多项式漂移 (Polynomial Drift)")
        print("=" * 60)

        coefficients_list = coefficients_list or [
            (0.1, 0.5),      # 二次: 0.1*t + 0.5*t^2
            (0.2, 1.0),      # 二次强
            (0.1, 0.2, 0.1),  # 三次
            (0.05, 0.3, 0.2), # 三次强
        ]

        results = []
        summary = {
            "experiment": "polynomial_drift",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"coefficients_list": [str(c) for c in coefficients_list]},
            "results": []
        }

        duration = 2.0
        t = np.arange(0, duration, 1 / self.sfreq)
        clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)[1]

        for coeffs in coefficients_list:
            # 添加多项式漂移
            drifted_signal = self.drift_gen.add_polynomial_drift(
                clean_signal.copy(),
                coefficients=coeffs
            )

            # 计算指标
            snr = calculate_snr(drifted_signal, self.sfreq)

            # 计算频带功率
            clean_bands = self._calculate_band_power(clean_signal)
            drifted_bands = self._calculate_band_power(drifted_signal)

            alpha_error = abs(clean_bands["alpha"]["relative"] - drifted_bands["alpha"]["relative"])

            result = {
                "coefficients": coeffs,
                "order": len(coeffs),
                "snr": snr,
                "clean_alpha": clean_bands["alpha"]["relative"],
                "drifted_alpha": drifted_bands["alpha"]["relative"],
                "alpha_error": alpha_error,
                "passed": alpha_error < 30
            }
            results.append(result)

            # 打印结果
            order_desc = f"{len(coeffs)}次"
            status = "✓" if result["passed"] else "✗"
            coeffs_str = "+".join([f"{c:.1f}t^{i}" for i, c in enumerate(coeffs, 1)])
            print(f"{status} {order_desc}多项式: {coeffs_str} | SNR={snr:.1f}dB | Alpha误差={alpha_error:.1f}%")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "polynomial_drift.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_detrending_experiment(self) -> Dict[str, Any]:
        """
        去漂移效果实验

        测试各种去漂移算法对组合漂移的恢复效果

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 70)
        print("实验 6: 去漂移算法效果 (Detrending Algorithms)")
        print("=" * 70)

        # 使用预处理服务
        preprocessor = SignalPreprocessor(self.sfreq)

        # 测试案例：强组合漂移
        duration = 2.0
        t = np.arange(0, duration, 1 / self.sfreq)
        clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)[1]

        # 创建强漂移信号
        a, b = 50.0, 20.0  # 正弦50µV + 线性20µV/s
        drifted_signal = self.drift_gen.add_linear_drift(clean_signal.copy(), slope=b)
        drifted_signal = self.drift_gen.add_sinusoidal_drift(drifted_signal, amplitude=a, freq=0.1)

        # 计算原始指标
        clean_bands = self._calculate_band_power(clean_signal)
        drifted_bands = self._calculate_band_power(drifted_signal)
        original_error = abs(clean_bands["alpha"]["relative"] - drifted_bands["alpha"]["relative"])

        results = []
        summary = {
            "experiment": "detrending",
            "timestamp": datetime.now().isoformat(),
            "test_case": {"a": a, "b": b, "sine_freq": 0.1},
            "results": []
        }

        # 测试各种去漂移方法
        detrend_methods = [
            ("none", "无处理"),
            ("linear_detrend", "线性去漂移"),
            ("polynomial_detrend", "多项式去漂移"),
            ("highpass_filter", "高通滤波"),
            ("baseline_correction", "基线校正")
        ]

        print(f"\n原始漂移: Alpha误差={original_error:.1f}%")
        print("\n去漂移方法对比:")

        for method_name, method_desc in detrend_methods:
            # 应用去漂移
            if method_name == "none":
                detrended_signal = drifted_signal.copy()
            elif method_name == "linear_detrend":
                detrended_signal = preprocessor.linear_detrend(drifted_signal.copy())
            elif method_name == "polynomial_detrend":
                detrended_signal = preprocessor.polynomial_detrend(drifted_signal.copy(), order=2)
            elif method_name == "highpass_filter":
                detrended_signal = preprocessor.highpass_filter(drifted_signal.copy(), cutoff=0.5)
            elif method_name == "baseline_correction":
                detrended_signal = preprocessor.baseline_correction(drifted_signal.copy())

            # 计算恢复后的频带功率
            detrended_bands = self._calculate_band_power(detrended_signal)
            recovered_error = abs(clean_bands["alpha"]["relative"] - detrended_bands["alpha"]["relative"])

            # 计算与原始信号的相关性
            correlation = np.corrcoef(clean_signal, detrended_signal)[0, 1]

            # 计算MSE
            error_mse = mse(clean_signal, detrended_signal)

            result = {
                "method": method_name,
                "method_desc": method_desc,
                "original_error": original_error,
                "recovered_error": recovered_error,
                "improvement": original_error - recovered_error,
                "correlation": correlation,
                "mse": error_mse,
                "passed": recovered_error < 15 and correlation > 0.9
            }
            results.append(result)

            # 打印结果
            status = "✓" if result["passed"] else "✗"
            improvement = result["improvement"]
            print(f"{status} {method_desc:20s}: 误差={recovered_error:.1f}% → "
                  f"改善={improvement:+.1f}% | 相关性={correlation:.3f}")

            # 保存可视化
            self._save_detrending_comparison_plot(
                t, clean_signal, drifted_signal, detrended_signal,
                method_name, correlation, recovered_error
            )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)
        summary["best_method"] = max(results, key=lambda x: x["correlation"])["method"]

        # 保存结果
        self._save_experiment_results(summary, "detrending.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print(f"最佳方法: {summary['best_method']}")
        print("=" * 70)

        return summary

    def run_full_suite(self) -> Dict[str, Any]:
        """
        运行完整的漂移实验套件

        Returns:
            所有实验的汇总结果
        """
        print("\n" + "=" * 80)
        print(" " * 25 + "漂移信号实验套件 (完整运行)")
        print("=" * 80)

        all_results = {}

        # 运行各项实验
        try:
            all_results["linear_drift"] = self.run_linear_drift_experiment()
        except Exception as e:
            print(f"线性漂移实验失败: {e}")
            all_results["linear_drift"] = {"error": str(e)}

        try:
            all_results["sinusoidal_drift"] = self.run_sinusoidal_drift_experiment()
        except Exception as e:
            print(f"正弦漂移实验失败: {e}")
            all_results["sinusoidal_drift"] = {"error": str(e)}

        try:
            all_results["combined_drift"] = self.run_combined_drift_experiment()
        except Exception as e:
            print(f"组合漂移实验失败: {e}")
            all_results["combined_drift"] = {"error": str(e)}

        try:
            all_results["exponential_drift"] = self.run_exponential_drift_experiment()
        except Exception as e:
            print(f"指数漂移实验失败: {e}")
            all_results["exponential_drift"] = {"error": str(e)}

        try:
            all_results["polynomial_drift"] = self.run_polynomial_drift_experiment()
        except Exception as e:
            print(f"多项式漂移实验失败: {e}")
            all_results["polynomial_drift"] = {"error": str(e)}

        try:
            all_results["detrending"] = self.run_detrending_experiment()
        except Exception as e:
            print(f"去漂移实验失败: {e}")
            all_results["detrending"] = {"error": str(e)}

        # 生成汇总报告
        self._generate_summary_report(all_results)

        return all_results

    def _calculate_band_power(self, signal: np.ndarray) -> Dict[str, Dict[str, float]]:
        """计算频带功率"""
        from mne.time_frequency import psd_array_welch

        n_samples = len(signal)
        target_resolution = 0.5
        min_n_fft = int(self.sfreq / target_resolution)
        power_of_two = 2 ** int(np.log2(n_samples))
        n_fft = max(power_of_two, min_n_fft)
        if n_fft > n_samples:
            n_fft = 2 ** int(np.log2(n_fft)) if n_fft == 2 ** int(np.log2(n_fft)) else 2 ** (int(np.log2(n_fft)) + 1)
        n_fft = max(n_fft, 8)
        n_per_seg = min(n_samples, n_fft)
        n_overlap = n_fft // 2

        psds, freqs = psd_array_welch(
            signal,
            sfreq=self.sfreq,
            fmin=0.5,
            fmax=50,
            n_fft=n_fft,
            n_per_seg=n_per_seg,
            n_overlap=n_overlap,
            verbose=False
        )

        if psds.ndim == 1:
            psds = psds.reshape(1, -1)
        psd_mean = psds.mean(axis=0)

        # 计算各频带功率
        bands = {}
        total_power = 0

        for band_name, (fmin_band, fmax_band) in self.validator.FREQUENCY_BANDS.items():
            freq_mask = (freqs >= fmin_band) & (freqs < fmax_band)
            band_psds = psd_mean[freq_mask]
            absolute_power = float(np.trapezoid(band_psds, freqs[freq_mask]))
            total_power += absolute_power
            bands[band_name] = {
                "absolute": absolute_power,
                "range": [fmin_band, fmax_band]
            }

        # 计算相对功率
        for band_name in bands:
            if total_power > 0:
                bands[band_name]["relative"] = bands[band_name]["absolute"] / total_power * 100
            else:
                bands[band_name]["relative"] = 0.0

        return bands

    def _classify_frequency(self, freq: float) -> str:
        """根据频率分类到 EEG 频带"""
        for band, (fmin, fmax) in self.validator.FREQUENCY_BANDS.items():
            if fmin <= freq < fmax:
                return band
        return "unknown"

    def _get_dominant_band(self, bands: Dict[str, Dict[str, float]]) -> str:
        """获取主导频带"""
        return max(bands.items(), key=lambda x: x[1]["relative"])[0]

    def _save_linear_drift_plot(self, t, clean, drifted, base_freq, slope, snr, error):
        """保存线性漂移可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域
        axes[0].plot(t, clean, label='清洁信号', alpha=0.7)
        axes[0].plot(t, drifted, label=f'线性漂移 (b={slope}µV/s)', alpha=0.7)
        axes[0].set_title(f'线性漂移 - {base_freq}Hz信号 (SNR={snr:.1f}dB)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # 频域
        freqs1, psd1 = self._compute_psd(clean)
        freqs2, psd2 = self._compute_psd(drifted)

        axes[1].semilogy(freqs1, psd1, label='清洁信号', alpha=0.7)
        axes[1].semilogy(freqs2, psd2, label='漂移信号', alpha=0.7)
        axes[1].axvline(base_freq, color='green', linestyle='--', alpha=0.5, label=f'{base_freq}Hz')
        axes[1].set_title(f'线性漂移 - 频域 (Alpha误差={error:.1f}%)')
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('PSD (µV²/Hz)')
        axes[1].set_xlim(0, 50)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        filename = self.images_dir / f"linear_drift_{base_freq}Hz_{int(slope)}uVps.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_combined_drift_plot(self, t, clean, drifted, a, b, sine_freq, snr, error):
        """保存组合漂移可视化 (a*sin + b*x)"""
        fig, axes = plt.subplots(3, 1, figsize=(12, 10))

        # 时域对比
        axes[0].plot(t, clean, label='清洁信号', alpha=0.7)
        axes[0].plot(t, drifted, label=f'组合漂移: {a}µV*sin(2π*{sine_freq}t) + {b}µV/s*t', alpha=0.7)
        axes[0].set_title(f'组合漂移 (a={a}µV, b={b}µV/s) - 时域 (SNR={snr:.1f}dB)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # 频域
        freqs1, psd1 = self._compute_psd(clean)
        freqs2, psd2 = self._compute_psd(drifted)

        axes[1].semilogy(freqs1, psd1, label='清洁信号', alpha=0.7)
        axes[1].semilogy(freqs2, psd2, label='组合漂移', alpha=0.7)
        axes[1].axvline(10, color='green', linestyle='--', alpha=0.5, label='10Hz (Alpha)')
        axes[1].axvline(sine_freq, color='red', linestyle='--', alpha=0.3, label=f'{sine_freq}Hz漂移')
        axes[1].set_title(f'组合漂移 - 频域 (Alpha误差={error:.1f}%)')
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('PSD (µV²/Hz)')
        axes[1].set_xlim(0, 50)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        # 漂移分量可视化
        drift_only = drifted - clean
        axes[2].plot(t, drift_only, color='orange', label='漂移分量')
        axes[2].set_title('漂移分量 (a*sin(x) + b*x)')
        axes[2].set_xlabel('时间 (秒)')
        axes[2].set_ylabel('漂移振幅 (µV)')
        axes[2].legend()
        axes[2].grid(True, alpha=0.3)

        plt.tight_layout()
        filename = self.images_dir / f"combined_drift_a{a}_b{b}.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_detrending_comparison_plot(self, t, clean, drifted, detrended, method, corr, error):
        """保存去漂移对比图"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域对比
        axes[0].plot(t, clean, label='原始清洁信号', alpha=0.7, linewidth=1.5)
        axes[0].plot(t, drifted, label='漂移信号', alpha=0.5, linestyle='--')
        axes[0].plot(t, detrended, label=f'去漂移后 ({method})', alpha=0.8)
        axes[0].set_title(f'去漂移效果 - {method} (相关性={corr:.3f})')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # 频域对比
        freqs1, psd1 = self._compute_psd(clean)
        freqs2, psd2 = self._compute_psd(detrended)

        axes[1].semilogy(freqs1, psd1, label='原始信号', alpha=0.7)
        axes[1].semilogy(freqs2, psd2, label=f'去漂移后', alpha=0.7)
        axes[1].axvline(10, color='green', linestyle='--', alpha=0.5, label='10Hz')
        axes[1].set_title(f'频域恢复 (Alpha误差={error:.1f}%)')
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('PSD (µV²/Hz)')
        axes[1].set_xlim(0, 50)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        filename = self.images_dir / f"detrending_{method}.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

    def _compute_psd(self, signal: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """计算 PSD"""
        from mne.time_frequency import psd_array_welch

        n_samples = len(signal)
        n_fft = min(256, 2 ** int(np.log2(n_samples)))
        n_overlap = n_fft // 2

        psds, freqs = psd_array_welch(
            signal,
            sfreq=self.sfreq,
            fmin=0.5,
            fmax=50,
            n_fft=n_fft,
            n_overlap=n_overlap,
            verbose=False
        )

        if psds.ndim == 1:
            psds = psds.reshape(1, -1)
        psd_mean = psds.mean(axis=0)

        return freqs, psd_mean

    def _save_experiment_results(self, results: Dict[str, Any], filename: str):
        """保存实验结果到 JSON"""
        filepath = self.report_dir / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    def _generate_summary_report(self, all_results: Dict[str, Any]):
        """生成汇总报告"""
        summary_lines = [
            "# 漂移信号实验汇总报告",
            f"\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "\n## 实验结果概览\n"
        ]

        for exp_name, result in all_results.items():
            if "error" in result:
                summary_lines.append(f"### {exp_name}: 失败")
                summary_lines.append(f"- 错误: {result['error']}")
            else:
                pass_rate = result.get("pass_rate", 0)
                status = "✓ 通过" if pass_rate >= 0.8 else "⚠ 部分通过" if pass_rate >= 0.5 else "✗ 失败"
                summary_lines.append(f"### {exp_name}: {status}")
                summary_lines.append(f"- 通过率: {pass_rate:.1%}")

        # 保存报告
        report_path = self.report_dir / "SUMMARY.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(summary_lines))

        print(f"\n汇总报告已保存: {report_path}")


if __name__ == "__main__":
    # 运行快速测试
    experiments = DriftExperiments()

    print("运行漂移信号实验...")

    # 运行单个实验进行测试
    experiments.run_linear_drift_experiment(slopes=[5, 20], base_frequencies=[10])
    experiments.run_combined_drift_experiment(a_values=[10, 50], b_values=[5, 20])
    experiments.run_detrending_experiment()

    print("\n所有测试完成！")
    print(f"报告保存在: {experiments.report_dir}")
