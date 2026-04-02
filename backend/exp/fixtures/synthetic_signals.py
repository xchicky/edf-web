"""
合成信号生成器

用于生成纯正弦波等测试信号，验证频带分析算法的正确性。
"""

import numpy as np
from typing import Tuple
import matplotlib.pyplot as plt
from pathlib import Path


class SyntheticSignalGenerator:
    """合成信号生成器"""

    def __init__(self, sfreq: float = 500.0):
        """
        Args:
            sfreq: 采样率 (Hz)，默认 500Hz
        """
        self.sfreq = sfreq

    def generate_sine_wave(
        self,
        freq: float,
        duration: float,
        amplitude: float = 1.0,
        phase: float = 0.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成纯正弦波

        Args:
            freq: 频率 (Hz)
            duration: 时长 (秒)
            amplitude: 振幅
            phase: 相位 (弧度)

        Returns:
            (时间数组, 信号数组)
        """
        t = np.arange(0, duration, 1 / self.sfreq)
        signal = amplitude * np.sin(2 * np.pi * freq * t + phase)
        return t, signal

    def generate_multi_frequency(
        self,
        freqs: list[float],
        amplitudes: list[float] | None = None,
        duration: float = 2.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成多频率合成信号

        Args:
            freqs: 频率列表
            amplitudes: 对应的振幅列表，默认全部为 1.0
            duration: 时长

        Returns:
            (时间数组, 信号数组)
        """
        if amplitudes is None:
            amplitudes = [1.0] * len(freqs)

        t = np.arange(0, duration, 1 / self.sfreq)
        signal = np.zeros_like(t)

        for freq, amp in zip(freqs, amplitudes):
            signal += amp * np.sin(2 * np.pi * freq * t)

        # 归一化
        signal = signal / np.max(np.abs(signal))
        return t, signal

    def generate_user_case_signal(self) -> Tuple[np.ndarray, np.ndarray, dict]:
        """
        生成用户报告的问题案例

        用户选择: 波谷-波峰-波谷-波峰-波谷 (2个完整波形)
        时长: 0.194秒
        计算频率: 2/0.194 = 10.3Hz (Alpha波)

        Returns:
            (时间数组, 信号数组, 元数据字典)
        """
        duration = 0.194
        freq = 10.3

        t, signal = self.generate_sine_wave(freq, duration)

        metadata = {
            "frequency": freq,
            "duration": duration,
            "expected_band": "alpha",
            "expected_band_range": [8, 13],
            "description": "用户报告案例: 10.3Hz Alpha波被错误识别为Beta波"
        }

        return t, signal, metadata

    def save_signal_plot(
        self,
        t: np.ndarray,
        signal: np.ndarray,
        title: str,
        save_path: str | Path
    ):
        """
        保存信号波形图

        Args:
            t: 时间数组
            signal: 信号数组
            title: 图表标题
            save_path: 保存路径
        """
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        # 时域波形
        axes[0].plot(t, signal)
        axes[0].set_xlabel("时间 (秒)")
        axes[0].set_ylabel("振幅 (µV)")
        axes[0].set_title(f"{title} - 时域波形")
        axes[0].grid(True, alpha=0.3)

        # 频域分析 (FFT)
        from scipy import signal as scipy_signal
        freqs, psd = scipy_signal.welch(signal, self.sfreq, nperseg=min(256, len(signal)))

        axes[1].semilogy(freqs, psd)
        axes[1].set_xlabel("频率 (Hz)")
        axes[1].set_ylabel("功率谱密度")
        axes[1].set_title(f"{title} - 频域分析")
        axes[1].axvspan(0.5, 4, alpha=0.2, color='purple', label='Delta')
        axes[1].axvspan(4, 8, alpha=0.2, color='blue', label='Theta')
        axes[1].axvspan(8, 13, alpha=0.2, color='green', label='Alpha')
        axes[1].axvspan(13, 30, alpha=0.2, color='orange', label='Beta')
        axes[1].axvspan(30, 50, alpha=0.2, color='red', label='Gamma')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        axes[1].set_xlim(0, 50)

        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()


# 测试用例配置
TEST_CASES = {
    "pure_delta_2hz": {
        "freq": 2.0,
        "expected_band": "delta",
        "expected_ratio": 0.90,
        "description": "2Hz Delta波"
    },
    "pure_theta_6hz": {
        "freq": 6.0,
        "expected_band": "theta",
        "expected_ratio": 0.90,
        "description": "6Hz Theta波"
    },
    "pure_alpha_10hz": {
        "freq": 10.0,
        "expected_band": "alpha",
        "expected_ratio": 0.90,
        "description": "10Hz Alpha波"
    },
    "pure_beta_20hz": {
        "freq": 20.0,
        "expected_band": "beta",
        "expected_ratio": 0.90,
        "description": "20Hz Beta波"
    },
    "user_case_10.3hz": {
        "freq": 10.3,
        "duration": 0.194,
        "expected_band": "alpha",
        "expected_ratio": 0.70,
        "description": "用户案例: 10.3Hz, 0.194秒选区"
    },
    "boundary_4hz": {
        "freq": 4.0,
        "expected_band": "theta",
        "expected_ratio": 0.70,
        "description": "边界频率: 4Hz (Delta/Theta边界)"
    },
    "boundary_8hz": {
        "freq": 8.0,
        "expected_band": "alpha",
        "expected_ratio": 0.70,
        "description": "边界频率: 8Hz (Theta/Alpha边界)"
    },
    "boundary_13hz": {
        "freq": 13.0,
        "expected_band": "beta",
        "expected_ratio": 0.70,
        "description": "边界频率: 13Hz (Alpha/Beta边界)"
    },
}


if __name__ == "__main__":
    # 生成用户案例信号并保存
    gen = SyntheticSignalGenerator(sfreq=500)
    t, signal, metadata = gen.generate_user_case_signal()

    print(f"生成用户案例信号:")
    print(f"  频率: {metadata['frequency']} Hz")
    print(f"  时长: {metadata['duration']} 秒")
    print(f"  期望频带: {metadata['expected_band']} ({metadata['expected_band_range']} Hz)")
    print(f"  样本数: {len(signal)}")

    # 保存图片
    save_path = Path(__file__).parent.parent / "reports" / "images" / "user_case_signal.png"
    save_path.parent.mkdir(parents=True, exist_ok=True)
    gen.save_signal_plot(t, signal, metadata['description'], save_path)
    print(f"\n图片已保存: {save_path}")
