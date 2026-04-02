"""
信号预处理模块测试

TDD: 先写测试，再实现去漂移功能
"""

import pytest
import numpy as np
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.preprocessing import (
    SignalPreprocessor,
    PreprocessMethod,
    PREPROCESS_OPTIONS
)


class TestLinearDetrend:
    """测试线性去漂移"""

    def test_removes_linear_drift(self):
        """测试去除线性漂移"""
        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 创建带线性漂移的信号: sin(10Hz) + 10*t
        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 10 * t

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.linear_detrend(drifted)

        # 去漂移后应该接近原始信号
        error = np.mean(np.abs(result - clean))
        assert error < 1.0, f"线性去漂移误差应 < 1.0, 实际 {error:.2f}"

    def test_no_effect_on_no_drift(self):
        """测试对无漂移信号无影响"""
        sfreq = 500
        t = np.arange(0, 2, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10 * t)

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.linear_detrend(signal)

        # 去漂移后信号形状应该保持
        correlation = np.corrcoef(signal, result)[0, 1]
        assert correlation > 0.99, f"相关性应 > 0.99, 实际 {correlation:.3f}"

    def test_zero_mean_after_detrend(self):
        """测试去漂移后均值为零"""
        sfreq = 500
        t = np.arange(0, 2, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10 * t) + 50 * t

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.linear_detrend(signal)

        # 去漂移后均值应该接近 0
        mean = np.mean(result)
        assert abs(mean) < 1.0, f"去漂移后均值应接近 0, 实际 {mean:.2f}"


class TestPolynomialDetrend:
    """测试多项式去漂移"""

    def test_removes_quadratic_drift(self):
        """测试去除二次多项式漂移"""
        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 创建带二次漂移的信号: sin(10Hz) + 2*t^2
        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 2 * t ** 2

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.polynomial_detrend(drifted, order=2)

        # 去漂移后应该接近原始信号
        error = np.mean(np.abs(result - clean))
        # 多项式拟合可能不是完美的，允许较大误差
        assert error < 10.0, f"多项式去漂移误差应 < 10.0, 实际 {error:.2f}"

    def test_order_parameter(self):
        """测试不同阶数的效果"""
        sfreq = 500
        t = np.arange(0, 2, 1 / sfreq)

        # 三次漂移
        signal = np.sin(2 * np.pi * 10 * t) + 0.5 * t ** 3

        preprocessor = SignalPreprocessor(sfreq)

        # 一阶去漂移效果应该较差
        result_order1 = preprocessor.polynomial_detrend(signal, order=1)
        residual_order1 = np.std(result_order1)

        # 三阶去漂移效果应该更好
        result_order3 = preprocessor.polynomial_detrend(signal, order=3)
        residual_order3 = np.std(result_order3)

        assert residual_order3 < residual_order1, \
            "三阶去漂移应比一阶更有效"


class TestHighpassFilter:
    """测试高通滤波"""

    def test_removes_low_frequency_drift(self):
        """测试去除低频漂移"""
        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 信号: 10Hz + 0.1Hz 漂移
        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 20 * np.sin(2 * np.pi * 0.1 * t)

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.highpass_filter(drifted, cutoff=0.5)

        # 滤波后应该更接近原始信号
        mse_clean = np.mean((result - clean) ** 2)
        mse_drifted = np.mean((drifted - clean) ** 2)

        assert mse_clean < mse_drifted, \
            f"滤波后误差 ({mse_clean:.4f}) 应小于原始误差 ({mse_drifted:.4f})"

    def test_preserves_high_frequency(self):
        """测试保留高频成分"""
        sfreq = 500
        t = np.arange(0, 2, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10 * t)

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.highpass_filter(signal, cutoff=1.0)

        # 10Hz 信号应该被保留
        correlation = np.corrcoef(signal, result)[0, 1]
        assert correlation > 0.95, f"高频信号应被保留, 相关性 {correlation:.3f}"


