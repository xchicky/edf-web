"""
EEG 事件生成器

生成各种生理性的 EEG 事件模式，用于验证分析工具的准确性。

参考文献:
- Sleep Spindles: Iber et al. (2007) - AASM Manual for Scoring Sleep
- K-Complexes: Rechtschaffen & Kales (1968)
- P300: Picton (1992) - The P300 Wave of the Human Event-Related Potential
"""

import numpy as np
from typing import Tuple, Dict, Any, List
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path


class EEGEventGenerator:
    """EEG 事件生成器"""

    def __init__(self, sfreq: float = 500.0):
        """
        Args:
            sfreq: 采样率 (Hz)
        """
        self.sfreq = sfreq

    def generate_sleep_spindle(
        self,
        duration: float = 1.0,
        center_freq: float = 13.0,
        bandwidth: float = 1.5,
        envelope_freq: float = 0.5,
        amplitude: float = 50.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成睡眠纺锤波 (11-16Hz)

        特征: 振幅渐增渐减的类正弦波，持续时间 0.5-2 秒

        Args:
            duration: 纺锤波持续时间 (秒)
            center_freq: 中心频率 (Hz)，通常 11-16Hz
            bandwidth: 频带宽度 (Hz)
            envelope_freq: 包络频率 (Hz)，控制渐增渐减速度
            amplitude: 振幅 (µV)

        Returns:
            (时间数组, 纺锤波信号)
        """
        t = np.arange(0, duration, 1 / self.sfreq)

        # 载波频率 (可能在范围内变化)
        carrier = np.sin(2 * np.pi * center_freq * t)

        # 包络: 渐增渐减模式 (使用高斯窗形状)
        envelope = np.exp(-((t - duration/2) ** 2) / (2 * (duration/4) ** 2))

        # 纺锤波 = 载波 * 包络 * 振幅
        spindle = amplitude * envelope * carrier

        return t, spindle

    def generate_k_complex(
        self,
        duration: float = 1.5,
        spike_amplitude: float = -150.0,
        spike_width: float = 0.1,
        slow_wave_amplitude: float = 100.0,
        slow_wave_duration: float = 0.8
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成 K-复合波

        特征: 尖锐的负向偏转 followed by 缓慢的正向波，持续时间 > 0.5 秒

        Args:
            duration: K-复合波持续时间 (秒)
            spike_amplitude: 尖峰振幅 (µV)，通常为负
            spike_width: 尖峰宽度 (秒)
            slow_wave_amplitude: 慢波振幅 (µV)
            slow_wave_duration: 慢波持续时间 (秒)

        Returns:
            (时间数组, K-复合波信号)
        """
        t = np.arange(0, duration, 1 / self.sfreq)
        signal = np.zeros_like(t)

        # 尖峰位置 (在开始 1/3 处)
        spike_center = duration / 3

        # 尖峰 (高斯形状)
        spike = spike_amplitude * np.exp(-((t - spike_center) ** 2) / (2 * (spike_width/4) ** 2))
        signal += spike

        # 慢波 (从尖峰后开始)
        slow_start = spike_center
        slow_t = t - slow_start
        slow_mask = (slow_t >= 0) & (slow_t <= slow_wave_duration)

        # 慢波: 正向偏转
        slow_wave = np.zeros_like(t)
        if np.any(slow_mask):
            slow_wave[slow_mask] = slow_wave_amplitude * np.sin(np.pi * slow_t[slow_mask] / slow_wave_duration)
        signal += slow_wave

        return t, signal

    def generate_epileptic_spike(
        self,
        amplitude: float = 200.0,
        duration: float = 0.05,
        sharpness: float = 2.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成癫痫棘波

        特征: 尖锐的瞬态变化，持续时间 20-80ms，高振幅

        Args:
            amplitude: 棘波振幅 (µV)
            duration: 棘波持续时间 (秒)
            sharpness: 尖锐度参数

        Returns:
            (时间数组, 棘波信号)
        """
        t = np.arange(0, duration, 1 / self.sfreq)

        # 使用双高斯形状模拟棘波
        center = duration / 2
        width = duration / 6

        # 正向尖峰
        positive = np.exp(-((t - center) ** 2) / (2 * width ** 2))

        # 负向跟随波
        negative = -0.5 * np.exp(-((t - center * 1.2) ** 2) / (2 * (width * 1.5) ** 2))

        spike = amplitude * (positive + negative)

        # 应用锐化
        spike = np.sign(spike) * np.abs(spike) ** sharpness

        return t, spike

    def generate_p300(
        self,
        sfreq_stimulus: float = 1.0,
        n_stimuli: int = 1,
        amplitude: float = 15.0,
        latency: float = 0.3,
        width: float = 0.1
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成 P300 事件相关电位

        特征: 刺激后约 300ms 的正向波，最大分布在顶叶

        Args:
            sfreq_stimulus: 刺激频率 (Hz)
            n_stimuli: 刺激数量
            amplitude: P300 振幅 (µV)
            latency: 峰值潜伏期 (秒)
            width: 波宽 (秒)

        Returns:
            (时间数组, P300 信号)
        """
        total_duration = n_stimuli / sfreq_stimulus
        t = np.arange(0, total_duration, 1 / self.sfreq)
        signal = np.zeros_like(t)

        for i in range(n_stimuli):
            stim_time = i / sfreq_stimulus
            peak_time = stim_time + latency

            # 使用高斯函数模拟 P300
            p300 = amplitude * np.exp(-((t - peak_time) ** 2) / (2 * (width/3) ** 2))
            signal += p300

        return t, signal

    def generate_alpha_blocking(
        self,
        duration: float = 5.0,
        alpha_freq: float = 10.0,
        alpha_amplitude: float = 50.0,
        block_start: float = 2.0,
        block_duration: float = 1.0,
        suppression_factor: float = 0.2
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成 Alpha 阻断 (睁眼时 Alpha 波抑制)

        特征: 持续的 Alpha 波在某个时间段被抑制

        Args:
            duration: 总持续时间 (秒)
            alpha_freq: Alpha 频率 (Hz)
            alpha_amplitude: Alpha 振幅 (µV)
            block_start: 阻断开始时间 (秒)
            block_duration: 阻断持续时间 (秒)
            suppression_factor: 抑制因子 (0-1)，1 表示完全抑制

        Returns:
            (时间数组, Alpha 阻断信号)
        """
        t = np.arange(0, duration, 1 / self.sfreq)

        # 基础 Alpha 波
        alpha = alpha_amplitude * np.sin(2 * np.pi * alpha_freq * t)

        # 阻断窗口
        block_end = block_start + block_duration

        # 创建包络 (在阻断期间抑制)
        envelope = np.ones_like(t)
        block_mask = (t >= block_start) & (t <= block_end)

        # 使用平滑过渡
        if np.any(block_mask):
            # 阻断期间
            envelope[block_mask] = 1 - suppression_factor

            # 平滑过渡 (前后各 100ms)
            transition = 0.1
            pre_transition = (t >= block_start - transition) & (t < block_start)
            post_transition = (t > block_end) & (t <= block_end + transition)

            if np.any(pre_transition):
                x = (t[pre_transition] - (block_start - transition)) / transition
                envelope[pre_transition] = 1 - suppression_factor * (x ** 2) * (3 - 2 * x)

            if np.any(post_transition):
                x = (t[post_transition] - block_end) / transition
                envelope[post_transition] = 1 - suppression_factor + suppression_factor * (x ** 2) * (3 - 2 * x)

        signal = alpha * envelope

        return t, signal

    def generate_background_eeg(
        self,
        duration: float = 2.0,
        alpha_freq: float = 10.0,
        alpha_amplitude: float = 30.0,
        theta_amplitude: float = 10.0,
        beta_amplitude: float = 5.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成背景 EEG (静息态)

        特征: Alpha 波主导，少量 Theta 和 Beta

        Args:
            duration: 持续时间 (秒)
            alpha_freq: Alpha 频率 (Hz)
            alpha_amplitude: Alpha 振幅 (µV)
            theta_amplitude: Theta 振幅 (µV)
            beta_amplitude: Beta 振幅 (µV)

        Returns:
            (时间数组, 背景信号)
        """
        t = np.arange(0, duration, 1 / self.sfreq)

        # 混合频率
        signal = (
            alpha_amplitude * np.sin(2 * np.pi * alpha_freq * t) +
            theta_amplitude * np.sin(2 * np.pi * 6 * t) +
            beta_amplitude * np.sin(2 * np.pi * 20 * t)
        )

        # 添加少量噪声
        signal += 2 * np.random.randn(len(t))

        return t, signal

    def save_event_visualization(
        self,
        t: np.ndarray,
        signal: np.ndarray,
        title: str,
        event_type: str,
        save_path: str
    ):
        """
        保存 EEG 事件可视化

        Args:
            t: 时间数组
            signal: 信号数组
            title: 图表标题
            event_type: 事件类型
            save_path: 保存路径
        """
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域波形
        axes[0].plot(t, signal, 'b-', linewidth=0.8)
        axes[0].set_xlabel('时间 (秒)')
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].set_title(f'{title} - {event_type}')
        axes[0].grid(True, alpha=0.3)

        # 频域分析
        from mne.time_frequency import psd_array_welch
        psds, freqs = psd_array_welch(signal, self.sfreq, n_fft=min(256, len(signal)), verbose=False)
        if psds.ndim == 1:
            psds = psds.reshape(1, -1)
        psd_mean = psds.mean(axis=0)

        axes[1].semilogy(freqs, psd_mean)
        axes[1].set_xlabel('频率 (Hz)')
        axes[1].set_ylabel('功率谱密度 (µV²/Hz)')
        axes[1].set_title('频域分析')
        axes[1].axvspan(0.5, 4, alpha=0.2, color='purple', label='Delta')
        axes[1].axvspan(4, 8, alpha=0.2, color='blue', label='Theta')
        axes[1].axvspan(8, 13, alpha=0.2, color='green', label='Alpha')
        axes[1].axvspan(13, 30, alpha=0.2, color='orange', label='Beta')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        axes[1].set_xlim(0, 50)

        plt.tight_layout()
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()


# 测试用例配置
EEG_EVENT_TEST_CASES = {
    "sleep_spindle": {
        "params": {
            "duration": 1.2,
            "center_freq": 13.0,
            "amplitude": 50.0
        },
        "description": "睡眠纺锤波 (13Hz, 1.2s)"
    },
    "k_complex": {
        "params": {
            "duration": 1.5,
            "spike_amplitude": -150.0,
            "slow_wave_amplitude": 100.0
        },
        "description": "K-复合波"
    },
    "epileptic_spike": {
        "params": {
            "amplitude": 200.0,
            "duration": 0.05
        },
        "description": "癫痫棘波 (200µV, 50ms)"
    },
    "p300": {
        "params": {
            "n_stimuli": 3,
            "amplitude": 15.0,
            "latency": 0.3
        },
        "description": "P300 事件相关电位 (3 次刺激)"
    },
    "alpha_blocking": {
        "params": {
            "duration": 5.0,
            "block_start": 2.0,
            "block_duration": 1.0
        },
        "description": "Alpha 阻断 (2-3秒)"
    },
}


if __name__ == "__main__":
    # 生成示例 EEG 事件
    print("生成 EEG 事件示例...")

    gen = EEGEventGenerator(500)

    reports_dir = Path(__file__).parent.parent.parent / "exp" / "reports" / "images"
    reports_dir.mkdir(parents=True, exist_ok=True)

    # 睡眠纺锤波
    t, spindle = gen.generate_sleep_spindle()
    gen.save_event_visualization(t, spindle, "EEG 事件", "睡眠纺锤波",
                                reports_dir / "eeg_event_spindle.png")
    print(f"已保存: {reports_dir / 'eeg_event_spindle.png'}")

    # K-复合波
    t, k_complex = gen.generate_k_complex()
    gen.save_event_visualization(t, k_complex, "EEG 事件", "K-复合波",
                                reports_dir / "eeg_event_k_complex.png")
    print(f"已保存: {reports_dir / 'eeg_event_k_complex.png'}")

    # 癫痫棘波
    t, spike = gen.generate_epileptic_spike()
    gen.save_event_visualization(t, spike, "EEG 事件", "癫痫棘波",
                                reports_dir / "eeg_event_spike.png")
    print(f"已保存: {reports_dir / 'eeg_event_spike.png'}")

    # P300
    t, p300 = gen.generate_p300(n_stimuli=5)
    gen.save_event_visualization(t, p300, "EEG 事件", "P300 (5次刺激)",
                                reports_dir / "eeg_event_p300.png")
    print(f"已保存: {reports_dir / 'eeg_event_p300.png'}")

    # Alpha 阻断
    t, alpha_block = gen.generate_alpha_blocking()
    gen.save_event_visualization(t, alpha_block, "EEG 事件", "Alpha 阻断",
                                reports_dir / "eeg_event_alpha_blocking.png")
    print(f"已保存: {reports_dir / 'eeg_event_alpha_blocking.png'}")
