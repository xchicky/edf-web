"""
漂移信号生成器

生成各种类型的漂移信号用于测试 EEG 分析工具的鲁棒性。
"""

import numpy as np
from typing import Tuple, Dict, Any
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path


class DriftGenerator:
    """漂移信号生成器"""

    def __init__(self, sfreq: float = 500.0):
        """
        Args:
            sfreq: 采样率 (Hz)
        """
        self.sfreq = sfreq

    def add_linear_drift(
        self,
        signal: np.ndarray,
        slope: float = 10.0,
        intercept: float = 0.0
    ) -> np.ndarray:
        """
        添加线性漂移

        Args:
            signal: 原始信号
            slope: 斜率 (µV/秒)
            intercept: 截距 (µV)

        Returns:
            添加漂移后的信号
        """
        t = np.arange(len(signal)) / self.sfreq
        drift = slope * t + intercept
        return signal + drift

    def add_exponential_drift(
        self,
        signal: np.ndarray,
        amplitude: float = 50.0,
        rate: float = 0.5
    ) -> np.ndarray:
        """
        添加指数漂移

        Args:
            signal: 原始信号
            amplitude: 漂移幅度 (µV)
            rate: 指数增长率 (1/秒)

        Returns:
            添加漂移后的信号
        """
        t = np.arange(len(signal)) / self.sfreq
        drift = amplitude * (np.exp(rate * t) - 1)
        return signal + drift

    def add_polynomial_drift(
        self,
        signal: np.ndarray,
        coefficients: Tuple[float, ...] = (0.1, 0.5)
    ) -> np.ndarray:
        """
        添加多项式漂移

        Args:
            signal: 原始信号
            coefficients: 多项式系数 (c1, c2, ...)，表示 c1*t + c2*t^2 + ...

        Returns:
            添加漂移后的信号
        """
        t = np.arange(len(signal)) / self.sfreq
        drift = np.zeros_like(t)

        for i, coef in enumerate(coefficients, start=1):
            drift += coef * (t ** i)

        return signal + drift

    def add_sinusoidal_drift(
        self,
        signal: np.ndarray,
        amplitude: float = 20.0,
        freq: float = 0.1,
        phase: float = 0.0
    ) -> np.ndarray:
        """
        添加正弦漂移 (超低频正弦波)

        Args:
            signal: 原始信号
            amplitude: 漂移幅度 (µV)
            freq: 漂移频率 (Hz)，通常 < 1Hz
            phase: 相位 (弧度)

        Returns:
            添加漂移后的信号
        """
        t = np.arange(len(signal)) / self.sfreq
        drift = amplitude * np.sin(2 * np.pi * freq * t + phase)
        return signal + drift

    def add_combined_drift(
        self,
        signal: np.ndarray,
        linear_slope: float = 5.0,
        exp_amplitude: float = 20.0,
        exp_rate: float = 0.3,
        sine_amplitude: float = 10.0,
        sine_freq: float = 0.1
    ) -> np.ndarray:
        """
        添加组合漂移 (线性 + 指数 + 正弦)

        Args:
            signal: 原始信号
            linear_slope: 线性漂移斜率
            exp_amplitude: 指数漂移幅度
            exp_rate: 指数增长率
            sine_amplitude: 正弦漂移幅度
            sine_freq: 正弦漂移频率

        Returns:
            添加漂移后的信号
        """
        result = self.add_linear_drift(signal, slope=linear_slope)
        result = self.add_exponential_drift(result, amplitude=exp_amplitude, rate=exp_rate)
        result = self.add_sinusoidal_drift(result, amplitude=sine_amplitude, freq=sine_freq)
        return result

    def save_drift_comparison(
        self,
        clean_signal: np.ndarray,
        drifted_signal: np.ndarray,
        title: str,
        drift_type: str,
        save_path: str
    ):
        """
        保存漂移对比图

        Args:
            clean_signal: 干净信号
            drifted_signal: 含漂移信号
            title: 图表标题
            drift_type: 漂移类型名称
            save_path: 保存路径
        """
        t = np.arange(len(clean_signal)) / self.sfreq

        fig, axes = plt.subplots(3, 1, figsize=(12, 10))

        # 干净信号
        axes[0].plot(t, clean_signal, 'b-', linewidth=0.8)
        axes[0].set_ylabel('振幅 (µV)')
        axes[0].set_title(f'{title} - 干净信号')
        axes[0].grid(True, alpha=0.3)

        # 含漂移信号
        axes[1].plot(t, drifted_signal, 'r-', linewidth=0.8)
        axes[1].set_ylabel('振幅 (µV)')
        axes[1].set_title(f'{title} - 添加{drift_type}漂移')
        axes[1].grid(True, alpha=0.3)

        # 重叠对比
        axes[2].plot(t, clean_signal, 'b-', linewidth=0.5, label='干净信号', alpha=0.7)
        axes[2].plot(t, drifted_signal, 'r-', linewidth=0.5, label='含漂移信号', alpha=0.7)
        axes[2].set_xlabel('时间 (秒)')
        axes[2].set_ylabel('振幅 (µV)')
        axes[2].set_title('重叠对比')
        axes[2].legend()
        axes[2].grid(True, alpha=0.3)

        plt.tight_layout()
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()


