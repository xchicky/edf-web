"""
伪迹和噪声生成器

用于生成各种类型的 EEG 伪迹，测试算法的鲁棒性。
"""

import numpy as np
from typing import Tuple
import matplotlib.pyplot as plt
from pathlib import Path


class ArtifactGenerator:
    """伪迹生成器"""

    def __init__(self, sfreq: float = 500.0):
        """
        Args:
            sfreq: 采样率 (Hz)
        """
        self.sfreq = sfreq

    def add_baseline_wander(
        self,
        signal: np.ndarray,
        amplitude: float = 50.0,
        freq: float = 0.1
    ) -> np.ndarray:
        """
        添加基线漂移 (低频正弦波)

        Args:
            signal: 原始信号
            amplitude: 漂移振幅 (µV)
            freq: 漂移频率 (Hz)，通常 0.05-0.5Hz

        Returns:
            添加漂移后的信号
        """
        drift = np.sin(2 * np.pi * freq * np.arange(len(signal)) / self.sfreq) * amplitude
        return signal + drift

    def add_eye_blink(
        self,
        signal: np.ndarray,
        position: float = 0.5,
        amplitude: float = 200.0,
        duration_ms: float = 200.0
    ) -> np.ndarray:
        """
        添加眼电伪迹 (眼眨)

        Args:
            signal: 原始信号
            position: 眨眼位置 (0-1 之间的比例)
            amplitude: 眨眼振幅 (µV)
            duration_ms: 眨眼持续时间 (毫秒)

        Returns:
            添加眨眼伪迹后的信号
        """
        result = signal.copy()
        n = len(result)
        blink_start = int(position * n)
        blink_duration = int(duration_ms / 1000 * self.sfreq)

        # 使用指数衰减模拟眨眼形状
        blink = amplitude * np.exp(-np.linspace(0, 5, blink_duration))

        end_idx = min(blink_start + blink_duration, n)
        result[blink_start:end_idx] += blink[:end_idx - blink_start]

        return result

    def add_power_line_noise(
        self,
        signal: np.ndarray,
        freq: float = 50.0,
        amplitude: float = 10.0
    ) -> np.ndarray:
        """
        添加工频干扰 (50Hz 或 60Hz)

        Args:
            signal: 原始信号
            freq: 工频 (Hz)，50Hz 或 60Hz
            amplitude: 噪声振幅 (µV)

        Returns:
            添加工频干扰后的信号
        """
        t = np.arange(len(signal))
        noise = amplitude * np.sin(2 * np.pi * freq * t / self.sfreq)
        return signal + noise

    def add_muscle_artifact(
        self,
        signal: np.ndarray,
        position: float = 0.7,
        amplitude: float = 50.0,
        duration_ms: float = 100.0
    ) -> np.ndarray:
        """
        添加肌电伪迹 (高频随机噪声)

        Args:
            signal: 原始信号
            position: 伪迹位置 (0-1)
            amplitude: 振幅 (µV)
            duration_ms: 持续时间 (毫秒)

        Returns:
            添加肌电伪迹后的信号
        """
        result = signal.copy()
        n = len(result)
        artifact_start = int(position * n)
        artifact_duration = int(duration_ms / 1000 * self.sfreq)

        # 高频随机噪声
        artifact = np.random.randn(artifact_duration) * amplitude

        end_idx = min(artifact_start + artifact_duration, n)
        result[artifact_start:end_idx] += artifact[:end_idx - artifact_start]

        return result

    def add_electrode_pop(
        self,
        signal: np.ndarray,
        position: float = 0.3,
        amplitude: float = 500.0
    ) -> np.ndarray:
        """
        添加电极弹出伪迹 (瞬时尖峰)

        Args:
            signal: 原始信号
            position: 伪迹位置 (0-1)
            amplitude: 尖峰振幅 (µV)

        Returns:
            添加电极弹出伪迹后的信号
        """
        result = signal.copy()
        n = len(result)
        pop_idx = int(position * n)

        # 单个采样点的尖峰
        if pop_idx < n:
            result[pop_idx] += amplitude

        return result

    def add_ectopic_beat(
        self,
        signal: np.ndarray,
        position: float = 0.5,
        amplitude: float = 100.0
    ) -> np.ndarray:
        """
        添加异位心跳伪迹 (类似 ECG 伪迹)

        Args:
            signal: 原始信号
            position: 伪迹位置 (0-1)
            amplitude: 振幅 (µV)

        Returns:
            添加心跳伪迹后的信号
        """
        result = signal.copy()
        n = len(result)
        beat_start = int(position * n)
        beat_duration = int(0.3 * self.sfreq)  # 300ms

        # 模拟 QRS 波群
        t = np.linspace(0, 0.3, beat_duration)
        qrs = amplitude * np.exp(-((t - 0.1) ** 2) / 0.001)

        end_idx = min(beat_start + beat_duration, n)
        result[beat_start:end_idx] += qrs[:end_idx - beat_start]

        return result

    def generate_realistic_eeg(
        self,
        duration: float = 10.0,
        alpha_freq: float = 10.0,
        add_artifacts: bool = True
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        生成包含伪迹的"真实"EEG信号

        Args:
            duration: 时长 (秒)
            alpha_freq: Alpha波频率 (Hz)
            add_artifacts: 是否添加伪迹

        Returns:
            (时间数组, 信号数组)
        """
        t = np.arange(0, duration, 1 / self.sfreq)

        # 基础信号: Alpha波 + 少量Theta和Delta
        signal = (
            0.7 * np.sin(2 * np.pi * alpha_freq * t) +  # Alpha主导
            0.2 * np.sin(2 * np.pi * 6 * t) +  # 少量Theta
            0.1 * np.sin(2 * np.pi * 2 * t)  # 少量Delta
        )

        # 添加背景噪声
        signal += 0.05 * np.random.randn(len(t))

        if add_artifacts:
            # 添加基线漂移
            signal = self.add_baseline_wander(signal, amplitude=20)

            # 添加眼眨
            signal = self.add_eye_blink(signal, position=0.2, amplitude=150)
            signal = self.add_eye_blink(signal, position=0.7, amplitude=100)

            # 添加工频干扰
            signal = self.add_power_line_noise(signal, amplitude=5)

            # 添加肌电伪迹
            signal = self.add_muscle_artifact(signal, position=0.5, amplitude=30)

        return t, signal

    def save_artifact_comparison(
        self,
        clean_signal: np.ndarray,
        artifact_signal: np.ndarray,
        title: str,
        artifact_name: str,
        save_path: str | Path
    ):
        """
        保存伪迹对比图

        Args:
            clean_signal: 干净信号
            artifact_signal: 含伪迹信号
            title: 图表标题
            artifact_name: 伪迹名称
            save_path: 保存路径
        """
        fig, axes = plt.subplots(2, 1, figsize=(12, 8))

        t = np.arange(len(clean_signal)) / self.sfreq

        # 干净信号
        axes[0].plot(t, clean_signal)
        axes[0].set_title(f"{title} - 干净信号")
        axes[0].set_xlabel("时间 (秒)")
        axes[0].set_ylabel("振幅 (µV)")
        axes[0].grid(True, alpha=0.3)

        # 含伪迹信号
        axes[1].plot(t, artifact_signal, color='orange')
        axes[1].set_title(f"{title} - 添加{artifact_name}伪迹")
        axes[1].set_xlabel("时间 (秒)")
        axes[1].set_ylabel("振幅 (µV)")
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()


if __name__ == "__main__":
    # 生成示例伪迹
    from synthetic_signals import SyntheticSignalGenerator

    sfreq = 500
    duration = 2.0

    # 生成基础信号
    sig_gen = SyntheticSignalGenerator(sfreq)
    t, clean_signal = sig_gen.generate_sine_wave(freq=10.0, duration=duration)

    # 生成各种伪迹
    art_gen = ArtifactGenerator(sfreq)

    artifacts = {
        "baseline_wander": art_gen.add_baseline_wander(clean_signal.copy()),
        "eye_blink": art_gen.add_eye_blink(clean_signal.copy()),
        "power_line": art_gen.add_power_line_noise(clean_signal.copy()),
        "muscle": art_gen.add_muscle_artifact(clean_signal.copy()),
    }

    # 保存对比图
    save_dir = Path(__file__).parent.parent / "reports" / "images"
    save_dir.mkdir(parents=True, exist_ok=True)

    for name, artifact_signal in artifacts.items():
        save_path = save_dir / f"artifact_{name}.png"
        art_gen.save_artifact_comparison(
            clean_signal,
            artifact_signal,
            "10Hz Alpha波",
            name,
            save_path
        )
        print(f"已保存: {save_path}")

    # 生成真实EEG信号
    t, realistic_eeg = art_gen.generate_realistic_eeg(duration=10.0)
    save_path = save_dir / "realistic_eeg.png"

    fig, ax = plt.subplots(figsize=(12, 4))
    ax.plot(t, realistic_eeg)
    ax.set_title("模拟真实EEG信号 (包含多种伪迹)")
    ax.set_xlabel("时间 (秒)")
    ax.set_ylabel("振幅 (µV)")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"已保存真实EEG信号: {save_path}")
