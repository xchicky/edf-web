"""
指标工具模块测试

TDD: 先写测试，再实现功能
"""

import pytest
import numpy as np
from pathlib import Path
import sys

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))


class TestSignalToNoiseRatio:
    """测试信噪比计算"""

    def test_clean_signal(self):
        """测试纯净信号的高 SNR"""
        # 纯净的正弦波，SNR 应该很高
        sfreq = 500
        t = np.arange(0, 1, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10 * t)

        from exp.utils.metrics import calculate_snr
        snr = calculate_snr(signal)

        # 纯净信号 SNR 应该 > 40dB
        assert snr > 40, f"纯净信号 SNR 应 > 40dB, 实际 {snr:.2f}dB"

    def test_noisy_signal(self):
        """测试含噪信号的低 SNR"""
        sfreq = 500
        t = np.arange(0, 1, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10 * t) + 0.5 * np.random.randn(len(t))

        from exp.utils.metrics import calculate_snr
        snr = calculate_snr(signal)

        # 含噪信号 SNR 应该较低
        assert 0 < snr < 30, f"含噪信号 SNR 应在 0-30dB, 实际 {snr:.2f}dB"

    def test_zero_signal(self):
        """测试零信号的 SNR"""
        signal = np.zeros(1000)

        from exp.utils.metrics import calculate_snr
        snr = calculate_snr(signal)

        # 零信号 SNR 应该为 0 或负无穷
        assert snr <= 0, "零信号 SNR 应 <= 0dB"


class TestMeanSquaredError:
    """测试均方误差计算"""

    def test_identical_signals(self):
        """测试相同信号的 MSE 应为 0"""
        signal = np.random.randn(1000)

        from exp.utils.metrics import calculate_mse
        mse = calculate_mse(signal, signal)

        assert mse == 0, f"相同信号 MSE 应为 0, 实际 {mse}"

    def test_different_signals(self):
        """测试不同信号的 MSE"""
        signal1 = np.ones(1000)
        signal2 = np.zeros(1000)

        from exp.utils.metrics import calculate_mse
        mse = calculate_mse(signal1, signal2)

        assert mse == 1, f"全1和全0信号 MSE 应为 1, 实际 {mse}"

    def test_scaled_signal(self):
        """测试缩放信号的 MSE"""
        signal1 = np.ones(1000)
        signal2 = 2 * np.ones(1000)

        from exp.utils.metrics import calculate_mse
        mse = calculate_mse(signal1, signal2)

        assert mse == 1, f"1和2信号 MSE 应为 1, 实际 {mse}"


class TestBandPowerError:
    """测试频带功率误差计算"""

    def test_exact_match(self):
        """测试精确匹配"""
        expected = {"delta": 10, "theta": 20, "alpha": 50, "beta": 15, "gamma": 5}
        actual = {"delta": {"relative": 10}, "theta": {"relative": 20},
                  "alpha": {"relative": 50}, "beta": {"relative": 15}, "gamma": {"relative": 5}}

        from exp.utils.metrics import band_power_error
        error = band_power_error(expected, actual)

        assert error < 1e-6, f"精确匹配误差应接近 0, 实际 {error}"

    def test_small_error(self):
        """测试小误差"""
        expected = {"delta": 10, "theta": 20, "alpha": 50, "beta": 15, "gamma": 5}
        actual = {"delta": {"relative": 11}, "theta": {"relative": 19},
                  "alpha": {"relative": 51}, "beta": {"relative": 14}, "gamma": {"relative": 5}}

        from exp.utils.metrics import band_power_error
        error = band_power_error(expected, actual)

        # 相对误差应该较小
        assert error < 5, f"小误差情况应 < 5%, 实际 {error:.2f}%"

    def test_large_error(self):
        """测试大误差"""
        expected = {"delta": 10, "theta": 20, "alpha": 50, "beta": 15, "gamma": 5}
        actual = {"delta": {"relative": 50}, "theta": {"relative": 20},
                  "alpha": {"relative": 10}, "beta": {"relative": 10}, "gamma": {"relative": 10}}

        from exp.utils.metrics import band_power_error
        error = band_power_error(expected, actual)

        # 误差应该较大
        assert error > 20, f"大误差情况应 > 20%, 实际 {error:.2f}%"


