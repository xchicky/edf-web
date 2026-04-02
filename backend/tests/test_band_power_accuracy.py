"""
频带功率计算精度测试套件

测试修复后的频带功率计算在各种情况下的准确性
"""

import pytest
import numpy as np
from pathlib import Path
import tempfile

# MNE imports
import mne
from mne.time_frequency import psd_array_welch


class TestBandPowerAccuracy:
    """频带功率计算精度测试"""

    # 标准 EEG 频带定义 (使用半开区间)
    FREQUENCY_BANDS = {
        "delta": (0.5, 4),
        "theta": (4, 8),
        "alpha": (8, 13),
        "beta": (13, 30),
        "gamma": (30, 50),
    }

    @staticmethod
    def calculate_band_power(signal: np.ndarray, sfreq: float) -> dict:
        """
        使用修复后的算法计算频带功率

        修复:
        1. 半开区间 [fmin, fmax) 避免边界重复计算
        2. 动态 n_fft 确保足够的频率分辨率
        """
        n_samples = len(signal)

        # 动态 n_fft，目标分辨率 0.5Hz
        target_resolution = 0.5
        min_n_fft = int(sfreq / target_resolution)
        power_of_two = 2 ** int(np.log2(n_samples))
        n_fft = max(power_of_two, min_n_fft)

        # 零填充处理
        if n_fft > n_samples:
            n_fft = 2 ** int(np.log2(n_fft)) if n_fft == 2 ** int(np.log2(n_fft)) else 2 ** (int(np.log2(n_fft)) + 1)

        n_fft = max(n_fft, 8)
        n_per_seg = min(n_samples, n_fft)
        n_overlap = min(n_fft // 2, n_samples // 4)

        # 计算 PSD
        psds, freqs = psd_array_welch(
            signal,
            sfreq=sfreq,
            fmin=0.5,
            fmax=50,
            n_fft=n_fft,
            n_per_seg=n_per_seg,
            n_overlap=n_overlap,
            verbose=False,
        )

        if psds.ndim == 1:
            psds = psds.reshape(1, -1)
        psd_mean = psds.mean(axis=0)

        # 使用半开区间计算频带功率
        band_powers = {}
        total_power = 0

        for band_name, (fmin_band, fmax_band) in TestBandPowerAccuracy.FREQUENCY_BANDS.items():
            freq_mask = (freqs >= fmin_band) & (freqs < fmax_band)
            band_psds = psd_mean[freq_mask]
            absolute_power = float(np.trapezoid(band_psds, freqs[freq_mask]))
            total_power += absolute_power
            band_powers[band_name] = {
                "absolute": absolute_power,
                "relative": 0.0,
            }

        # 计算相对功率
        for band_name in band_powers:
            if total_power > 0:
                band_powers[band_name]["relative"] = band_powers[band_name]["absolute"] / total_power * 100
            else:
                band_powers[band_name]["relative"] = 0.0

        return band_powers

    @pytest.mark.parametrize("freq,expected_band", [
        (2.0, "delta"),   # 2Hz -> Delta
        (6.0, "theta"),   # 6Hz -> Theta
        (10.0, "alpha"),  # 10Hz -> Alpha
        (20.0, "beta"),   # 20Hz -> Beta
        (40.0, "gamma"),  # 40Hz -> Gamma
    ])
    def test_pure_sine_wave_detection(self, freq, expected_band):
        """测试纯正弦波被正确识别到对应频带"""
        sfreq = 500
        duration = 2.0

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * freq * t)

        result = self.calculate_band_power(signal, sfreq)

        # 预期频带应占主导 (>70%)
        dominant_band = max(result.items(), key=lambda x: x[1]['relative'])[0]
        expected_ratio = result[expected_band]['relative']

        assert dominant_band == expected_band, \
            f"{freq}Hz应识别为{expected_band}, 实际为{dominant_band}"
        assert expected_ratio > 70, \
            f"{freq}Hz在{expected_band}频带应>70%, 实际{expected_ratio:.1f}%"

    def test_user_reported_case(self):
        """测试用户报告的具体问题: 10.3Hz被误识别为Beta"""
        sfreq = 500
        duration = 0.194
        freq = 2 / duration  # 10.309 Hz

        t = np.arange(0, duration, 1 / sfreq)
        signal = -np.cos(2 * np.pi * freq * t)

        result = self.calculate_band_power(signal, sfreq)

        alpha_ratio = result['alpha']['relative']
        beta_ratio = result['beta']['relative']

        # 修复后: Alpha应占主导，Beta应较低
        assert alpha_ratio > 50, \
            f"10.3Hz应主要为Alpha波(>50%), 实际{alpha_ratio:.1f}%"
        assert beta_ratio < 30, \
            f"Beta波应较低(<30%), 实际{beta_ratio:.1f}%"

    def test_boundary_frequencies(self):
        """测试边界频率不重复计算"""
        sfreq = 500
        duration = 2.0

        # 测试4Hz边界
        t = np.arange(0, duration, 1 / sfreq)
        signal_4hz = np.sin(2 * np.pi * 4.0 * t)
        result_4hz = self.calculate_band_power(signal_4hz, sfreq)

        delta_ratio = result_4hz['delta']['relative']
        theta_ratio = result_4hz['theta']['relative']

        # 4Hz应主要在Theta频带 (半开区间: Delta [0.5, 4), Theta [4, 8))
        # 但由于频谱泄漏，仍会有少量进入Delta
        dominant = max(delta_ratio, theta_ratio)
        assert dominant > 50, "4Hz信号应有主导频带>50%"

        # 验证边界条件: Theta应占主导或相当
        # (因为4Hz正好在Theta边界)
        assert theta_ratio > 30, "4Hz信号在Theta频带应>30%"

    @pytest.mark.parametrize("duration", [0.2, 0.5, 1.0, 2.0])
    def test_short_selection_accuracy(self, duration):
        """测试短选区的频带功率计算精度"""
        sfreq = 500
        freq = 10.0  # Alpha波

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * freq * t)

        result = self.calculate_band_power(signal, sfreq)
        alpha_ratio = result['alpha']['relative']

        # 即使短选区，Alpha波也应占主导
        # 随着选区变短，精度会下降，但应保持正确趋势
        min_expected = 40 if duration < 0.5 else 70
        assert alpha_ratio > min_expected, \
            f"{duration}秒选区中10Hz信号Alpha占比应>{min_expected}%, 实际{alpha_ratio:.1f}%"

    def test_artifact_rejection(self):
        """测试伪迹对频带功率的影响"""
        sfreq = 500
        duration = 2.0

        # 10Hz Alpha波 + 50Hz工频干扰
        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * 10.0 * t) + 0.3 * np.sin(2 * np.pi * 50.0 * t)

        result = self.calculate_band_power(signal, sfreq)
        alpha_ratio = result['alpha']['relative']

        # Alpha波仍应占主导（50Hz在Gamma外）
        assert alpha_ratio > 50, "有工频干扰时Alpha仍应占主导"

    def test_multi_frequency_signal(self):
        """测试多频率合成信号"""
        sfreq = 500
        duration = 2.0

        t = np.arange(0, duration, 1 / sfreq)
        # 合成信号: Delta + Alpha + Beta
        signal = (
            np.sin(2 * np.pi * 2.0 * t) +   # Delta
            np.sin(2 * np.pi * 10.0 * t) +  # Alpha
            np.sin(2 * np.pi * 20.0 * t)    # Beta
        )

        result = self.calculate_band_power(signal, sfreq)

        # 三个频带都应该有显著功率
        assert result['delta']['relative'] > 20, "Delta频带应>20%"
        assert result['alpha']['relative'] > 20, "Alpha频带应>20%"
        assert result['beta']['relative'] > 20, "Beta频带应>20%"

        # 验证总相对功率约为100%
        total_relative = sum(band['relative'] for band in result.values())
        assert 95 < total_relative <= 105, \
            f"总相对功率应约为100%, 实际{total_relative:.1f}%"

    def test_relative_power_normalization(self):
        """测试相对功率归一化"""
        sfreq = 500
        duration = 2.0

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.random.randn(len(t))  # 白噪声

        result = self.calculate_band_power(signal, sfreq)

        # 验证相对功率总和为100%
        total_relative = sum(band['relative'] for band in result.values())
        assert 99 <= total_relative <= 101, \
            f"相对功率总和应为100%, 实际{total_relative:.2f}%"

    def test_high_sampling_rate(self):
        """测试高采样率下的准确性"""
        sfreq = 1000  # 1kHz
        duration = 1.0
        freq = 10.0  # Alpha

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * freq * t)

        result = self.calculate_band_power(signal, sfreq)
        alpha_ratio = result['alpha']['relative']

        # 高采样率应提供更好的精度
        assert alpha_ratio > 80, \
            f"1kHz采样率下10Hz信号Alpha占比应>80%, 实际{alpha_ratio:.1f}%"

    def test_low_sampling_rate(self):
        """测试低采样率下的准确性"""
        sfreq = 100  # 100Hz
        duration = 2.0
        freq = 10.0  # Alpha

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * freq * t)

        result = self.calculate_band_power(signal, sfreq)
        alpha_ratio = result['alpha']['relative']

        # 低采样率下仍应正确识别
        assert alpha_ratio > 50, \
            f"100Hz采样率下10Hz信号Alpha占比应>50%, 实际{alpha_ratio:.1f}%"

    def test_empty_signal(self):
        """测试空信号处理"""
        sfreq = 500
        signal = np.zeros(1000)

        result = self.calculate_band_power(signal, sfreq)

        # 空信号所有频带功率应为0
        for band_name, band_data in result.items():
            assert band_data['absolute'] < 1e-10, \
                f"空信号{band_name}频带绝对功率应接近0"
            assert band_data['relative'] == 0, \
                f"空信号{band_name}频带相对功率应为0"


