"""
EEG 事件实验模块

测试分析工具对各种生理性 EEG 事件的检测和分析能力，包括：
- 睡眠纺锤波 (11-16Hz)
- K-复合波
- 癫痫尖峰
- P300 事件相关电位
- Alpha 阻断
- 背景静息态 EEG
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
from exp.fixtures.synthetic_signals import SyntheticSignalGenerator
from exp.fixtures.eeg_events import EEGEventGenerator, EEG_EVENT_TEST_CASES
from exp.utils.metrics import calculate_snr
from exp.utils.analysis_validator import AnalysisValidator


class EEGEventExperiments:
    """EEG 事件实验类"""

    def __init__(self, sfreq: float = 500.0, report_dir: str = None):
        """
        初始化 EEG 事件实验

        Args:
            sfreq: 采样率
            report_dir: 报告保存目录
        """
        self.sfreq = sfreq
        self.report_dir = Path(report_dir) if report_dir else Path(__file__).parent.parent / "reports" / "eeg_events"
        self.report_dir.mkdir(parents=True, exist_ok=True)

        # 初始化生成器
        self.sig_gen = SyntheticSignalGenerator(sfreq)
        self.eeg_gen = EEGEventGenerator(sfreq)

        # 初始化验证器
        self.validator = AnalysisValidator()

        # 创建图像目录
        self.images_dir = self.report_dir / "images"
        self.images_dir.mkdir(exist_ok=True)

    def run_sleep_spindle_experiment(
        self,
        durations: List[float] = None,
        center_freqs: List[float] = None,
        amplitudes: List[float] = None
    ) -> Dict[str, Any]:
        """
        睡眠纺锤波实验

        测试对 11-16Hz 纺锤波的检测和分析

        Args:
            durations: 纺锤波持续时间列表 (秒)
            center_freqs: 中心频率列表
            amplitudes: 振幅列表 (µV)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 1: 睡眠纺锤波 (Sleep Spindle, 11-16Hz)")
        print("=" * 60)

        durations = durations or [0.5, 1.0, 1.5, 2.0]
        center_freqs = center_freqs or [11.0, 13.0, 15.0]
        amplitudes = amplitudes or [30, 50, 80, 100]

        results = []
        summary = {
            "experiment": "sleep_spindle",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "durations": durations,
                "center_freqs": center_freqs,
                "amplitudes": amplitudes
            },
            "results": []
        }

        for duration in durations:
            for center_freq in center_freqs:
                for amp in amplitudes:
                    # 生成睡眠纺锤波
                    t, spindle_signal = self.eeg_gen.generate_sleep_spindle(
                        duration=duration,
                        center_freq=center_freq,
                        amplitude=amp
                    )

                    # 添加背景噪声
                    noise = 3 * np.random.randn(len(spindle_signal))
                    test_signal = spindle_signal + noise

                    # 计算频带功率
                    bands = self._calculate_band_power(test_signal)

                    # 检查主导频带
                    dominant_band = self._get_dominant_band(bands)
                    alpha_power = bands["alpha"]["relative"]
                    theta_power = bands["theta"]["relative"]

                    # 验证：纺锤波应在 Alpha 频带 (11-16Hz 属于 Alpha)
                    expected_band = "alpha"
                    passed = (dominant_band == expected_band and alpha_power > 40)

                    result = {
                        "duration": duration,
                        "center_freq": center_freq,
                        "amplitude": amp,
                        "dominant_band": dominant_band,
                        "alpha_power": alpha_power,
                        "theta_power": theta_power,
                        "passed": passed
                    }
                    results.append(result)

                    # 打印结果
                    status = "✓" if passed else "✗"
                    print(f"{status} {duration}s | {center_freq}Hz | {amp}µV | "
                          f"主导={dominant_band} | Alpha={alpha_power:.1f}%")

                    # 保存可视化
                    if len(results) <= 8:
                        self._save_eeg_event_plot(
                            t, test_signal, "睡眠纺锤波",
                            f"{duration}s_{center_freq}Hz_{amp}µV",
                            bands
                        )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "sleep_spindle.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_k_complex_experiment(
        self,
        spike_amplitudes: List[float] = None,
        slow_wave_amplitudes: List[float] = None
    ) -> Dict[str, Any]:
        """
        K-复合波实验

        测试对 K-复合波的分析

        Args:
            spike_amplitudes: 尖峰振幅列表 (µV)
            slow_wave_amplitudes: 慢波振幅列表 (µV)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 2: K-复合波 (K-Complex)")
        print("=" * 60)

        spike_amplitudes = spike_amplitudes or [-100, -150, -200]
        slow_wave_amplitudes = slow_wave_amplitudes or [80, 100, 150]

        results = []
        summary = {
            "experiment": "k_complex",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "spike_amplitudes": spike_amplitudes,
                "slow_wave_amplitudes": slow_wave_amplitudes
            },
            "results": []
        }

        for spike_amp in spike_amplitudes:
            for slow_amp in slow_wave_amplitudes:
                # 生成 K-复合波
                t, k_signal = self.eeg_gen.generate_k_complex(
                    spike_amplitude=spike_amp,
                    slow_wave_amplitude=slow_amp
                )

                # 添加背景噪声
                test_signal = k_signal + 3 * np.random.randn(len(k_signal))

                # 计算频带功率
                bands = self._calculate_band_power(test_signal)

                # K-复合波特征：混合 Delta/Theta 频率成分
                delta_power = bands["delta"]["relative"]
                theta_power = bands["theta"]["relative"]
                total_low_freq = delta_power + theta_power

                # 验证：应有显著的低频成分
                passed = total_low_freq > 50

                result = {
                    "spike_amplitude": spike_amp,
                    "slow_wave_amplitude": slow_amp,
                    "delta_power": delta_power,
                    "theta_power": theta_power,
                    "total_low_freq": total_low_freq,
                    "passed": passed
                }
                results.append(result)

                # 打印结果
                status = "✓" if passed else "✗"
                print(f"{status} 尖峰={spike_amp}µV | 慢波={slow_amp}µV | "
                      f"Delta={delta_power:.1f}% | Theta={theta_power:.1f}% | "
                      f"低频合计={total_low_freq:.1f}%")

                # 保存可视化
                if len(results) <= 4:
                    self._save_eeg_event_plot(
                        t, test_signal, "K-复合波",
                        f"spike{spike_amp}_slow{slow_amp}",
                        bands
                    )

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "k_complex.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_epileptic_spike_experiment(
        self,
        amplitudes: List[float] = None,
        durations: List[float] = None
    ) -> Dict[str, Any]:
        """
        癫痫尖峰实验

        测试对癫痫棘波的检测

        Args:
            amplitudes: 尖峰振幅列表 (µV)
            durations: 持续时间列表 (秒)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 3: 癫痫尖峰 (Epileptic Spike)")
        print("=" * 60)

        amplitudes = amplitudes or [100, 200, 300, 500]
        durations = durations or [0.02, 0.05, 0.08]

        results = []
        summary = {
            "experiment": "epileptic_spike",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"amplitudes": amplitudes, "durations": durations},
            "results": []
        }

        for amp in amplitudes:
            for dur in durations:
                # 生成癫痫尖峰
                t, spike_signal = self.eeg_gen.generate_epileptic_spike(
                    amplitude=amp,
                    duration=dur
                )

                # 嵌入背景信号
                background = self.sig_gen.generate_sine_wave(freq=10.0, duration=0.5)[1]
                padded_signal = np.concatenate([background, spike_signal, background])
                t_full = np.arange(len(padded_signal)) / self.sfreq

                # 计算频带功率
                bands = self._calculate_band_power(padded_signal)

                # 癫痫尖峰特征：高频成分，Gamma 频带功率增加
                gamma_power = bands["gamma"]["relative"]

                # 验证：应有显著的高频成分
                passed = gamma_power > 20

                result = {
                    "amplitude": amp,
                    "duration_ms": dur * 1000,
                    "gamma_power": gamma_power,
                    "beta_power": bands["beta"]["relative"],
                    "passed": passed
                }
                results.append(result)

                # 打印结果
                intensity = "极强" if amp >= 300 else "强" if amp >= 200 else "中"
                status = "✓" if passed else "✗"
                print(f"{status} {amp}µV({intensity}) | {dur*1000:.0f}ms | "
                      f"Gamma={gamma_power:.1f}% | Beta={bands['beta']['relative']:.1f}%")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "epileptic_spike.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_p300_experiment(
        self,
        n_stimuli: List[int] = None,
        amplitudes: List[float] = None,
        latencies: List[float] = None
    ) -> Dict[str, Any]:
        """
        P300 实验验

        测试对事件相关电位的分析

        Args:
            n_stimuli: 刺激数量列表
            amplitudes: P300 振幅列表 (µV)
            latencies: 潜伏期列表 (秒)

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 4: P300 事件相关电位")
        print("=" * 60)

        n_stimuli = n_stimuli or [1, 3, 5]
        amplitudes = amplitudes or [10, 15, 20]
        latencies = latencies or [0.25, 0.3, 0.35]

        results = []
        summary = {
            "experiment": "p300",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "n_stimuli": n_stimuli,
                "amplitudes": amplitudes,
                "latencies": latencies
            },
            "results": []
        }

        for n_stim in n_stimuli:
            for amp in amplitudes:
                for latency in latencies:
                    # 生成 P300
                    t, p300_signal = self.eeg_gen.generate_p300(
                        n_stimuli=n_stim,
                        amplitude=amp,
                        latency=latency
                    )

                    # 计算频带功率
                    bands = self._calculate_band_power(p300_signal)

                    # P300 特征：低频成分 (Delta/Theta)
                    delta_power = bands["delta"]["relative"]
                    theta_power = bands["theta"]["relative"]

                    # 验证：应有显著的低频成分
                    passed = (delta_power + theta_power) > 30

                    result = {
                        "n_stimuli": n_stim,
                        "amplitude": amp,
                        "latency": latency,
                        "delta_power": delta_power,
                        "theta_power": theta_power,
                        "passed": passed
                    }
                    results.append(result)

                    # 打印结果
                    status = "✓" if passed else "✗"
                    print(f"{status} {n_stim}刺激 | {amp}µV @ {latency*1000:.0f}ms | "
                          f"Delta={delta_power:.1f}% | Theta={theta_power:.1f}%")

                    # 保存可视化 (关键案例)
                    if n_stim == 3 and amp == 15:
                        self._save_p300_plot(t, p300_signal, n_stim, amp, latency, bands)

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "p300.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_alpha_blocking_experiment(
        self,
        block_starts: List[float] = None,
        block_durations: List[float] = None,
        suppression_factors: List[float] = None
    ) -> Dict[str, Any]:
        """
        Alpha 阻断实验

        测试对 Alpha 波抑制的检测

        Args:
            block_starts: 阻断开始时间列表
            block_durations: 阻断持续时间列表
            suppression_factors: 抑制因子列表

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 5: Alpha 阻断 (Alpha Blocking)")
        print("=" * 60)

        block_starts = block_starts or [2.0, 3.0]
        block_durations = block_durations or [0.5, 1.0, 2.0]
        suppression_factors = suppression_factors or [0.2, 0.5, 0.8]

        results = []
        summary = {
            "experiment": "alpha_blocking",
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "block_starts": block_starts,
                "block_durations": block_durations,
                "suppression_factors": suppression_factors
            },
            "results": []
        }

        for block_start in block_starts:
            for block_dur in block_durations:
                for suppression in suppression_factors:
                    # 生成 Alpha 阻断
                    t, alpha_block_signal = self.eeg_gen.generate_alpha_blocking(
                        block_start=block_start,
                        block_duration=block_dur,
                        suppression_factor=suppression
                    )

                    # 计算频带功率
                    bands = self._calculate_band_power(alpha_block_signal)

                    alpha_power = bands["alpha"]["relative"]

                    # 验证：Alpha 功率应显著降低
                    # 分别计算阻断前后的 Alpha 功率
                    n_samples = len(alpha_block_signal)
                    pre_idx = int(block_start * self.sfreq)
                    post_idx = int((block_start + block_dur) * self.sfreq)

                    if pre_idx > 0 and post_idx < n_samples:
                        pre_signal = alpha_block_signal[:pre_idx]
                        post_signal = alpha_block_signal[post_idx:]

                        pre_bands = self._calculate_band_power(pre_signal)
                        post_bands = self._calculate_band_power(post_signal)

                        pre_alpha = pre_bands["alpha"]["relative"]
                        post_alpha = post_bands["alpha"]["relative"]
                        suppression_degree = (pre_alpha - post_alpha) / pre_alpha if pre_alpha > 0 else 0

                        # 验证：阻断后 Alpha 应显著减少
                        passed = post_alpha < pre_alpha * 0.7

                        result = {
                            "block_start": block_start,
                            "block_duration": block_dur,
                            "suppression_factor": suppression,
                            "pre_alpha": pre_alpha,
                            "post_alpha": post_alpha,
                            "suppression_degree": suppression_degree,
                            "passed": passed
                        }
                        results.append(result)

                        # 打印结果
                        level = "完全" if suppression >= 0.7 else "部分" if suppression >= 0.3 else "轻微"
                        status = "✓" if passed else "✗"
                        print(f"{status} 开始={block_start}s | 持续={block_dur}s | "
                              f"抑制={suppression}({level}) | "
                              f"Alpha: {pre_alpha:.1f}% → {post_alpha:.1f}% "
                              f"({suppression_degree:.0%})")

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "alpha_blocking.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_background_eeg_experiment(
        self,
        alpha_freqs: List[float] = None,
        durations: List[float] = None
    ) -> Dict[str, Any]:
        """
        背景静息态 EEG 实验

        测试对静息态 EEG 的分析

        Args:
            alpha_freqs: Alpha 频率列表
            durations: 持续时间列表

        Returns:
            实验结果字典
        """
        print("\n" + "=" * 60)
        print("实验 6: 背景静息态 EEG (Resting State)")
        print("=" * 60)

        alpha_freqs = alpha_freqs or [8.0, 10.0, 12.0]
        durations = durations or [2.0, 5.0, 10.0]

        results = []
        summary = {
            "experiment": "background_eeg",
            "timestamp": datetime.now().isoformat(),
            "parameters": {"alpha_freqs": alpha_freqs, "durations": durations},
            "results": []
        }

        for alpha_freq in alpha_freqs:
            for duration in durations:
                # 生成背景 EEG
                t, eeg_signal = self.eeg_gen.generate_background_eeg(
                    alpha_freq=alpha_freq,
                    duration=duration
                )

                # 计算频带功率
                bands = self._calculate_band_power(eeg_signal)

                # 背景 EEG 特征：Alpha 主导
                alpha_power = bands["alpha"]["relative"]
                theta_power = bands["theta"]["relative"]
                beta_power = bands["beta"]["relative"]

                # 验证：Alpha 应为主导频带
                passed = (alpha_power > theta_power and alpha_power > beta_power)

                result = {
                    "alpha_freq": alpha_freq,
                    "duration": duration,
                    "alpha_power": alpha_power,
                    "theta_power": theta_power,
                    "beta_power": beta_power,
                    "dominant_band": self._get_dominant_band(bands),
                    "passed": passed
                }
                results.append(result)

                # 打印结果
                status = "✓" if passed else "✗"
                print(f"{status} {alpha_freq}Hz Alpha | {duration}s | "
                      f"Alpha={alpha_power:.1f}% | "
                      f"主导={result['dominant_band']}")

                # 保存可视化
                if alpha_freq == 10.0:
                    self._save_background_eeg_plot(t, eeg_signal, duration, bands)

        summary["results"] = results
        summary["pass_rate"] = sum(1 for r in results if r["passed"]) / len(results)

        # 保存结果
        self._save_experiment_results(summary, "background_eeg.json")

        print(f"\n通过率: {summary['pass_rate']:.1%}")
        print("=" * 60)

        return summary

    def run_full_suite(self) -> Dict[str, Any]:
        """
        运行完整的 EEG 事件实验套件

        Returns:
            所有实验的汇总结果
        """
        print("\n" + "=" * 80)
        print(" " * 25 + "EEG 事件实验套件 (完整运行)")
        print("=" * 80)

        all_results = {}

        # 运行各项实验
        try:
            all_results["sleep_spindle"] = self.run_sleep_spindle_experiment()
        except Exception as e:
            print(f"睡眠纺锤波实验失败: {e}")
            all_results["sleep_spindle"] = {"error": str(e)}

        try:
            all_results["k_complex"] = self.run_k_complex_experiment()
        except Exception as e:
            print(f"K-复合波实验失败: {e}")
            all_results["k_complex"] = {"error": str(e)}

        try:
            all_results["epileptic_spike"] = self.run_epileptic_spike_experiment()
        except Exception as e:
            print(f"癫痫尖峰实验失败: {e}")
            all_results["epileptic_spike"] = {"error": str(e)}

        try:
            all_results["p300"] = self.run_p300_experiment()
        except Exception as e:
            print(f"P300实验失败: {e}")
            all_results["p300"] = {"error": str(e)}

        try:
            all_results["alpha_blocking"] = self.run_alpha_blocking_experiment()
        except Exception as e:
            print(f"Alpha阻断实验失败: {e}")
            all_results["alpha_blocking"] = {"error": str(e)}

        try:
            all_results["background_eeg"] = self.run_background_eeg_experiment()
        except Exception as e:
            print(f"背景EEG实验失败: {e}")
            all_results["background_eeg"] = {"error": str(e)}

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

    def _get_dominant_band(self, bands: Dict[str, Dict[str, float]]) -> str:
        """获取主导频带"""
        return max(bands.items(), key=lambda x: x[1]["relative"])[0]

    def _save_eeg_event_plot(self, t, signal, title, filename, bands):
        """保存 EEG 事件可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域波形
        axes[0].plot(t, signal, 'b-', linewidth=0.8)
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].set_title(f'{title} - 时域波形')
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

        for i, (name, power) in enumerate(zip(band_names, relative_powers)):
            axes[1].text(i, power + 2, f'{power:.1f}%', ha='center')

        plt.tight_layout()
        filepath = self.images_dir / f"eeg_{filename}.png"
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_p300_plot(self, t, signal, n_stim, amp, latency, bands):
        """保存 P300 可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域波形
        axes[0].plot(t, signal, 'b-', linewidth=0.8)
        # 标记刺激时间点
        stim_times = [i / 1.0 for i in range(n_stim)]
        for stim_time in stim_times:
            peak_time = stim_time + latency
            axes[0].axvline(peak_time, color='red', linestyle='--', alpha=0.5)

        axes[0].set_title(f'P300 事件相关电位 ({n_stim}次刺激, {amp}µV)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].grid(True, alpha=0.3)

        # 频带功率
        band_names = list(bands.keys())
        relative_powers = [bands[b]["relative"] for b in band_names]
        colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

        axes[1].bar(band_names, relative_powers, color=colors)
        axes[1].set_title('频带功率分布')
        axes[1].set_ylabel('相对功率 (%)')
        axes[1].set_ylim(0, 100)
        axes[1].grid(True, alpha=0.3, axis='y')

        plt.tight_layout()
        filepath = self.images_dir / f"eeg_p300_{n_stim}stim.png"
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_background_eeg_plot(self, t, signal, duration, bands):
        """保存背景 EEG 可视化"""
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域波形
        axes[0].plot(t, signal, 'b-', linewidth=0.8)
        axes[0].set_title(f'背景静息态 EEG ({duration}秒)')
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].grid(True, alpha=0.3)

        # 频带功率
        band_names = list(bands.keys())
        relative_powers = [bands[b]["relative"] for b in band_names]
        colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

        axes[1].bar(band_names, relative_powers, color=colors)
        axes[1].set_title('频带功率分布 (Alpha 主导)')
        axes[1].set_ylabel('相对功率 (%)')
        axes[1].set_ylim(0, 100)
        axes[1].grid(True, alpha=0.3, axis='y')

        for i, (name, power) in enumerate(zip(band_names, relative_powers)):
            axes[1].text(i, power + 2, f'{power:.1f}%', ha='center')

        plt.tight_layout()
        filepath = self.images_dir / "eeg_background.png"
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

    def _save_experiment_results(self, results: Dict[str, Any], filename: str):
        """保存实验结果到 JSON"""
        filepath = self.report_dir / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    def _generate_summary_report(self, all_results: Dict[str, Any]):
        """生成汇总报告"""
        summary_lines = [
            "# EEG 事件实验汇总报告",
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
    experiments = EEGEventExperiments()

    print("运行 EEG 事件实验...")

    # 运行单个实验进行测试
    experiments.run_sleep_spindle_experiment(durations=[1.0], center_freqs=[13.0], amplitudes=[50])
    experiments.run_k_complex_experiment()
    experiments.run_p300_experiment(n_stimuli=[3])

    print("\n所有测试完成！")
    print(f"报告保存在: {experiments.report_dir}")
