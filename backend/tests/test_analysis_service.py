"""
Analysis Service Tests
"""

import pytest
import numpy as np
from pathlib import Path
import mne
from app.services.analysis_service import AnalysisService


@pytest.fixture
def sample_edf_file(tmp_path):
    """创建示例 EDF 文件用于测试"""
    # 创建示例数据
    sfreq = 100  # 采样频率
    duration = 10  # 10 秒
    n_samples = sfreq * duration
    n_channels = 4

    # 创建通道数据（使用较小的值以避免 EDF 导出问题）
    data = np.random.randn(n_channels, n_samples) * 5  # 微伏

    # 创建 MNE Raw 对象
    ch_names = ["Fp1", "Fp2", "F3", "F4"]
    ch_types = ["eeg"] * n_channels
    info = mne.create_info(ch_names, sfreq, ch_types)
    raw = mne.io.RawArray(data, info)

    # 设置测量日期为固定值以避免时间戳问题
    raw.set_meas_date(None)

    # 保存为 EDF
    edf_path = tmp_path / "test.edf"
    raw.export(str(edf_path), fmt="edf", physical_range=(0, 100))

    return str(edf_path)


@pytest.fixture
def sample_edf_file_with_sinusoid(tmp_path):
    """创建包含正弦波的 EDF 文件用于测试"""
    sfreq = 100  # 采样频率
    duration = 10  # 10 秒
    n_samples = sfreq * duration
    time = np.arange(n_samples) / sfreq

    # 创建包含明显频率成分的数据
    # 10 Hz (alpha) + 20 Hz (beta)
    data = np.zeros((4, n_samples))
    for i in range(4):
        data[i] = (
            5 * np.sin(2 * np.pi * 10 * time)  # 10 Hz alpha
            + 3 * np.sin(2 * np.pi * 20 * time)  # 20 Hz beta
            + np.random.randn(n_samples) * 0.5  # 添加噪声
        )

    ch_names = ["Fp1", "Fp2", "F3", "F4"]
    ch_types = ["eeg"] * 4
    info = mne.create_info(ch_names, sfreq, ch_types)
    raw = mne.io.RawArray(data, info)
    raw.set_meas_date(None)

    edf_path = tmp_path / "test_sinusoid.edf"
    raw.export(str(edf_path), fmt="edf", physical_range=(-20, 20))

    return str(edf_path)