# 测试用例配置
DRIFT_TEST_CASES = {
    "linear_mild": {
        "type": "linear",
        "params": {"slope": 5.0},
        "description": "温和线性漂移 (5 µV/s)"
    },
    "linear_severe": {
        "type": "linear",
        "params": {"slope": 50.0},
        "description": "严重线性漂移 (50 µV/s)"
    },
    "exponential_mild": {
        "type": "exponential",
        "params": {"amplitude": 20.0, "rate": 0.3},
        "description": "温和指数漂移"
    },
    "exponential_severe": {
        "type": "exponential",
        "params": {"amplitude": 100.0, "rate": 0.8},
        "description": "严重指数漂移"
    },
    "polynomial_quadratic": {
        "type": "polynomial",
        "params": {"coefficients": (0.1, 0.5)},
        "description": "二次多项式漂移"
    },
    "polynomial_cubic": {
        "type": "polynomial",
        "params": {"coefficients": (0.1, 0.2, 0.1)},
        "description": "三次多项式漂移"
    },
    "sinusoidal_slow": {
        "type": "sinusoidal",
        "params": {"amplitude": 20.0, "freq": 0.05},
        "description": "慢速正弦漂移 (0.05 Hz)"
    },
    "sinusoidal_fast": {
        "type": "sinusoidal",
        "params": {"amplitude": 30.0, "freq": 0.2},
        "description": "快速正弦漂移 (0.2 Hz)"
    },
    "combined_mild": {
        "type": "combined",
        "params": {
            "linear_slope": 3.0,
            "exp_amplitude": 10.0,
            "exp_rate": 0.2,
            "sine_amplitude": 5.0,
            "sine_freq": 0.1
        },
        "description": "温和组合漂移"
    },
    "combined_severe": {
        "type": "combined",
        "params": {
            "linear_slope": 20.0,
            "exp_amplitude": 50.0,
            "exp_rate": 0.5,
            "sine_amplitude": 20.0,
            "sine_freq": 0.15
        },
        "description": "严重组合漂移"
    },
}


def generate_drift_signal_test(
    sfreq: float = 500.0,
    duration: float = 2.0,
    base_freq: float = 10.0
) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    """
    生成漂移信号测试案例

    Args:
        sfreq: 采样率
        duration: 时长 (秒)
        base_freq: 基础信号频率 (Hz)

    Returns:
        (时间数组, 干净信号, 漂移信号字典)
    """
    t = np.arange(0, duration, 1 / sfreq)
    clean_signal = np.sin(2 * np.pi * base_freq * t)

    generator = DriftGenerator(sfreq)

    drifted_signals = {}
    for case_name, case_config in DRIFT_TEST_CASES.items():
        drift_type = case_config["type"]
        params = case_config["params"]

        if drift_type == "linear":
            drifted = generator.add_linear_drift(clean_signal.copy(), **params)
        elif drift_type == "exponential":
            drifted = generator.add_exponential_drift(clean_signal.copy(), **params)
        elif drift_type == "polynomial":
            drifted = generator.add_polynomial_drift(clean_signal.copy(), **params)
        elif drift_type == "sinusoidal":
            drifted = generator.add_sinusoidal_drift(clean_signal.copy(), **params)
        elif drift_type == "combined":
            drifted = generator.add_combined_drift(clean_signal.copy(), **params)
        else:
            drifted = clean_signal.copy()

        drifted_signals[case_name] = {
            "signal": drifted,
            "type": drift_type,
            "params": params,
            "description": case_config["description"]
        }

    return t, clean_signal, drifted_signals


if __name__ == "__main__":
    # 生成示例漂移信号
    print("生成漂移信号示例...")

    t, clean, drifted = generate_drift_signal_test(
        sfreq=500, duration=5.0, base_freq=10.0
    )

    print(f"生成了 {len(drifted)} 种漂移信号:")
    for name, data in drifted.items():
        print(f"  - {name}: {data['description']}")

    # 保存对比图
    reports_dir = Path(__file__).parent.parent.parent / "exp" / "reports" / "images"
    reports_dir.mkdir(parents=True, exist_ok=True)

    gen = DriftGenerator(500)

    # 保存线性漂移示例
    linear_signal = gen.add_linear_drift(clean.copy(), slope=20.0)
    gen.save_drift_comparison(
        clean, linear_signal,
        "10Hz Alpha波", "线性",
        reports_dir / "drift_linear_example.png"
    )
    print(f"\n已保存: {reports_dir / 'drift_linear_example.png'}")

    # 保存组合漂移示例
    combined_signal = gen.add_combined_drift(clean.copy())
    gen.save_drift_comparison(
        clean, combined_signal,
        "10Hz Alpha波", "组合",
        reports_dir / "drift_combined_example.png"
    )
    print(f"已保存: {reports_dir / 'drift_combined_example.png'}")
