"""
信号预处理模块

提供各种信号预处理方法，包括去漂移、滤波等。
用户可以在界面上选择不同的预处理选项。
"""

import numpy as np
from typing import Literal, Optional
from scipy import signal
from scipy.signal import savgol_filter


class PreprocessMethod:
    """预处理方法枚举"""
    NONE = "none"
    LINEAR_DETREND = "linear_detrend"
    POLYNOMIAL_DETREND = "polynomial_detrend"
    HIGHPASS_FILTER = "highpass_filter"
    BANDPASS_FILTER = "bandpass_filter"
    BASELINE_CORRECTION = "baseline_correction"


class SignalPreprocessor:
    """信号预处理器"""

    def __init__(self, sfreq: float):
        """
        Args:
            sfreq: 采样率 (Hz)
        """
        self.sfreq = sfreq

    def process(
        self,
        data: np.ndarray,
        method: str = PreprocessMethod.NONE,
        **kwargs
    ) -> np.ndarray:
        """
        处理信号

        Args:
            data: 输入信号
            method: 预处理方法
            **kwargs: 方法特定参数

        Returns:
            处理后的信号
        """
        if method == PreprocessMethod.NONE:
            return data.copy()
        elif method == PreprocessMethod.LINEAR_DETREND:
            return self.linear_detrend(data)
        elif method == PreprocessMethod.POLYNOMIAL_DETREND:
            order = kwargs.get('order', 2)
            return self.polynomial_detrend(data, order=order)
        elif method == PreprocessMethod.HIGHPASS_FILTER:
            cutoff = kwargs.get('cutoff', 0.5)
            return self.highpass_filter(data, cutoff=cutoff)
        elif method == PreprocessMethod.BASELINE_CORRECTION:
            return self.baseline_correction(data)
        else:
            raise ValueError(f"未知的预处理方法: {method}")

    def linear_detrend(self, data: np.ndarray) -> np.ndarray:
        """
        线性去漂移 - 去除线性趋势

        使用最小二乘法拟合线性趋势并减去

        Args:
            data: 输入信号

        Returns:
            去漂移后的信号
        """
        t = np.arange(len(data))
        # 拟合线性趋势: y = a*t + b
        coeffs = np.polyfit(t, data, 1)
        trend = coeffs[0] * t + coeffs[1]
        return data - trend

    def polynomial_detrend(self, data: np.ndarray, order: int = 2) -> np.ndarray:
        """
        多项式去漂移 - 去除多项式趋势

        使用最小二乘法拟合多项式趋势并减去

        Args:
            data: 输入信号
            order: 多项式阶数

        Returns:
            去漂移后的信号
        """
        t = np.arange(len(data))
        # 拟合多项式趋势
        coeffs = np.polyfit(t, data, order)
        trend = np.zeros_like(data, dtype=float)
        for i, coeff in enumerate(coeffs):
            trend += coeff * t ** (order - i)
        return data - trend

    def highpass_filter(
        self,
        data: np.ndarray,
        cutoff: float = 0.5,
        order: int = 4
    ) -> np.ndarray:
        """
        高通滤波 - 去除低频漂移

        使用 Butterworth 高通滤波器

        Args:
            data: 输入信号
            cutoff: 截止频率 (Hz)
            order: 滤波器阶数

        Returns:
            滤波后的信号
        """
        from scipy.signal import butter, filtfilt

        nyquist = self.sfreq / 2
        normal_cutoff = cutoff / nyquist

        # 设计 Butterworth 高通滤波器
        b, a = butter(order, normal_cutoff, btype='high', analog=False)

        # 使用 filtfilt 进行零相位滤波
        filtered = filtfilt(b, a, data)
        return filtered

    def bandpass_filter(
        self,
        data: np.ndarray,
        lowcut: float = 0.5,
        highcut: float = 50.0,
        order: int = 4
    ) -> np.ndarray:
        """
        带通滤波 - 保留特定频率范围

        使用 Butterworth 带通滤波器

        Args:
            data: 输入信号
            lowcut: 低截止频率 (Hz)
            highcut: 高截止频率 (Hz)
            order: 滤波器阶数

        Returns:
            滤波后的信号
        """
        from scipy.signal import butter, filtfilt

        nyquist = self.sfreq / 2
        low = lowcut / nyquist
        high = highcut / nyquist

        # 设计 Butterworth 带通滤波器
        b, a = butter(order, [low, high], btype='band', analog=False)

        # 使用 filtfilt 进行零相位滤波
        filtered = filtfilt(b, a, data)
        return filtered

    def baseline_correction(self, data: np.ndarray, window_size: int = None) -> np.ndarray:
        """
        基线校正 - 使用移动平均去除基线漂移

        Args:
            data: 输入信号
            window_size: 窗口大小 (None 则自动设置为信号长度的 10%)

        Returns:
            基线校正后的信号
        """
        if window_size is None:
            window_size = max(10, len(data) // 10)

        # 确保窗口大小是奇数
        if window_size % 2 == 0:
            window_size += 1

        # 计算移动平均作为基线
        from scipy.signal import savgol_filter
        baseline = savgol_filter(data, window_size, 2)

        # 减去基线
        return data - baseline


# 预处理配置
PREPROCESS_OPTIONS = {
    PreprocessMethod.NONE: {
        "name": "无预处理",
        "description": "保持原始信号",
        "parameters": {}
    },
    PreprocessMethod.LINEAR_DETREND: {
        "name": "线性去漂移",
        "description": "去除线性趋势 (适用于线性漂移)",
        "parameters": {}
    },
    PreprocessMethod.POLYNOMIAL_DETREND: {
        "name": "多项式去漂移",
        "description": "去除多项式趋势 (适用于复杂漂移)",
        "parameters": {
            "order": {
                "type": "int",
                "default": 2,
                "min": 1,
                "max": 5,
                "description": "多项式阶数"
            }
        }
    },
    PreprocessMethod.HIGHPASS_FILTER: {
        "name": "高通滤波",
        "description": "去除低频成分 (适用于低频漂移)",
        "parameters": {
            "cutoff": {
                "type": "float",
                "default": 0.5,
                "min": 0.1,
                "max": 2.0,
                "description": "截止频率 (Hz)"
            }
        }
    },
    PreprocessMethod.BASELINE_CORRECTION: {
        "name": "基线校正",
        "description": "使用移动平均去除基线",
        "parameters": {}
    },
}