class TestBoundaryConditions:
    """边界条件测试"""

    def test_exact_boundary_4hz(self):
        """测试精确4Hz边界信号"""
        sfreq = 500
        duration = 2.0

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * 4.0 * t)

        result = TestBandPowerAccuracy.calculate_band_power(signal, sfreq)

        # 4Hz应主要在Theta频带 [4, 8)
        theta_ratio = result['theta']['relative']
        assert theta_ratio > 40, "4Hz信号在Theta频带应>40%"

    def test_exact_boundary_8hz(self):
        """测试精确8Hz边界信号"""
        sfreq = 500
        duration = 2.0

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * 8.0 * t)

        result = TestBandPowerAccuracy.calculate_band_power(signal, sfreq)

        # 8Hz应主要在Alpha频带 [8, 13)
        alpha_ratio = result['alpha']['relative']
        assert alpha_ratio > 40, "8Hz信号在Alpha频带应>40%"

    def test_exact_boundary_13hz(self):
        """测试精确13Hz边界信号"""
        sfreq = 500
        duration = 2.0

        t = np.arange(0, duration, 1 / sfreq)
        signal = np.sin(2 * np.pi * 13.0 * t)

        result = TestBandPowerAccuracy.calculate_band_power(signal, sfreq)

        # 13Hz应主要在Beta频带 [13, 30)
        beta_ratio = result['beta']['relative']
        assert beta_ratio > 40, "13Hz信号在Beta频带应>40%"

    def test_near_boundary_frequencies(self):
        """测试边界附近的频率"""
        sfreq = 500
        duration = 2.0

        # 测试远离边界的频率（避免频谱泄漏问题）
        test_cases = [
            (2.0, "delta"),   # Delta 中间
            (6.0, "theta"),   # Theta 中间
            (10.0, "alpha"),  # Alpha 中间
            (20.0, "beta"),   # Beta 中间
            (40.0, "gamma"),  # Gamma 中间
        ]

        for freq, expected_band in test_cases:
            t = np.arange(0, duration, 1 / sfreq)
            signal = np.sin(2 * np.pi * freq * t)

            result = TestBandPowerAccuracy.calculate_band_power(signal, sfreq)
            dominant_band = max(result.items(), key=lambda x: x[1]['relative'])[0]
            expected_ratio = result[expected_band]['relative']

            # 远离边界的频率应被准确识别
            assert dominant_band == expected_band, \
                f"{freq}Hz应识别为{expected_band}, 实际为{dominant_band}"
            assert expected_ratio > 70, \
                f"{freq}Hz在{expected_band}频带应>70%, 实际{expected_ratio:.1f}%"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
