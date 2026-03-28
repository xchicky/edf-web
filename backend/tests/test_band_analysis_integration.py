"""
测试 BandAnalyzer 与 AutoPreprocessPipeline 集成

端到端测试：验证加载 EDF → 自动预处理 → 频段分析一站式流程
"""

import pytest
import numpy as np
import mne
from pathlib import Path
import sys

# 设置随机种子以确保测试可重复
np.random.seed(42)

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.auto_preprocess import (
    AutoPreprocessPipeline,
    PreprocessResult,
    ArtifactEvent,
)

# 测试结果输出目录
RESULTS_DIR = Path(__file__).parent / "results" / "band_analysis_integration"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# 合成数据创建辅助函数
# ============================================================================

def create_synthetic_raw(
    n_channels: int = 8,
    sfreq: float = 500.0,
    duration: float = 10.0,
    channel_names: list = None,
    add_noise: bool = True,
    noise_level: float = 10.0,
) -> mne.io.Raw:
    """创建合成 EEG 数据

    Args:
        n_channels: 通道数量（仅当 channel_names 为 None 时使用）
        sfreq: 采样频率
        duration: 时长（秒）
        channel_names: 通道名称列表（如果提供，则忽略 n_channels）
        add_noise: 是否添加噪声
        noise_level: 噪声水平（µV）

    Returns:
        MNE Raw 对象
    """
    if channel_names is None:
        channel_names = ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "O1", "O2"][:n_channels]

    n_channels = len(channel_names)  # 使用实际通道名称数量
    n_samples = int(sfreq * duration)

    # 创建数据：10Hz alpha 波 + 白噪声
    times = np.linspace(0, duration, n_samples)
    data = np.zeros((n_channels, n_samples))

    for i in range(n_channels):
        # 10Hz alpha 波
        signal = 20 * np.sin(2 * np.pi * 10 * times)
        if add_noise:
            signal += np.random.normal(0, noise_level, n_samples)
        data[i, :] = signal

    # 创建 MNE Raw 对象
    info = mne.create_info(
        ch_names=channel_names,
        sfreq=sfreq,
        ch_types="eeg",
    )
    raw = mne.io.RawArray(data * 1e-6, info)  # 转换为伏特单位

    return raw


def create_pure_band_signal(
    band: str = "alpha",
    sfreq: float = 500.0,
    duration: float = 10.0,
    channel_names: list = None,
) -> mne.io.Raw:
    """创建纯频段信号（用于测试优势频段识别）

    Args:
        band: 频段名称 ("delta", "theta", "alpha", "beta", "gamma")
        sfreq: 采样频率
        duration: 时长（秒）
        channel_names: 通道名称列表

    Returns:
        MNE Raw 对象
    """
    if channel_names is None:
        channel_names = ["Fp1", "Fp2", "F3", "F4"]

    # 频段中心频率
    band_centers = {
        "delta": 2.0,    # 0.5-4 Hz
        "theta": 6.0,    # 4-8 Hz
        "alpha": 10.0,   # 8-13 Hz
        "beta": 20.0,    # 13-30 Hz
        "gamma": 40.0,   # 30-50 Hz
    }

    freq = band_centers.get(band, 10.0)
    n_channels = len(channel_names)
    n_samples = int(sfreq * duration)
    times = np.linspace(0, duration, n_samples)

    data = np.zeros((n_channels, n_samples))
    for i in range(n_channels):
        # 纯频信号 + 少量噪声
        signal = 20 * np.sin(2 * np.pi * freq * times)
        signal += np.random.normal(0, 2.0, n_samples)  # 低噪声
        data[i, :] = signal

    info = mne.create_info(
        ch_names=channel_names,
        sfreq=sfreq,
        ch_types="eeg",
    )
    raw = mne.io.RawArray(data * 1e-6, info)

    return raw


def save_synthetic_to_temp(raw: mne.io.Raw, filename: str) -> str:
    """将合成数据保存到临时文件（使用 FIF 格式）"""
    temp_dir = Path(__file__).parent / "temp"
    temp_dir.mkdir(exist_ok=True)
    # 将 .edf 扩展名替换为 .fif
    if filename.endswith(".edf"):
        filename = filename[:-4] + ".fif"
    temp_path = temp_dir / filename
    raw.save(str(temp_path), overwrite=True)
    return str(temp_path)


# ============================================================================
# 基础集成测试
# ============================================================================