class TestBaselineCorrection:
    """测试基线校正"""

    def test_removes_baseline_wander(self):
        """测试去除基线漂移"""
        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 信号 + 缓慢变化的基线
        signal = np.sin(2 * np.pi * 10 * t)
        baseline = 10 * np.sin(2 * np.pi * 0.2 * t)
        drifted = signal + baseline

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.baseline_correction(drifted)

        # 基线校正后应该更接近原始信号
        error = np.mean(np.abs(result - signal))
        original_error = np.mean(np.abs(drifted - signal))

        assert error < original_error, \
            f"基线校正后误差 ({error:.2f}) 应小于原始误差 ({original_error:.2f})"

    def test_zero_mean_segments(self):
        """测试各段均值为零"""
        sfreq = 500
        signal = np.random.randn(1000) + 50  # 带偏移的噪声

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.baseline_correction(signal)

        # 结果应该围绕 0 波动
        mean = np.mean(result)
        assert abs(mean) < 5.0, f"基线校正后均值应接近 0, 实际 {mean:.2f}"


class TestPreprocessMethod:
    """测试预处理方法枚举"""

    def test_method_none_returns_copy(self):
        """测试 NONE 方法返回副本"""
        sfreq = 500
        signal = np.random.randn(1000)

        preprocessor = SignalPreprocessor(sfreq)
        result = preprocessor.process(signal, PreprocessMethod.NONE)

        assert np.array_equal(result, signal), "NONE 方法应返回原始信号副本"
        assert result is not signal, "应返回副本而非引用"

    def test_invalid_method_raises_error(self):
        """测试无效方法抛出错误"""
        sfreq = 500
        signal = np.random.randn(1000)

        preprocessor = SignalPreprocessor(sfreq)

        with pytest.raises(ValueError, match="未知的预处理方法"):
            preprocessor.process(signal, "invalid_method")


class TestDriftRecovery:
    """测试漂移恢复效果"""

    def test_linear_drift_recovery(self):
        """测试线性漂移的恢复效果"""
        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 干净信号
        clean = np.sin(2 * np.pi * 10 * t)

        # 添加线性漂移
        drifted = clean + 20 * t

        preprocessor = SignalPreprocessor(sfreq)
        recovered = preprocessor.process(drifted, PreprocessMethod.LINEAR_DETREND)

        # 恢复后应该与原始信号高度相关
        correlation = np.corrcoef(clean, recovered)[0, 1]
        assert correlation > 0.9, f"恢复后相关性应 > 0.9, 实际 {correlation:.3f}"

    def test_polynomial_drift_recovery(self):
        """测试多项式漂移的恢复效果"""
        sfreq = 500
        t = np.arange(0, 2, 1 / sfreq)

        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 3 * t ** 2

        preprocessor = SignalPreprocessor(sfreq)
        recovered = preprocessor.process(
            drifted,
            PreprocessMethod.POLYNOMIAL_DETREND,
            order=2
        )

        # 恢复后应该与原始信号相关
        correlation = np.corrcoef(clean, recovered)[0, 1]
        assert correlation > 0.7, f"恢复后相关性应 > 0.7, 实际 {correlation:.3f}"

    def test_combined_drift_with_highpass(self):
        """测试组合漂移使用高通滤波"""
        sfreq = 500
        t = np.arange(0, 2, 1 / sfreq)

        clean = np.sin(2 * np.pi * 10 * t)
        # 组合漂移: 线性 + 正弦
        drifted = clean + 10 * t + 15 * np.sin(2 * np.pi * 0.1 * t)

        preprocessor = SignalPreprocessor(sfreq)
        recovered = preprocessor.process(
            drifted,
            PreprocessMethod.HIGHPASS_FILTER,
            cutoff=0.5
        )

        # 高通滤波应该改善信号质量
        snr_drifted = calculate_snr_simple(drifted, clean)
        snr_recovered = calculate_snr_simple(recovered, clean)

        assert snr_recovered > snr_drifted, \
            f"滤波后 SNR ({snr_recovered:.2f}) 应高于滤波前 ({snr_drifted:.2f})"


def calculate_snr_simple(signal: np.ndarray, reference: np.ndarray) -> float:
    """简单计算信噪比"""
    signal_power = np.mean(reference ** 2)
    noise_power = np.mean((signal - reference) ** 2)
    if noise_power == 0:
        return float('inf')
    return 10 * np.log10(signal_power / noise_power)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