class TestDominantBandAccuracy:
    """测试主导频带识别准确性"""

    def test_alpha_dominant(self):
        """测试 Alpha 波主导"""
        band_powers = {
            "delta": {"relative": 5},
            "theta": {"relative": 10},
            "alpha": {"relative": 70},
            "beta": {"relative": 10},
            "gamma": {"relative": 5},
        }
        expected = "alpha"

        from exp.utils.metrics import dominant_band_accuracy
        accuracy = dominant_band_accuracy(band_powers, expected)

        assert accuracy == 1.0, f"正确识别应返回 1.0, 实际 {accuracy}"

    def test_wrong_dominant(self):
        """测试错误识别"""
        band_powers = {
            "delta": {"relative": 5},
            "theta": {"relative": 10},
            "alpha": {"relative": 70},
            "beta": {"relative": 10},
            "gamma": {"relative": 5},
        }
        expected = "beta"  # 实际是 alpha

        from exp.utils.metrics import dominant_band_accuracy
        accuracy = dominant_band_accuracy(band_powers, expected)

        assert accuracy == 0.0, f"错误识别应返回 0.0, 实际 {accuracy}"

    def test_tie_break(self):
        """测试平局情况（返回 0.5）"""
        band_powers = {
            "delta": {"relative": 30},
            "theta": {"relative": 30},
            "alpha": {"relative": 10},
            "beta": {"relative": 15},
            "gamma": {"relative": 15},
        }
        expected = "delta"  # 和 theta 平局

        from exp.utils.metrics import dominant_band_accuracy
        accuracy = dominant_band_accuracy(band_powers, expected)

        # 平局时返回 0.5
        assert accuracy == 0.5, f"平局情况应返回 0.5, 实际 {accuracy}"


class TestSpectralCentroid:
    """测试频谱质心计算"""

    def test_low_frequency_signal(self):
        """测试低频信号"""
        sfreq = 500
        t = np.arange(0, 1, 1 / sfreq)
        signal = np.sin(2 * np.pi * 5 * t)  # 5Hz

        from exp.utils.metrics import spectral_centroid
        centroid = spectral_centroid(signal, sfreq)

        # 质心应该接近 5Hz
        assert 3 < centroid < 7, f"5Hz 信号质心应在 3-7Hz, 实际 {centroid:.2f}Hz"

    def test_high_frequency_signal(self):
        """测试高频信号"""
        sfreq = 500
        t = np.arange(0, 1, 1 / sfreq)
        signal = np.sin(2 * np.pi * 30 * t)  # 30Hz

        from exp.utils.metrics import spectral_centroid
        centroid = spectral_centroid(signal, sfreq)

        # 质心应该接近 30Hz
        assert 25 < centroid < 35, f"30Hz 信号质心应在 25-35Hz, 实际 {centroid:.2f}Hz"


class TestSpectralFlatness:
    """测试频谱平坦度计算"""

    def test_tone_signal(self):
        """测试纯音信号（低平坦度）"""
        sfreq = 500
        t = np.arange(0, 1, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10 * t)

        from exp.utils.metrics import spectral_flatness
        flatness = spectral_flatness(signal, sfreq)

        # 纯音的频谱平坦度应该很低（接近 0）
        assert flatness < 0.3, f"纯音平坦度应 < 0.3, 实际 {flatness:.3f}"

    def test_noise_signal(self):
        """测试噪声信号（高平坦度）"""
        sfreq = 500
        # 使用更长的信号以获得更准确的平坦度
        signal = np.random.randn(2000)

        from exp.utils.metrics import spectral_flatness
        flatness = spectral_flatness(signal, sfreq)

        # 白噪声的频谱平坦度应该较高（接近 1）
        assert flatness > 0.4, f"噪声平坦度应 > 0.4, 实际 {flatness:.3f}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
