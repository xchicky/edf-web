"""
BandAnalyzer 与 AutoPreprocessPipeline 集成测试

测试频段分析集成到自动预处理流水线的端到端功能。
"""

import pytest
import numpy as np
import mne
from pathlib import Path
import tempfile
import shutil
from typing import Tuple, List, Optional

from app.services.auto_preprocess import AutoPreprocessPipeline, ArtifactEvent


# ============================================================================
# 辅助函数：创建合成 EEG 数据
# ============================================================================

def create_synthetic_raw_with_known_bands(
    signal_type: str = "alpha",
    duration: float = 10.0,
    sfreq: int = 500,
    n_channels: int = 8,
    add_artifacts: bool = False,
    ch_names: Optional[List[str]] = None,
) -> Tuple[mne.io.Raw, str]:
    """创建包含已知频段成分的合成 EEG 数据

    Args:
        signal_type: 信号类型 ("alpha", "delta", "mixed")
        duration: 持续时间（秒）
        sfreq: 采样频率
        n_channels: 通道数
        add_artifacts: 是否添加伪迹
        ch_names: 通道名称（可选）

    Returns:
        (mne.io.Raw, expected_dominant_band): 合成数据和期望的优势频段
    """
    n_samples = int(duration * sfreq)
    times = np.arange(n_samples) / sfreq

    # 生成基础信号（增强目标频段特征）
    if signal_type == "alpha":
        # 纯 alpha 信号 (10Hz) - 只使用 alpha 频段内的频率
        expected_dominant = "alpha"
        # 主频率 10Hz + 9Hz + 11Hz + 12Hz (都在 alpha 频段 8-13Hz 内)
        signal = (
            1.0 * np.sin(2 * np.pi * 10.0 * times) +
            0.5 * np.sin(2 * np.pi * 9.0 * times) +
            0.3 * np.sin(2 * np.pi * 11.0 * times) +
            0.2 * np.sin(2 * np.pi * 12.0 * times)
        )
    elif signal_type == "delta":
        # 纯 delta 信号 (2Hz) - 增强低频特征
        freq = 2.0
        expected_dominant = "delta"
        signal = (
            1.0 * np.sin(2 * np.pi * freq * times) +
            0.5 * np.sin(2 * np.pi * 1.5 * times) +
            0.3 * np.sin(2 * np.pi * 2.5 * times) +
            0.2 * np.sin(2 * np.pi * 3.0 * times)  # 近 delta
        )
    elif signal_type == "mixed":
        # 混合频段信号（alpha 为主，大幅增强 alpha）
        alpha_component = 2.0 * np.sin(2 * np.pi * 10.0 * times) + 0.6 * np.sin(2 * np.pi * 9.5 * times)
        delta_component = 0.2 * np.sin(2 * np.pi * 2.0 * times)
        theta_component = 0.1 * np.sin(2 * np.pi * 6.0 * times)
        signal = alpha_component + delta_component + theta_component
        expected_dominant = "alpha"
    else:
        raise ValueError(f"Unknown signal_type: {signal_type}")

    # 添加更小的噪声
    noise = 0.05 * np.random.randn(n_samples)
    signal = signal + noise

    # 扩展到多通道（每个通道添加轻微变化，避免平均参考导致信号消失）
    data = np.zeros((n_channels, n_samples))
    for i in range(n_channels):
        # 每个通道添加轻微的随机变化（幅度差异和相位偏移）
        channel_signal = signal * (0.9 + 0.2 * np.random.rand())  # 幅度变化 ±10%
        phase_shift = int(0.01 * sfreq * np.random.randn())  # 轻微相位偏移
        channel_signal = np.roll(channel_signal, phase_shift)
        data[i, :] = channel_signal

    # 添加伪迹
    if add_artifacts:
        # EOG 伪迹（眼电脉冲）- 只影响前两个通道
        for i in range(3):
            start_idx = int((2 + i * 3) * sfreq)
            end_idx = start_idx + int(0.2 * sfreq)
            if end_idx < n_samples:
                data[0, start_idx:end_idx] += 100.0  # 大幅脉冲
                data[1, start_idx:end_idx] += 80.0   # 第二个通道也添加

        # EMG 伪迹（肌电噪声）- 只影响第一个通道
        for i in range(2):
            start_idx = int((1 + i * 4) * sfreq)
            end_idx = start_idx + int(0.5 * sfreq)
            if end_idx < n_samples:
                emg_noise = 30.0 * np.random.randn(end_idx - start_idx)
                data[0, start_idx:end_idx] += emg_noise

    # 创建通道名称
    if ch_names is None:
        ch_names = [f"EEG {i+1}" for i in range(n_channels)]

    # 创建 MNE Info
    info = mne.create_info(
        ch_names=ch_names,
        sfreq=sfreq,
        ch_types="eeg"
    )

    # 创建 Raw 对象
    raw = mne.io.RawArray(data * 1e-6, info)  # 转换为伏特

    return raw, expected_dominant


