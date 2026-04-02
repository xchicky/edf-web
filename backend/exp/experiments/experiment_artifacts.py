"""
伪迹信号实验模块

测试分析工具对各种 EEG 伪迹的鲁棒性，包括：
- 基线漂移
- 眼动眨眼
- 工频干扰
- 肌电伪迹
- 电极瞬态伪迹
- 心电伪迹
"""

import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')  # 非交互式后端
import matplotlib.pyplot as plt
from typing import Dict, Any, List, Tuple
import json
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.analysis_service import AnalysisService
from exp.fixtures.synthetic_signals import SyntheticSignalGenerator
from exp.fixtures.artifacts import ArtifactGenerator
from exp.utils.visualization import plot_time_domain, plot_frequency_domain, plot_comparison
from exp.utils.metrics import calculate_snr, calculate_sar
from exp.utils.analysis_validator import AnalysisValidator


class ArtifactExperiments:
    """伪迹信号实验类"""

    def __init__(self, sfreq: float = 500.0, report_dir: str = None):
        """
        初始化伪迹实验

        Args:
            sfreq: 采样率
            report_dir: 报告保存目录
        """
        self.sfreq = sfreq
        self.report_dir = Path(report_dir) if report_dir else Path(__file__).parent.parent / "reports" / "artifacts"
        self.report_dir.mkdir(parents=True, exist_ok=True)

        # 初始化生成器
        self.sig_gen = SyntheticSignalGenerator(sfreq)
        self.art_gen = ArtifactGenerator(sfreq)

        # 初始化验证器
        self.validator = AnalysisValidator()

        # 创建图像目录
        self.images_dir = self.report_dir / "images"
        self.images_dir.mkdir(exist_ok=True)

    def run_baseline_wander_experiment(
        self,
        amplitudes: List[float] = None,
        freqs: List[float] = None
    ) -> Dict[str, Any]:
        """
        基线漂移实验

        测试不同幅度和频率的基线漂移对频带功率分析的影响

        Args:
            amplitudes: 漂移幅度列表 (µV)
            freqs: 漂移频率列表 (Hz)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 1: 基线漂移 (Baseline Wander)")
        print("=" * 60)

        amplitudes = amplitudes or [10, 20, 50, 100]
        freqs = freqs or [0.05, 0.1, 0.2, 0.5]

        results = []
        summary = {
            "experiment": "baseline_wander",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"amplitudes": amplitudes, "freqs": freqs},
            "results": []
        }

        # 生成基础 10Hz Alpha 信号
        duration = 2.0
        t, clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)

        for amp in amplitudes:
            for freq in freqs:
                # 添加漂移
                artifact_signal = self.art_gen.add_baseline_wander(
                    clean_signal.copy(),
                    amplitude=amp,
                    freq=freq
                )

                # 计算指标
                snr = calculate_snr(artifact_signal, self.sfreq)
                sar = calculate_sar(clean_signal, artifact_signal, self.sfreq)

                # 计算频带功率
                clean_bands = self._calculate_band_power(clean_signal)
                artifact_bands = self._calculate_band_power(artifact_signal)

                # 验证 Alpha 波准确性
                alpha_error = abs(clean_bands["alpha"]["relative"] - artifact_bands["alpha"]["relative"])

                result = {
                    "amplitude": amp,
                    "frequency": freq,
                    "snr": snr,
                    "sar": sar,
                    "clean_alpha": clean_bands["alpha"]["relative"],
                    "artifact_alpha": artifact_bands["alpha"]["relative"],
                    "alpha_error": alpha_error,
                    "passed": alpha_error < 20  # 允许 20% 误差
                }
                results.append(result)

                # 打印结果
                drift_type = "强漂移" if amp >= 50 else "中等漂移" if amp >= 20 else "弱漂移"
                status = "✓" if result["passed"] else "✗"
                print(f"{status} 漂移={amp}µV@{freq}Hz | SNR={snr:.1f}dB | SAR={sar:.1f}dB | Alpha误差={alpha_error:.1f}%")

                # 保存可视化
                if len(results) <= 4:  # 只保存前几个
                    self._save_baseline_wander_plot(
                        t, clean_signal, artifact_signal,
                        amp, freq, snr, sar
                    )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "baseline_wander.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_eye_blink_experiment(
        self,
        positions: List[float] = None,
        amplitudes: List[float] = None,
        durations: List[float] = None
    ) -> Dict[str, Any]:
        """
        眼动眨眼实验

        测试不同位置、幅度和持续时间的眼眨伪迹

        Args:
            positions: 眨眼位置列表 (0-1)
            amplitudes: 眨眼幅度列表 (µV)
            durations: 眨眼持续时间列表 (ms)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 2: 眼动眨眼 (Eye Blink)")
        print("=" * 60)

        positions = positions or [0.2, 0.5, 0.7]
        amplitudes = amplitudes or [50, 100, 150, 200, 300]
        durations = durations or [100, 200, 400]

        results = []
        summary = {
            "experiment": "eye_blink",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "positions": positions,
                "amplitudes": amplitudes,
                "durations": durations
            },
            "results": []
        }

        # 生成基础信号
        duration = 2.0
        t, clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)

        for pos in positions:
            for amp in amplitudes:
                for dur in durations:
                    # 添加眼眨
                    artifact_signal = self.art_gen.add_eye_blink(
                        clean_signal.copy(),
                        position=pos,
                        amplitude=amp,
                        duration_ms=dur
                    )

                    # 计算指标
                    snr = calculate_snr(artifact_signal, self.sfreq)
                    sar = calculate_sar(clean_signal, artifact_signal, self.sfreq)

                    # 计算频带功率
                    clean_bands = self._calculate_band_power(clean_signal)
                    artifact_bands = self._calculate_band_power(artifact_signal)

                    alpha_error = abs(clean_bands["alpha"]["relative"] - artifact_bands["alpha"]["relative"])

                    result = {
                        "position": pos,
                        "amplitude": amp,
                        "duration_ms": dur,
                        "snr": snr,
                        "sar": sar,
                        "clean_alpha": clean_bands["alpha"]["relative"],
                        "artifact_alpha": artifact_bands["alpha"]["relative"],
                        "alpha_error": alpha_error,
                        "passed": alpha_error < 25  # 眼眨允许更大误差
                    }
                    results.append(result)

                    # 打印结果
                    intensity = "强" if amp >= 200 else "中" if amp >= 100 else "弱"
                    status = "✓" if result["passed"] else "✗"
                    print(f"{status} 位置={pos:.1f} | 幅度={amp}µV({intensity}) | 持续={dur}ms | "
                          f"SNR={snr:.1f}dB | Alpha误差={alpha_error:.1f}%")

                    # 保存关键案例的可视化
                    if len(results) <= 6:
                        self._save_eye_blink_plot(
                            t, clean_signal, artifact_signal,
                            pos, amp, dur, snr
                        )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "eye_blink.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_power_line_experiment(
        self,
        frequencies: List[float] = None,
        amplitudes: List[float] = None
    ) -> Dict[str, Any]:
        """
        工频干扰实验

        测试 50Hz 和 60Hz 工频干扰的影响

        Args:
            frequencies: 工频列表
            amplitudes: 干扰幅度列表 (µV)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 3: 工频干扰 (Power Line Noise)")
        print("=" * 60)

        frequencies = frequencies or [50.0, 60.0]
        amplitudes = amplitudes or [1, 5, 10, 20]

        results = []
        summary = {
            "experiment": "power_line",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"frequencies": frequencies, "amplitudes": amplitudes},
            "results": []
        }

        # 生成基础信号 (10Hz Alpha)
        duration = 2.0
        t, clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)

        for freq in frequencies:
            for amp in amplitudes:
                # 添加工频干扰
                artifact_signal = self.art_gen.add_power_line_noise(
                    clean_signal.copy(),
                    freq=freq,
                    amplitude=amp
                )

                # 计算指标
                snr = calculate_snr(artifact_signal, self.sfreq)
                sar = calculate_sar(clean_signal, artifact_signal, self.sfreq)

                # 计算频带功率
                clean_bands = self._calculate_band_power(clean_signal)
                artifact_bands = self._calculate_band_power(artifact_signal)

                alpha_error = abs(clean_bands["alpha"]["relative"] - artifact_bands["alpha"]["relative"])

                # 检查是否在 Gamma 频带检测到工频
                gamma_power = artifact_bands.get("gamma", {}).get("relative", 0)

                result = {
                    "frequency": freq,
                    "amplitude": amp,
                    "snr": snr,
                    "sar": sar,
                    "clean_alpha": clean_bands["alpha"]["relative"],
                    "artifact_alpha": artifact_bands["alpha"]["relative"],
                    "gamma_power": gamma_power,
                    "alpha_error": alpha_error,
                    "passed": alpha_error < 15  # 工频影响较小
                }
                results.append(result)

                # 打印结果
                status = "✓" if result["passed"] else "✗"
                print(f"{status} {int(freq)}Hz工频 | 幅度={amp}µV | SNR={snr:.1f}dB | "
                      f"Alpha误差={alpha_error:.1f}% | Gamma={gamma_power:.1f}%")

                # 保存可视化
                if len(results) <= 4:
                    self._save_power_line_plot(
                        t, clean_signal, artifact_signal,
                        freq, amp, snr
                    )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "power_line.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_muscle_artifact_experiment(
        self,
        positions: List[float] = None,
        amplitudes: List[float] = None,
        durations: List[float] = None
    ) -> Dict[str, Any]:
        """
        肌电伪迹实验

        测试高频肌电伪迹的影响

        Args:
            positions: 伪迹位置列表
            amplitudes: 伪迹幅度列表 (µV)
            durations: 持续时间列表 (ms)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 4: 肌电伪迹 (Muscle Artifact / EMG)")
        print("=" * 60)

        positions = positions or [0.3, 0.5, 0.7]
        amplitudes = amplitudes or [20, 50, 100]
        durations = durations or [50, 100, 200]

        results = []
        summary = {
            "experiment": "muscle_artifact",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "positions": positions,
                "amplitudes": amplitudes,
                "durations": durations
            },
            "results": []
        }

        # 生成基础信号
        duration = 2.0
        t, clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)

        for pos in positions:
            for amp in amplitudes:
                for dur in durations:
                    # 添加肌电伪迹
                    artifact_signal = self.art_gen.add_muscle_artifact(
                        clean_signal.copy(),
                        position=pos,
                        amplitude=amp,
                        duration_ms=dur
                    )

                    # 计算指标
                    snr = calculate_snr(artifact_signal, self.sfreq)
                    sar = calculate_sar(clean_signal, artifact_signal, self.sfreq)

                    # 计算频带功率
                    clean_bands = self._calculate_band_power(clean_signal)
                    artifact_bands = self._calculate_band_power(artifact_signal)

                    alpha_error = abs(clean_bands["alpha"]["relative"] - artifact_bands["alpha"]["relative"])
                    beta_increase = artifact_bands["beta"]["relative"] - clean_bands["beta"]["relative"]
                    gamma_increase = artifact_bands["gamma"]["relative"] - clean_bands["gamma"]["relative"]

                    result = {
                        "position": pos,
                        "amplitude": amp,
                        "duration_ms": dur,
                        "snr": snr,
                        "sar": sar,
                        "clean_alpha": clean_bands["alpha"]["relative"],
                        "artifact_alpha": artifact_bands["alpha"]["relative"],
                        "alpha_error": alpha_error,
                        "beta_increase": beta_increase,
                        "gamma_increase": gamma_increase,
                        "passed": alpha_error < 30  # 肌电影响较大
                    }
                    results.append(result)

                    # 打印结果
                    status = "✓" if result["passed"] else "✗"
                    print(f"{status} 位置={pos:.1f} | 幅度={amp}µV | 持续={dur}ms | "
                          f"SNR={snr:.1f}dB | Alpha误差={alpha_error:.1f}% | "
                          f"Gamma增加={gamma_increase:.1f}%")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "muscle_artifact.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_electrode_pop_experiment(
        self,
        positions: List[float] = None,
        amplitudes: List[float] = None
    ) -> Dict[str, Any]:
        """
        电极弹出伪迹实验

        测试瞬时尖峰伪迹

        Args:
            positions: 尖峰位置列表
            amplitudes: 尖峰幅度列表 (µV)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 5: 电极弹出伪迹 (Electrode Pop)")
        print("=" * 60)

        positions = positions or [0.2, 0.4, 0.6, 0.8]
        amplitudes = amplitudes or [100, 300, 500, 1000]

        results = []
        summary = {
            "experiment": "electrode_pop",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"positions": positions, "amplitudes": amplitudes},
            "results": []
        }

        # 生成基础信号
        duration = 2.0
        t, clean_signal = self.sig_gen.generate_sine_wave(freq=10.0, duration=duration)

        for pos in positions:
            for amp in amplitudes:
                # 添加电极弹出
                artifact_signal = self.art_gen.add_electrode_pop(
                    clean_signal.copy(),
                    position=pos,
                    amplitude=amp
                )

                # 计算指标
                snr = calculate_snr(artifact_signal, self.sfreq)
                sar = calculate_sar(clean_signal, artifact_signal, self.sfreq)

                # 计算频带功率
                clean_bands = self._calculate_band_power(clean_signal)
                artifact_bands = self._calculate_band_power(artifact_signal)

                alpha_error = abs(clean_bands["alpha"]["relative"] - artifact_bands["alpha"]["relative"])

                result = {
                    "position": pos,
                    "amplitude": amp,
                    "snr": snr,
                    "sar": sar,
                    "clean_alpha": clean_bands["alpha"]["relative"],
                    "artifact_alpha": artifact_bands["alpha"]["relative"],
                    "alpha_error": alpha_error,
                    "passed": alpha_error < 10  # 单个尖峰影响应该很小
                }
                results.append(result)

                # 打印结果
                intensity = "极强" if amp >= 1000 else "强" if amp >= 300 else "中" if amp >= 100 else "弱"
                status = "✓" if result["passed"] else "✗"
                print(f"{status} 位置={pos:.1f} | 幅度={amp}µV({intensity}) | "
                      f"SNR={snr:.1f}dB | Alpha误差={alpha_error:.1f}%")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "electrode_pop.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_realistic_eeg_experiment(self) -> Dict[str, Any]:
        """
        真实 EEG 场景实验

        测试包含多种伪迹的真实场景

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 6: 真实 EEG 场景 (Realistic EEG)")
        print("=" * 60)

        # 生成真实 EEG 信号（包含多种伪迹）
        duration = 10.0
        t, realistic_eeg = self.art_gen.generate_realistic_eeg(duration=duration, add_artifacts=True)

        # 计算指标
        snr = calculate_snr(realistic_eeg, self.sfreq)

        # 计算频带功率
        bands = self._calculate_band_power(realistic_eeg)

        # 打印结果
        print(f"\n信号时长: {duration}秒 | SNR: {snr:.1f}dB")
        print("\n频带功率分布:")
        for band_name, band_data in bands.items():
            print(f"  {band_name.upper():6s}: {band_data['relative']:5.1f}% (绝对: {band_data['absolute']:.2f} µV²)")

        # 保存可视化
        self._save_realistic_eeg_plot(t, realistic_eeg, snr, bands)

        result = {
            "experiment": "realistic_eeg",
            "timestamp": datetime.now().isoformat(),
            "duration": duration,
            "snr": snr,
            "band_powers": bands,
            "passed": snr > 0  # 只是一个演示实验
        }

        # 保存结果
        self._save_experiment_results(result, "realistic_eeg.json")

        print("\n真实 EEG 场景可视化已保存")
        print("=" * 60)

        return result

    def run_full_suite(self) -> Dict[str, Any]:
        """
        运行完整的伪迹实验套件

        Returns:
            所有实验的汇总结果
        """
        print("\n" + "=" * 80)
        print(" " * 20 + "伪迹信号实验套件 (完整运行)")
        print("=" * 80)

        all_results = {}

        # 运行各项实验
        try:
            all_results["baseline_wander"] = self.run_baseline_wander_experiment()
        except Exception as e:
            print(f"基线漂移实验失败: {e}")
            all_results["baseline_wander"] = {"error": str(e)}

        try:
            all_results["eye_blink"] = self.run_eye_blink_experiment()
        except Exception as e:
            print(f"眼动眨眼实验失败: {e}")
            all_results["eye_blink"] = {"error": str(e)}

        try:
            all_results["power_line"] = self.run_power_line_experiment()
        except Exception as e:
            print(f"工频干扰实验失败: {e}")
            all_results["power_line"] = {"error": str(e)}

        try:
            all_results["muscle_artifact"] = self.run_muscle_artifact_experiment()
        except Exception as e:
            print(f"肌电伪迹实验失败: {e}")
            all_results["muscle_artifact"] = {"error": str(e)}

        try:
            all_results["electrode_pop"] = self.run_electrode_pop_experiment()
        except Exception as e:
            print(f"电极弹出实验失败: {e}")
            all_results["electrode_pop"] = {"error": str(e)}

        try:
            all_results["realistic_eeg"] = self.run_realistic_eeg_experiment()
        except Exception as e:
            print(f"真实 EEG 实验失败: {e}")
            all_results["realistic_eeg"] = {"error": str(e)}

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

    def _save_baseline_wander_plot(
        self,
        t: np.ndarray,
        clean: np.ndarray,
        artifact: np.ndarray,
        amp: float,
        freq: float,
        snr: float,
        sar: float
    ):
        """保存基线漂移可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域对比
        axes[0].plot(t, clean, label='清洁信号', alpha=0.7)
        axes[0].plot(t, artifact, label=f'漂移信号 ({amp}µV@{freq}Hz)', alpha=0.7)
        axes[0].set_title(f'基线漂移 - 时域对比 (SNR={snr:.1f}dB, SAR={sar:.1f}dB)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # 频域对比
        from exp.utils.visualization import plot_frequency_domain
        freqs1, psd1 = self._compute_psd(clean)
        freqs2, psd2 = self._compute_psd(artifact)

        axes[1].semilogy(freqs1, psd1, label='清洁信号', alpha=0.7)
        axes[1].semilogy(freqs2, psd2, label='漂移信号', alpha=0.7)
        axes[1].axvline(10, color='green', linestyle='--', alpha=0.5, label='10Hz (Alpha)')
        axes[1].set_title('基线漂移 - 频域对比')
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('PSD (µV²/Hz)')
        axes[1].set_xlim(0, 50)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        filename = self.images_dir / f"baseline_wander_{int(amp)}uV_{freq}Hz.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_eye_blink_plot(self, t, clean, artifact, pos, amp, dur, snr):
        """保存眼动眨眼可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域
        axes[0].plot(t, clean, label='清洁信号', alpha=0.7)
        axes[0].plot(t, artifact, label=f'眼眨 (位置={pos:.1f}, {amp}µV, {dur}ms)', alpha=0.7)
        axes[0].set_title(f'眼动眨眼 - 时域 (SNR={snr:.1f}dB)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # 频域
        freqs1, psd1 = self._compute_psd(clean)
        freqs2, psd2 = self._compute_psd(artifact)

        axes[1].semilogy(freqs1, psd1, label='清洁信号', alpha=0.7)
        axes[1].semilogy(freqs2, psd2, label='含眼眨', alpha=0.7)
        axes[1].set_title('眼动眨眼 - 频域')
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('PSD (µV²/Hz)')
        axes[1].set_xlim(0, 50)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        filename = self.images_dir / f"eye_blink_pos{int(pos*10)}_{amp}uV_{dur}ms.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_power_line_plot(self, t, clean, artifact, freq, amp, snr):
        """保存工频干扰可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域
        axes[0].plot(t, clean[:500], label='清洁信号', alpha=0.7)
        axes[0].plot(t[:500], artifact[:500], label=f'{int(freq)}Hz工频 ({amp}µV)', alpha=0.7)
        axes[0].set_title(f'工频干扰 - 时域 (SNR={snr:.1f}dB)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        # 频域
        freqs1, psd1 = self._compute_psd(clean)
        freqs2, psd2 = self._compute_psd(artifact)

        axes[1].semilogy(freqs1, psd1, label='清洁信号', alpha=0.7)
        axes[1].semilogy(freqs2, psd2, label='含工频干扰', alpha=0.7)
        axes[1].axvline(freq, color='red', linestyle='--', label=f'{int(freq)}Hz')
        axes[1].axvline(10, color='green', linestyle='--', alpha=0.5, label='10Hz (Alpha)')
        axes[1].set_title('工频干扰 - 频域')
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('PSD (µV²/Hz)')
        axes[1].set_xlim(0, 70)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        filename = self.images_dir / f"power_line_{int(freq)}Hz_{amp}uV.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_realistic_eeg_plot(self, t, signal, snr, bands):
        """保存真实 EEG 可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(14, 8))

        # 时域
        axes[0].plot(t, signal)
        axes[0].set_title(f'模拟真实 EEG 信号 (SNR={snr:.1f}dB)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].grid(True, alpha=0.3)

        # 频带功率柱状图
        band_names = list(bands.keys())
        relative_powers = [bands[b]["relative"] for b in band_names]
        colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

        axes[1].bar(band_names, relative_powers, color=colors)
        axes[1].set_title('频带功率分布')
        axes[1].set_ylabel('相对功率 (%)')
        axes[1].set_ylim(0, 100)
        axes[1].grid(True, alpha=0.3, axis='y')

        # 添加数值标签
        for i, (name, power) in enumerate(zip(band_names, relative_powers)):
            axes[1].text(i, power + 2, f'{power:.1f}%', ha='center')

        plt.tight_layout()
        filename = self.images_dir / "realistic_eeg.png"
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
            "# 伪迹信号实验汇总报告",
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
    experiments = ArtifactExperiments()

    print("运行伪迹信号实验...")

    # 运行单个实验进行测试
    experiments.run_baseline_wander_experiment(amplitudes=[20, 50], freqs=[0.1, 0.2])
    experiments.run_eye_blink_experiment(positions=[0.5], amplitudes=[100, 200], durations=[200])
    experiments.run_power_line_experiment(frequencies=[50], amplitudes=[5, 10])

    print("\n所有测试完成！")
    print(f"报告保存在: {experiments.report_dir}")