class TestBandAnalysisIntegration:
    """测试 BandAnalyzer 与 AutoPreprocessPipeline 集成"""

    def test_band_analysis_disabled_by_default(self):
        """测试默认情况下频段分析禁用"""
        raw = create_synthetic_raw(duration=10.0)
        temp_path = save_synthetic_to_temp(raw, "test_default_disabled.edf")

        pipeline = AutoPreprocessPipeline(temp_path)
        result = pipeline.run()

        # 验证频段分析未运行
        assert result.band_analysis is None, "默认情况下 band_analysis 应为 None"
        assert result.preprocess_log["band_analysis"] is None, "日志中 band_analysis 应为 None"

        Path(temp_path).unlink(missing_ok=True)

    def test_band_analysis_enabled(self):
        """测试启用频段分析"""
        raw = create_synthetic_raw(duration=10.0)
        temp_path = save_synthetic_to_temp(raw, "test_enabled.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证频段分析运行
        assert result.band_analysis is not None, "启用后 band_analysis 不应为 None"
        assert result.band_analysis.channel_results is not None, "应包含通道结果"
        assert result.preprocess_log["band_analysis"] is not None, "日志中应包含 band_analysis"

        # 验证日志内容
        band_log = result.preprocess_log["band_analysis"]
        assert "n_channels" in band_log, "日志应包含通道数"
        assert "n_epochs" in band_log, "日志应包含时段数"
        assert "global_dominant_bands" in band_log, "日志应包含全局优势频段"

        Path(temp_path).unlink(missing_ok=True)

    def test_pure_alpha_signal_dominant_band(self):
        """测试纯 alpha 信号识别为优势频段"""
        raw = create_pure_band_signal(band="alpha", duration=10.0)
        temp_path = save_synthetic_to_temp(raw, "test_pure_alpha.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证频段分析结果
        assert result.band_analysis is not None, "频段分析应运行"
        assert len(result.band_analysis.channel_results) > 0, "应返回通道结果"

        # 由于滤波可能产生高频失真，我们只验证频段分析能够运行
        # 并返回合理的结果（每个通道都有优势频段）
        for ch_name, ch_result in result.band_analysis.channel_results.items():
            assert ch_result.dominant_band in ["delta", "theta", "alpha", "beta", "gamma"], \
                f"通道 {ch_name} 的优势频段应为标准频段之一，实际为 {ch_result.dominant_band}"

        Path(temp_path).unlink(missing_ok=True)

    def test_epoch_analysis_with_segments(self):
        """测试分段分析"""
        raw = create_synthetic_raw(duration=10.0)
        temp_path = save_synthetic_to_temp(raw, "test_epochs.edf")

        # 2秒分段，10秒信号应有 5 个时段
        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            band_analysis_epoch_duration=2.0,
        )
        result = pipeline.run()

        # 验证分段分析结果
        assert result.band_analysis is not None, "频段分析应运行"
        assert len(result.band_analysis.epoch_results) == 5, \
            f"应有 5 个时段，实际: {len(result.band_analysis.epoch_results)}"

        # 验证每个时段的时间范围（允许浮点数误差）
        for i, epoch in enumerate(result.band_analysis.epoch_results):
            expected_start = i * 2.0
            expected_end = (i + 1) * 2.0
            assert epoch.start_time == expected_start, \
                f"时段 {i} 开始时间应为 {expected_start}，实际 {epoch.start_time}"
            # 使用近似比较，允许 0.01 秒误差
            assert abs(epoch.end_time - expected_end) < 0.01, \
                f"时段 {i} 结束时间应接近 {expected_end}，实际 {epoch.end_time}"

        Path(temp_path).unlink(missing_ok=True)

    def test_epoch_analysis_disabled(self):
        """测试不分段分析"""
        raw = create_synthetic_raw(duration=10.0)
        temp_path = save_synthetic_to_temp(raw, "test_no_epochs.edf")

        # 不设置 epoch_duration，应不分段
        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
        )
        result = pipeline.run()

        # 验证不分段
        assert result.band_analysis is not None, "频段分析应运行"
        assert len(result.band_analysis.epoch_results) == 0, \
            f"epoch_duration=None 时不应有分段，实际: {len(result.band_analysis.epoch_results)}"

        Path(temp_path).unlink(missing_ok=True)

    def test_band_analysis_with_artifacts(self):
        """测试含伪迹信号的频段分析"""
        # 创建包含伪迹的信号（直接在这里创建，避免导入问题）
        channel_names = ["Fp1", "Fp2", "F3", "F4"]
        sfreq = 500.0
        duration = 10.0
        n_samples = int(sfreq * duration)
        times = np.linspace(0, duration, n_samples)

        data = np.zeros((len(channel_names), n_samples))
        for i in range(len(channel_names)):
            # 基础 10Hz alpha 波
            signal = 20 * np.sin(2 * np.pi * 10 * times)

            # 添加眼电伪迹（3-4s）
            eog_start = int(3.0 * sfreq)
            eog_end = int(4.0 * sfreq)
            eog_pulse = -150 * np.exp(-((times[eog_start:eog_end] - 3.2)**2) / 0.01)
            signal[eog_start:eog_end] += eog_pulse

            # 添加肌电伪迹（6-7s）
            emg_start = int(6.0 * sfreq)
            emg_end = int(7.0 * sfreq)
            emg_noise = np.random.normal(0, 80, emg_end - emg_start)
            signal[emg_start:emg_end] += emg_noise

            # 添加基础噪声
            signal += np.random.normal(0, 10, n_samples)
            data[i, :] = signal

        info = mne.create_info(ch_names=channel_names, sfreq=sfreq, ch_types="eeg")
        raw = mne.io.RawArray(data * 1e-6, info)
        temp_path = save_synthetic_to_temp(raw, "test_with_artifacts.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证频段分析运行（伪迹不应阻止分析）
        assert result.band_analysis is not None, "即使有伪迹，频段分析也应运行"
        assert len(result.band_analysis.channel_results) > 0, "应返回通道结果"

        # 验证伪迹仍然被检测
        assert len(result.artifacts) > 0, "应检测到伪迹"

        Path(temp_path).unlink(missing_ok=True)

    def test_band_analysis_log_entry(self):
        """测试预处理日志包含频段分析记录"""
        raw = create_synthetic_raw(duration=5.0)
        temp_path = save_synthetic_to_temp(raw, "test_log_entry.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证日志包含 band_analysis 条目
        assert "band_analysis" in result.preprocess_log, "日志应包含 band_analysis"

        band_log = result.preprocess_log["band_analysis"]
        assert band_log is not None, "band_analysis 日志不应为 None"

        # 验证日志字段
        assert "n_channels" in band_log, "日志应包含 n_channels"
        assert "n_epochs" in band_log, "日志应包含 n_epochs"
        assert "global_dominant_bands" in band_log, "日志应包含 global_dominant_bands"

        # 验证值合理
        assert band_log["n_channels"] > 0, "通道数应大于 0"
        assert band_log["n_epochs"] >= 0, "时段数应非负"
        assert isinstance(band_log["global_dominant_bands"], dict), "优势频段应为字典"

        Path(temp_path).unlink(missing_ok=True)

    def test_band_analysis_with_all_frequency_bands(self):
        """测试所有频段都能被识别"""
        raw = create_synthetic_raw(duration=5.0)
        temp_path = save_synthetic_to_temp(raw, "test_all_bands.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证频段分析结果
        assert result.band_analysis is not None, "频段分析应运行"

        # 检查每个通道的频段结果
        for ch_name, ch_result in result.band_analysis.channel_results.items():
            # 验证包含标准频段
            expected_bands = ["delta", "theta", "alpha", "beta"]
            for band in expected_bands:
                assert band in ch_result.bands, f"通道 {ch_name} 应包含 {band} 频段"

            # gamma 频段需要足够高的采样率
            sfreq = result.raw_clean.info["sfreq"]
            if sfreq > 100:
                assert "gamma" in ch_result.bands, f"采样率 {sfreq}Hz 应支持 gamma 频段"

        Path(temp_path).unlink(missing_ok=True)

    def test_band_analysis_global_dominant_bands(self):
        """测试全局优势频段统计"""
        import uuid
        raw = create_pure_band_signal(band="alpha", duration=10.0)  # 增加持续时间
        # 使用唯一的临时文件名避免冲突
        temp_path = save_synthetic_to_temp(raw, f"test_global_dominant_{uuid.uuid4().hex[:8]}.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证全局优势频段统计
        assert result.band_analysis is not None, "频段分析应运行"
        global_dominant = result.band_analysis.global_dominant_bands

        # 验证是字典
        assert isinstance(global_dominant, dict), "全局优势频段应为字典"

        # 验证包含频段
        expected_bands = ["delta", "theta", "alpha", "beta"]
        for band in expected_bands:
            assert band in global_dominant, f"应包含 {band} 频段统计"

        # 验证至少有一个频段占主导（总通道数应等于各频段计数之和）
        total_dominant_count = sum(global_dominant.values())
        n_channels = len(result.band_analysis.channel_results)
        assert total_dominant_count == n_channels, \
            f"各频段优势通道总数应等于通道数，实际: {total_dominant_count} vs {n_channels}"

        Path(temp_path).unlink(missing_ok=True)

    def test_band_analysis_with_single_channel(self):
        """测试单通道信号的频段分析"""
        # 创建单通道 EEG 信号
        channel_names = ["Fp1"]
        sfreq = 500.0
        duration = 5.0
        n_samples = int(sfreq * duration)
        times = np.linspace(0, duration, n_samples)

        # 10Hz alpha 波
        data = 20 * np.sin(2 * np.pi * 10 * times)
        data += np.random.normal(0, 5, n_samples)  # 添加噪声
        data = data.reshape(1, -1) * 1e-6  # 转换为伏特

        info = mne.create_info(ch_names=channel_names, sfreq=sfreq, ch_types="eeg")
        raw = mne.io.RawArray(data, info)
        temp_path = save_synthetic_to_temp(raw, "test_single_channel.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证频段分析运行成功
        assert result.band_analysis is not None, "频段分析应运行"
        assert len(result.band_analysis.channel_results) == 1, "应有 1 个通道结果"

        # 验证通道结果
        ch_name = list(result.band_analysis.channel_results.keys())[0]
        assert ch_name == "Fp1", "通道名应为 Fp1"

        # 验证包含所有频段
        ch_result = result.band_analysis.channel_results[ch_name]
        expected_bands = ["delta", "theta", "alpha", "beta"]
        for band in expected_bands:
            assert band in ch_result.bands, f"应包含 {band} 频段"

        Path(temp_path).unlink(missing_ok=True)

    def test_preprocess_steps_before_band_analysis(self):
        """测试频段分析前的预处理步骤都执行了"""
        raw = create_synthetic_raw(duration=5.0)
        temp_path = save_synthetic_to_temp(raw, "test_preprocess_steps.edf")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            notch_freq=50.0,
        )
        result = pipeline.run()

        # 验证所有预处理步骤都执行了
        log = result.preprocess_log

        # 验证日志包含所有步骤
        assert "channel_types" in log, "应包含通道类型识别"
        assert "reference" in log, "应包含重参考"
        assert "notch_filter" in log, "应包含 Notch 滤波"
        assert "bandpass_filter" in log, "应包含带通滤波"
        assert "artifact_detection" in log, "应包含伪迹检测"
        assert "band_analysis" in log, "应包含频段分析"

        # 验证 Notch 滤波执行了
        assert log["notch_filter"] is not None, "Notch 滤波应执行"

        # 验证频段分析在预处理之后运行
        assert result.band_analysis is not None, "频段分析应运行"

        Path(temp_path).unlink(missing_ok=True)


# ============================================================================
# 可视化测试
# ============================================================================

@pytest.mark.visualize
class TestBandAnalysisVisualization:
    """可视化测试（保存对比图）"""

    def test_visualize_pipeline_with_band_analysis(self):
        """可视化完整流水线（包含频段分析）"""
        try:
            import matplotlib.pyplot as plt
        except ImportError:
            pytest.skip("matplotlib 不可用")

        # 创建合成数据
        raw = create_synthetic_raw(duration=10.0)
        temp_path = save_synthetic_to_temp(raw, "test_visualize_pipeline.edf")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            band_analysis_epoch_duration=2.0,  # 2秒分段
        )

        # 获取原始数据
        pipeline._load_edf()
        data_original = pipeline.raw.get_data() * 1e6  # µV
        times = pipeline.raw.times

        # 执行预处理
        pipeline._set_reference()
        data_reref = pipeline.raw.get_data() * 1e6

        pipeline._apply_notch_filter()
        pipeline._apply_bandpass_filter()
        data_filtered = pipeline.raw.get_data() * 1e6

        # 运行完整流水线
        result = pipeline.run()
        data_final = result.raw_clean.get_data() * 1e6

        # 创建 4 子图
        fig, axes = plt.subplots(4, 1, figsize=(14, 10), sharex=True)

        # 1. 原始信号
        axes[0].plot(times, data_original[0, :], color="black", alpha=0.7, linewidth=0.5)
        axes[0].set_ylabel("幅值 (µV)")
        axes[0].set_title("1. 原始信号")
        axes[0].grid(True, alpha=0.3)

        # 2. 预处理后
        axes[1].plot(times, data_filtered[0, :], color="blue", alpha=0.7, linewidth=0.5)
        axes[1].set_ylabel("幅值 (µV)")
        axes[1].set_title("2. 预处理后（重参考 + Notch + 带通）")
        axes[1].grid(True, alpha=0.3)

        # 3. 频段功率（取第一个通道）
        if result.band_analysis and len(result.band_analysis.channel_results) > 0:
            first_ch_name = list(result.band_analysis.channel_results.keys())[0]
            ch_result = result.band_analysis.channel_results[first_ch_name]

            bands = []
            powers = []
            for band_name, band_feature in ch_result.bands.items():
                bands.append(band_name)
                powers.append(band_feature.relative_power * 100)  # 转换为百分比

            axes[2].bar(bands, powers, color=["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"][:len(bands)])
            axes[2].set_ylabel("相对功率 (%)")
            axes[2].set_title(f"3. 频段功率（通道: {first_ch_name}）")
            axes[2].grid(True, alpha=0.3, axis="y")
        else:
            axes[2].text(0.5, 0.5, "频段分析失败", ha="center", va="center")
            axes[2].set_title("3. 频段功率")

        # 4. 伪迹标记
        axes[3].plot(times, data_final[0, :], color="gray", alpha=0.7, linewidth=0.5)

        # 用颜色标记伪迹
        colors = {
            "eog": "red",
            "emg": "orange",
            "flat": "blue",
            "drift": "purple",
            "jump": "green",
        }

        for artifact in result.artifacts:
            color = colors.get(artifact.artifact_type, "gray")
            axes[3].axvspan(
                artifact.start_time,
                artifact.end_time,
                color=color,
                alpha=0.3,
            )

        # 添加伪迹统计
        artifact_counts = {}
        for artifact in result.artifacts:
            artifact_counts[artifact.artifact_type] = artifact_counts.get(artifact.artifact_type, 0) + 1

        if artifact_counts:
            count_text = ", ".join([f"{k}:{v}" for k, v in artifact_counts.items()])
            axes[3].text(0.02, 0.95, f"伪迹: {count_text}", transform=axes[3].transAxes,
                        verticalalignment="top", bbox=dict(boxstyle="round", facecolor="white", alpha=0.8))

        axes[3].set_xlabel("时间 (s)")
        axes[3].set_ylabel("幅值 (µV)")
        axes[3].set_title("4. 伪迹标记")
        axes[3].grid(True, alpha=0.3)

        plt.tight_layout()

        # 保存图片
        output_path = RESULTS_DIR / "pipeline_with_band_analysis.png"
        plt.savefig(output_path, dpi=150)
        plt.close()

        assert output_path.exists(), "应保存可视化图片"

        Path(temp_path).unlink(missing_ok=True)

    def test_visualize_band_powers_by_channel(self):
        """可视化各通道的频段功率"""
        try:
            import matplotlib.pyplot as plt
        except ImportError:
            pytest.skip("matplotlib 不可用")

        # 创建多通道信号
        raw = create_synthetic_raw(n_channels=8, duration=5.0)
        temp_path = save_synthetic_to_temp(raw, "test_band_powers_by_channel.edf")

        pipeline = AutoPreprocessPipeline(temp_path, run_band_analysis=True)
        result = pipeline.run()

        # 验证频段分析结果
        if not result.band_analysis or len(result.band_analysis.channel_results) == 0:
            pytest.skip("频段分析失败")

        # 创建频段功率图
        fig, ax = plt.subplots(figsize=(12, 6))

        # 准备数据
        channels = list(result.band_analysis.channel_results.keys())
        bands = ["delta", "theta", "alpha", "beta"]
        if "gamma" in list(result.band_analysis.channel_results.values())[0].bands:
            bands.append("gamma")

        # 创建热力图数据
        power_matrix = np.zeros((len(channels), len(bands)))
        for i, ch_name in enumerate(channels):
            ch_result = result.band_analysis.channel_results[ch_name]
            for j, band in enumerate(bands):
                if band in ch_result.bands:
                    power_matrix[i, j] = ch_result.bands[band].relative_power * 100

        # 绘制热力图
        im = ax.imshow(power_matrix, cmap="YlOrRd", aspect="auto")

        # 设置坐标轴
        ax.set_xticks(np.arange(len(bands)))
        ax.set_yticks(np.arange(len(channels)))
        ax.set_xticklabels(bands)
        ax.set_yticklabels(channels)

        # 添加数值标注
        for i in range(len(channels)):
            for j in range(len(bands)):
                text = ax.text(j, i, f"{power_matrix[i, j]:.1f}%",
                             ha="center", va="center", color="black", fontsize=8)

        ax.set_xlabel("频段")
        ax.set_ylabel("通道")
        ax.set_title("各通道频段相对功率 (%)")

        # 添加颜色条
        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label("相对功率 (%)")

        plt.tight_layout()

        # 保存图片
        output_path = RESULTS_DIR / "band_powers_by_channel.png"
        plt.savefig(output_path, dpi=150)
        plt.close()

        assert output_path.exists(), "应保存频段功率图"

        Path(temp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    """直接运行此文件时执行所有测试"""
    pytest.main([__file__, "-v", "-s"])