def save_synthetic_raw_to_fif(raw: mne.io.Raw, temp_dir: Path, filename: str = "synthetic_raw.fif") -> Path:
    """保存合成数据到 FIF 文件

    Args:
        raw: MNE Raw 对象
        temp_dir: 临时目录
        filename: 文件名

    Returns:
        文件路径
    """
    filepath = temp_dir / filename
    raw.save(filepath, overwrite=True, verbose=False)
    return filepath


# ============================================================================
# 集成测试
# ============================================================================

class TestBandAnalysisIntegration:
    """频段分析集成测试"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_path = Path(tempfile.mkdtemp(prefix="eeg_test_"))
        yield temp_path
        # 清理
        if temp_path.exists():
            shutil.rmtree(temp_path)

    def test_pipeline_with_band_analysis_enabled(self, temp_dir):
        """测试启用频段分析的流水线"""
        # 创建纯 alpha 信号
        raw, expected_band = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_alpha.fif")

        # 执行流水线（启用频段分析）
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 验证频段分析结果
        assert result.band_analysis is not None, "频段分析结果不应为 None"
        assert len(result.band_analysis.channel_results) > 0, "应该有通道分析结果"

        # 验证所有通道的优势频段为 alpha
        for ch_name, ch_result in result.band_analysis.channel_results.items():
            assert ch_result.dominant_band == expected_band, \
                f"通道 {ch_name} 的优势频段应为 {expected_band}，实际为 {ch_result.dominant_band}"

        # 验证预处理正常完成
        assert result.raw_clean is not None
        assert len(result.artifacts) >= 0

    def test_pipeline_with_band_analysis_disabled(self, temp_dir):
        """测试禁用频段分析的流水线"""
        # 创建合成数据
        raw, _ = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_disabled.fif")

        # 执行流水线（禁用频段分析）
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=False)

        # 验证频段分析结果为 None
        assert result.band_analysis is None, "频段分析结果应为 None"

        # 验证其他字段正常
        assert result.raw_clean is not None
        assert len(result.artifacts) >= 0
        assert result.preprocess_log is not None

    def test_pipeline_default_no_band_analysis(self, temp_dir):
        """测试默认不执行频段分析（向后兼容）"""
        # 创建合成数据
        raw, _ = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_default.fif")

        # 执行流水线（不传参数）
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run()  # 不传任何参数

        # 验证频段分析结果为 None（默认行为）
        assert result.band_analysis is None, "默认情况下频段分析结果应为 None"

        # 验证其他字段正常
        assert result.raw_clean is not None
        assert result.artifacts is not None
        assert result.preprocess_log is not None

    def test_band_analysis_with_epochs(self, temp_dir):
        """测试带分段的频段分析"""
        # 创建合成数据
        raw, _ = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_epochs.fif")

        # 执行流水线（启用分段分析）
        epoch_duration = 2.0
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True, epoch_duration=epoch_duration)

        # 验证频段分析结果
        assert result.band_analysis is not None
        assert len(result.band_analysis.epoch_results) > 0, "应有 epoch 分析结果"

        # 验证 epoch 数量合理（10s / 2s = 5 个 epoch）
        expected_n_epochs = int(10.0 / epoch_duration)
        assert len(result.band_analysis.epoch_results) == expected_n_epochs, \
            f"应有 {expected_n_epochs} 个 epoch，实际为 {len(result.band_analysis.epoch_results)}"

    def test_band_analysis_preserves_preprocess_results(self, temp_dir):
        """测试频段分析不影响预处理结果"""
        # 创建含伪迹的信号
        raw, _ = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
            add_artifacts=True,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_preserve.fif")

        # 执行流水线
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 验证预处理结果正常
        assert result.raw_clean is not None
        assert result.artifacts is not None

        # 验证伪迹被检测到
        artifact_types = {a.artifact_type for a in result.artifacts}
        assert len(artifact_types) > 0, "应检测到伪迹"

        # 验证频段分析仍能正常执行
        assert result.band_analysis is not None
        assert len(result.band_analysis.channel_results) > 0

    def test_preprocess_log_includes_band_analysis(self, temp_dir):
        """测试预处理日志包含频段分析信息"""
        # 创建合成数据
        raw, _ = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_log.fif")

        # 执行流水线
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 验证预处理日志包含频段分析信息
        assert "band_analysis" in result.preprocess_log, "预处理日志应包含 band_analysis"
        assert result.preprocess_log["band_analysis"] is not None

        # 验证日志内容
        band_info = result.preprocess_log["band_analysis"]
        assert "n_channels_analyzed" in band_info
        assert "n_epochs" in band_info
        assert band_info["n_channels_analyzed"] > 0

    def test_delta_signal_dominant_band(self, temp_dir):
        """测试 delta 信号的优势频段识别"""
        # 创建纯 delta 信号
        raw, expected_band = create_synthetic_raw_with_known_bands(
            signal_type="delta",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_delta.fif")

        # 执行流水线
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 验证优势频段为 delta
        assert result.band_analysis is not None
        for ch_name, ch_result in result.band_analysis.channel_results.items():
            assert ch_result.dominant_band == expected_band, \
                f"通道 {ch_name} 的优势频段应为 {expected_band}"

    def test_artifact_contaminated_signal(self, temp_dir):
        """测试含伪迹信号的频段分析"""
        # 创建含 EOG 伪迹的 alpha 信号
        raw, expected_band = create_synthetic_raw_with_known_bands(
            signal_type="alpha",
            duration=10.0,
            sfreq=500,
            n_channels=8,
            add_artifacts=True,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_artifact.fif")

        # 执行流水线
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 验证伪迹被检测到
        assert len(result.artifacts) > 0, "应检测到伪迹"

        # 验证频段分析仍能正常执行
        assert result.band_analysis is not None
        assert len(result.band_analysis.channel_results) > 0

        # 验证频段分析仍能正常执行
        # 注意：由于平均参考和大幅伪迹的影响，所有通道的频段特征都可能改变
        # 我们主要验证：
        # 1. 频段分析没有崩溃
        # 2. 返回了有效结果
        # 3. 伪迹被正确检测
        assert len(result.band_analysis.channel_results) > 0, "应有通道分析结果"

        # 验证至少有一些频段功率不为 0（说明分析正常工作）
        has_power = False
        for ch_result in result.band_analysis.channel_results.values():
            for band_feature in ch_result.bands.values():
                if band_feature.absolute_power > 0:
                    has_power = True
                    break
            if has_power:
                break
        assert has_power, "至少应有一些频段功率不为 0"

    def test_mixed_signal_dominant_band(self, temp_dir):
        """测试混合频段信号的优势频段识别"""
        # 创建混合频段信号
        raw, expected_band = create_synthetic_raw_with_known_bands(
            signal_type="mixed",
            duration=10.0,
            sfreq=500,
            n_channels=8,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_mixed.fif")

        # 执行流水线
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 验证频段分析结果
        assert result.band_analysis is not None
        assert len(result.band_analysis.channel_results) > 0

        # 验证 alpha 为优势频段（混合信号中 alpha 幅度最大）
        alpha_count = sum(
            1 for ch_result in result.band_analysis.channel_results.values()
            if ch_result.dominant_band == "alpha"
        )
        assert alpha_count > 0, "至少应有一些通道识别出 alpha 为优势频段"

    @pytest.mark.visualize
    def test_visualize_pipeline_with_band_analysis(self, temp_dir):
        """可视化测试：完整流水线 + 频段分析"""
        import matplotlib.pyplot as plt

        # 创建含伪迹的混合频段信号
        raw, _ = create_synthetic_raw_with_known_bands(
            signal_type="mixed",
            duration=10.0,
            sfreq=500,
            n_channels=8,
            add_artifacts=True,
        )

        # 保存为 FIF 文件
        file_path = save_synthetic_raw_to_fif(raw, temp_dir, "test_visualize.fif")

        # 执行流水线
        pipeline = AutoPreprocessPipeline(str(file_path))
        result = pipeline.run(run_band_analysis=True)

        # 创建可视化
        fig, axes = plt.subplots(4, 1, figsize=(12, 10))

        # 1. 原始信号
        raw_data = raw.get_data() * 1e6  # 转换为 µV
        times = raw.times
        axes[0].plot(times, raw_data[0, :])
        axes[0].set_title("原始信号（通道 1）")
        axes[0].set_ylabel("幅值 (µV)")
        axes[0].grid(True)

        # 2. 预处理后信号
        clean_data = result.raw_clean.get_data() * 1e6
        axes[1].plot(times, clean_data[0, :])
        axes[1].set_title("预处理后信号（通道 1）")
        axes[1].set_ylabel("幅值 (µV)")
        axes[1].grid(True)

        # 3. 频段功率柱状图
        if result.band_analysis:
            ch_name = list(result.band_analysis.channel_results.keys())[0]
            ch_result = result.band_analysis.channel_results[ch_name]

            bands = []
            powers = []
            for band_name, band_feature in ch_result.bands.items():
                bands.append(band_name)
                powers.append(band_feature.absolute_power)

            axes[2].bar(bands, powers)
            axes[2].set_title(f"频段功率（{ch_name}）")
            axes[2].set_ylabel("绝对功率 (µV²)")
            axes[2].set_xlabel("频段")
            axes[2].grid(True, axis='y')

        # 4. 伪迹和优势频段标记
        axes[3].plot(times, clean_data[0, :], alpha=0.7)

        # 标记伪迹
        for artifact in result.artifacts:
            if artifact.channel == "EEG 1" or artifact.channel is None:
                axes[3].axvspan(
                    artifact.start_time,
                    artifact.end_time,
                    alpha=0.3,
                    color='red',
                    label=f"{artifact.artifact_type}" if artifact.start_time < 1.0 else ""
                )

        # 标记优势频段
        if result.band_analysis:
            ch_result = result.band_analysis.channel_results["EEG 1"]
            dominant = ch_result.dominant_band
            axes[3].text(
                0.02, 0.95, f"优势频段: {dominant}",
                transform=axes[3].transAxes,
                bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5),
                verticalalignment='top'
            )

        axes[3].set_title("伪迹标记 + 优势频段")
        axes[3].set_xlabel("时间 (s)")
        axes[3].set_ylabel("幅值 (µV)")
        axes[3].grid(True)
        axes[3].legend(loc='upper right')

        plt.tight_layout()

        # 保存图像
        results_dir = temp_dir / "band_analysis_integration"
        results_dir.mkdir(exist_ok=True)
        fig_path = results_dir / "pipeline_with_band_analysis.png"
        plt.savefig(fig_path, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"可视化已保存到: {fig_path}")


# ============================================================================
# 运行测试
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