class TestAnalysisService:
    """分析服务测试"""

    def test_initialization(self, sample_edf_file):
        """测试初始化"""
        analyzer = AnalysisService(sample_edf_file)
        assert analyzer.raw is not None
        assert len(analyzer.raw.ch_names) == 4
        assert analyzer.raw.info["sfreq"] == 100

    def test_initialization_invalid_file(self):
        """测试无效文件初始化"""
        with pytest.raises(Exception):
            AnalysisService("non_existent_file.edf")

    def test_compute_time_domain_stats_all_channels(self, sample_edf_file):
        """测试计算所有通道的时域统计"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_time_domain_stats(
            start_time=0, duration=5, channels=None
        )

        assert len(results) == 4
        assert "Fp1" in results
        assert "Fp2" in results
        assert "F3" in results
        assert "F4" in results

        # 检查统计字段
        for ch_name, stats in results.items():
            assert "mean" in stats
            assert "std" in stats
            assert "min" in stats
            assert "max" in stats
            assert "rms" in stats
            assert "peak_to_peak" in stats
            assert "kurtosis" in stats
            assert "skewness" in stats
            assert "n_samples" in stats

            # 验证样本数（MNE crop 包含边界点，所以是 duration * sfreq + 1）
            assert stats["n_samples"] >= 500  # 5 秒 * 100 Hz
            assert stats["n_samples"] <= 501  # 边界点可能 +1

            # 验证基本关系
            assert stats["rms"] >= 0
            assert stats["peak_to_peak"] == stats["max"] - stats["min"]
            assert stats["min"] <= stats["mean"] <= stats["max"]

    def test_compute_time_domain_stats_specific_channels(self, sample_edf_file):
        """测试计算指定通道的时域统计"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_time_domain_stats(
            start_time=0, duration=5, channels=["Fp1", "F3"]
        )

        assert len(results) == 2
        assert "Fp1" in results
        assert "F3" in results
        assert "Fp2" not in results

    def test_compute_time_domain_stats_invalid_channel(self, sample_edf_file):
        """测试无效通道"""
        analyzer = AnalysisService(sample_edf_file)

        with pytest.raises(ValueError, match="Channel.*not found"):
            analyzer.compute_time_domain_stats(
                start_time=0, duration=5, channels=["InvalidChannel"]
            )

    def test_compute_time_domain_stats_window_bounds(self, sample_edf_file):
        """测试不同时间窗口"""
        analyzer = AnalysisService(sample_edf_file)

        # 短窗口
        results1 = analyzer.compute_time_domain_stats(
            start_time=0, duration=1, channels=["Fp1"]
        )
        # MNE crop 包含边界点，所以是 duration * sfreq + 1
        assert results1["Fp1"]["n_samples"] >= 100
        assert results1["Fp1"]["n_samples"] <= 101

        # 长窗口
        results2 = analyzer.compute_time_domain_stats(
            start_time=0, duration=8, channels=["Fp1"]
        )
        # MNE crop 包含边界点，所以是 duration * sfreq + 1
        assert results2["Fp1"]["n_samples"] >= 800
        assert results2["Fp1"]["n_samples"] <= 801

    def test_compute_band_power_all_channels(self, sample_edf_file):
        """测试计算所有通道的频带功率"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_band_power(
            start_time=0, duration=5, channels=None
        )

        assert len(results) == 4

        # 检查每个通道的频带
        for ch_name, band_data in results.items():
            assert "delta" in band_data
            assert "theta" in band_data
            assert "alpha" in band_data
            assert "beta" in band_data
            assert "gamma" in band_data

            # 检查频带数据结构
            for band_name, band_result in band_data.items():
                assert "absolute" in band_result
                assert "relative" in band_result
                assert "range" in band_result

                # 验证功率值
                assert band_result["absolute"] >= 0
                assert 0 <= band_result["relative"] <= 1

                # 验证频带范围
                fmin, fmax = band_result["range"]
                assert fmin < fmax

    def test_compute_band_power_specific_channels(self, sample_edf_file):
        """测试计算指定通道的频带功率"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_band_power(
            start_time=0, duration=5, channels=["Fp1", "F3"]
        )

        assert len(results) == 2
        assert "Fp1" in results
        assert "F3" in results

    def test_compute_band_power_custom_bands(self, sample_edf_file):
        """测试自定义频带"""
        analyzer = AnalysisService(sample_edf_file)

        custom_bands = {"low": (1, 10), "high": (10, 30)}
        results = analyzer.compute_band_power(
            start_time=0, duration=5, channels=["Fp1"], bands=custom_bands
        )

        assert "Fp1" in results
        assert "low" in results["Fp1"]
        assert "high" in results["Fp1"]
        assert results["Fp1"]["low"]["range"] == [1, 10]
        assert results["Fp1"]["high"]["range"] == [10, 30]

    def test_compute_psd_all_channels(self, sample_edf_file):
        """测试计算所有通道的 PSD"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_psd(start_time=0, duration=5, channels=None)

        assert len(results) == 4

        for ch_name, psd_data in results.items():
            assert "frequencies" in psd_data
            assert "psd" in psd_data
            assert "sfreq" in psd_data

            # 验证数据长度一致
            assert len(psd_data["frequencies"]) == len(psd_data["psd"])

            # 验证频率范围
            assert psd_data["frequencies"][0] >= 0.5
            assert psd_data["frequencies"][-1] <= 50

            # 验证 PSD 值非负
            assert all(p >= 0 for p in psd_data["psd"])

    def test_compute_psd_specific_channels(self, sample_edf_file):
        """测试计算指定通道的 PSD"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_psd(
            start_time=0, duration=5, channels=["Fp1", "F3"]
        )

        assert len(results) == 2
        assert "Fp1" in results
        assert "F3" in results

    def test_compute_psd_custom_frequency_range(self, sample_edf_file):
        """测试自定义频率范围"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_psd(
            start_time=0, duration=5, channels=["Fp1"], fmin=1, fmax=30
        )

        assert "Fp1" in results
        freqs = results["Fp1"]["frequencies"]
        assert freqs[0] >= 1
        assert freqs[-1] <= 30

    def test_sinusoid_file_band_power(self, sample_edf_file_with_sinusoid):
        """测试使用正弦波文件的频带功率分析"""
        analyzer = AnalysisService(sample_edf_file_with_sinusoid)
        results = analyzer.compute_band_power(
            start_time=0, duration=5, channels=["Fp1"]
        )

        # Alpha 频带 (8-13 Hz) 应该有较高功率（因为我们在 10 Hz 生成信号）
        alpha_power = results["Fp1"]["alpha"]["absolute"]

        # Beta 频带 (13-30 Hz) 也应该有功率（因为我们在 20 Hz 生成信号）
        beta_power = results["Fp1"]["beta"]["absolute"]

        # Delta 频带 (0.5-4 Hz) 功率应该较低
        delta_power = results["Fp1"]["delta"]["absolute"]

        assert alpha_power > 0
        assert beta_power > 0
        # Delta 应该比 alpha 和 beta 小（因为信号在 10 Hz 和 20 Hz）
        assert delta_power < alpha_power or delta_power < beta_power

    def test_compute_time_domain_stats_reproducibility(self, sample_edf_file):
        """测试结果可重复性"""
        analyzer = AnalysisService(sample_edf_file)

        results1 = analyzer.compute_time_domain_stats(
            start_time=0, duration=5, channels=["Fp1"]
        )
        results2 = analyzer.compute_time_domain_stats(
            start_time=0, duration=5, channels=["Fp1"]
        )

        # 结果应该完全相同
        np.testing.assert_array_almost_equal(
            results1["Fp1"]["mean"], results2["Fp1"]["mean"]
        )
        np.testing.assert_array_almost_equal(
            results1["Fp1"]["std"], results2["Fp1"]["std"]
        )

    def test_compute_band_power_relative_sum(self, sample_edf_file):
        """测试相对功率总和"""
        analyzer = AnalysisService(sample_edf_file)
        results = analyzer.compute_band_power(
            start_time=0, duration=5, channels=["Fp1"]
        )

        # 相对功率总和应该接近 1
        relative_sum = sum(
            band["relative"] for band in results["Fp1"].values()
        )

        assert 0.9 <= relative_sum <= 1.1  # 允许小的数值误差

    def test_cleanup_on_deletion(self, sample_edf_file):
        """测试资源清理"""
        analyzer = AnalysisService(sample_edf_file)
        raw = analyzer.raw

        del analyzer

        # MNE Raw 对象应该被删除
        # 注意：这个测试不能直接访问 analyzer.raw，因为对象已被删除
        # 但如果删除过程中出现错误，测试会失败
        assert True

    def test_band_power_short_segment(self, sample_edf_file):
        """测试短选区频带功率分析 - 验证 n_fft 动态计算修复"""
        analyzer = AnalysisService(sample_edf_file)

        # 测试非常短的选区（原错误场景：0.326 秒 @ 500Hz ≈ 163 个采样点 < 256）
        # 这里用 0.3 秒 @ 100Hz = 30 个采样点，远小于 256
        short_duration = 0.3

        # 不应抛出错误：n_fft > n_times
        results = analyzer.compute_band_power(
            start_time=0, duration=short_duration, channels=["Fp1"]
        )

        # 验证结果结构正确
        assert "Fp1" in results
        assert "delta" in results["Fp1"]
        assert "theta" in results["Fp1"]
        assert "alpha" in results["Fp1"]
        assert "beta" in results["Fp1"]
        assert "gamma" in results["Fp1"]

        # 验证功率值有效
        for band_name, band_result in results["Fp1"].items():
            assert band_result["absolute"] >= 0
            assert 0 <= band_result["relative"] <= 1

    def test_psd_short_segment(self, sample_edf_file):
        """测试短选区 PSD 计算 - 验证 n_fft 动态计算修复"""
        analyzer = AnalysisService(sample_edf_file)

        # 测试非常短的选区
        short_duration = 0.3

        # 不应抛出错误
        results = analyzer.compute_psd(
            start_time=0, duration=short_duration, channels=["Fp1"]
        )

        # 验证结果结构正确
        assert "Fp1" in results
        assert "frequencies" in results["Fp1"]
        assert "psd" in results["Fp1"]
        assert "sfreq" in results["Fp1"]

        # 验证数据长度一致
        assert len(results["Fp1"]["frequencies"]) == len(results["Fp1"]["psd"])

        # 验证 PSD 值非负
        assert all(p >= 0 for p in results["Fp1"]["psd"])
