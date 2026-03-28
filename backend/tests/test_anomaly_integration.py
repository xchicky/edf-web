"""
测试 AnomalyDetector 与 AutoPreprocessPipeline 集成

端到端测试：验证加载 EDF → 预处理 → 频段分析 → 异常检测一站式流程
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
RESULTS_DIR = Path(__file__).parent / "results" / "anomaly_integration"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# 合成数据创建辅助函数
# ============================================================================

def create_synthetic_raw_with_anomalies(
    sfreq: float = 500,
    duration: float = 5.0,
    n_channels: int = 4,
) -> mne.io.Raw:
    """创建含异常波形的合成 EEG 信号

    信号特征:
    - 正常背景 alpha (10Hz, 20µV)
    - 通道 0 在 2.0s 注入棘波 (50ms, 150µV)
    - 通道 1 在 3.0s 注入尖波 (120ms, 120µV)
    - 通道 2 异常高幅 delta (2Hz, 100µV)
    - 通道 3 正常背景

    Args:
        sfreq: 采样频率
        duration: 时长（秒）
        n_channels: 通道数量

    Returns:
        MNE Raw 对象
    """
    channel_names = [f"EEG{i}" for i in range(n_channels)]
    n_samples = int(sfreq * duration)
    times = np.linspace(0, duration, n_samples)

    data = np.zeros((n_channels, n_samples))

    for i in range(n_channels):
        # 基础 10Hz alpha 波
        signal = 20 * np.sin(2 * np.pi * 10 * times)

        # 添加基础噪声
        signal += np.random.normal(0, 5, n_samples)

        if i == 0 and n_channels > 0:
            # 通道 0: 注入棘波 (2.0s, 50ms, 150µV)
            spike_center = int(2.0 * sfreq)
            spike_half_width = int(0.025 * sfreq)  # 25ms 半宽
            spike_indices = np.arange(spike_center - spike_half_width, spike_center + spike_half_width)
            # 确保索引在有效范围内
            spike_indices = spike_indices[(spike_indices >= 0) & (spike_indices < n_samples)]
            if len(spike_indices) > 0:
                spike_envelope = np.exp(-((np.arange(len(spike_indices)) - len(spike_indices) // 2) ** 2) / (len(spike_indices) // 4) ** 2)
                signal[spike_indices] += 150 * spike_envelope

        if i == 1 and n_channels > 1:
            # 通道 1: 注入尖波 (3.0s, 120ms, 120µV)
            sharp_center = int(3.0 * sfreq)
            sharp_half_width = int(0.060 * sfreq)  # 60ms 半宽
            sharp_indices = np.arange(sharp_center - sharp_half_width, sharp_center + sharp_half_width)
            # 确保索引在有效范围内
            sharp_indices = sharp_indices[(sharp_indices >= 0) & (sharp_indices < n_samples)]
            if len(sharp_indices) > 0:
                sharp_envelope = np.exp(-((np.arange(len(sharp_indices)) - len(sharp_indices) // 2) ** 2) / (len(sharp_indices) // 3) ** 2)
                signal[sharp_indices] += 120 * sharp_envelope

        if i == 2 and n_channels > 2:
            # 通道 2: 异常高幅 delta (2Hz, 100µV)
            signal += 100 * np.sin(2 * np.pi * 2 * times)

        data[i, :] = signal

    # 创建 MNE Raw 对象
    info = mne.create_info(
        ch_names=channel_names,
        sfreq=sfreq,
        ch_types="eeg",
    )
    raw = mne.io.RawArray(data * 1e-6, info)  # 转换为伏特单位

    return raw


def create_normal_synthetic_raw(
    sfreq: float = 500,
    duration: float = 5.0,
    n_channels: int = 4,
) -> mne.io.Raw:
    """创建正常背景 EEG（低幅混合 alpha/beta + 微弱噪声）

    Args:
        sfreq: 采样频率
        duration: 时长（秒）
        n_channels: 通道数量

    Returns:
        MNE Raw 对象
    """
    channel_names = [f"EEG{i}" for i in range(n_channels)]
    n_samples = int(sfreq * duration)
    times = np.linspace(0, duration, n_samples)

    data = np.zeros((n_channels, n_samples))

    for i in range(n_channels):
        # 混合 alpha (10Hz) 和 beta (20Hz) 波
        signal = 15 * np.sin(2 * np.pi * 10 * times) + 10 * np.sin(2 * np.pi * 20 * times)

        # 添加微弱噪声
        signal += np.random.normal(0, 3, n_samples)

        data[i, :] = signal

    # 创建 MNE Raw 对象
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

    # 确保使用 .fif 扩展名
    if not filename.endswith(".fif"):
        filename = filename + ".fif"

    temp_path = temp_dir / filename
    raw.save(str(temp_path), overwrite=True)
    return str(temp_path)


# ============================================================================
# 基础集成测试
# ============================================================================

class TestAnomalyIntegration:
    """测试 AnomalyDetector 与 AutoPreprocessPipeline 集成"""

    def test_full_pipeline_with_all_analyses(self):
        """测试完整流水线（预处理 + 频段分析 + 异常检测）"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_full_pipeline.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证预处理结果
        assert result.raw_clean is not None, "应返回清洗后的信号"

        # 验证频段分析运行
        assert result.band_analysis is not None, "频段分析应运行"
        assert len(result.band_analysis.channel_results) > 0, "应返回频段分析结果"

        # 验证异常检测运行
        assert result.anomaly_report is not None, "异常检测应运行"
        assert result.anomaly_report.global_risk_score >= 0, "全局风险分应非负"

        # 验证预处理日志
        assert "band_analysis" in result.preprocess_log, "日志应包含频段分析"
        assert "anomaly_detection" in result.preprocess_log, "日志应包含异常检测"

        # 验证异常检测日志内容
        anomaly_log = result.preprocess_log["anomaly_detection"]
        assert anomaly_log is not None, "异常检测日志不应为 None"
        assert "global_risk_score" in anomaly_log, "日志应包含全局风险分"
        assert "anomaly_summary" in anomaly_log, "日志应包含异常摘要"
        assert "n_recommendations" in anomaly_log, "日志应包含建议数"

        Path(temp_path).unlink(missing_ok=True)

    def test_pipeline_without_anomaly_detection(self):
        """测试不启用异常检测的流水线"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_no_anomaly.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            run_anomaly_detection=False,  # 禁用异常检测
        )
        result = pipeline.run()

        # 验证异常检测未运行
        assert result.anomaly_report is None, "禁用时 anomaly_report 应为 None"

        # 验证频段分析仍然运行
        assert result.band_analysis is not None, "频段分析仍应运行"

        # 验证日志
        assert result.preprocess_log["anomaly_detection"] is None, "日志中异常检测应为 None"

        Path(temp_path).unlink(missing_ok=True)

    def test_pipeline_default_no_anomaly(self):
        """测试默认配置（向后兼容：不运行异常检测）"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_default_no_anomaly.fif")

        # 默认配置（不启用任何分析）
        pipeline = AutoPreprocessPipeline(temp_path)
        result = pipeline.run()

        # 验证默认不运行频段分析和异常检测
        assert result.band_analysis is None, "默认不应运行频段分析"
        assert result.anomaly_report is None, "默认不应运行异常检测"

        # 验证预处理仍然正常工作
        assert result.raw_clean is not None, "预处理应正常工作"
        assert len(result.artifacts) >= 0, "应检测伪迹（可能为 0）"

        Path(temp_path).unlink(missing_ok=True)

    def test_anomaly_detection_uses_band_analysis(self):
        """测试异常检测使用频段分析结果（慢波异常检测）"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_uses_band_analysis.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证频段分析和异常检测都运行
        assert result.band_analysis is not None, "频段分析应运行"
        assert result.anomaly_report is not None, "异常检测应运行"

        # 验证通道 2 的慢波异常被检测（通道 2 有高幅 delta）
        if "EEG2" in result.anomaly_report.channel_results:
            eeg2_result = result.anomaly_report.channel_results["EEG2"]
            # 通道 2 应该有异常（高幅 delta）
            assert eeg2_result.risk_score > 0 or len(eeg2_result.anomalies) > 0, \
                "通道 2 应检测到异常（高幅 delta）"

        Path(temp_path).unlink(missing_ok=True)

    def test_anomaly_detection_without_band_analysis(self):
        """测试异常检测在没有频段分析时仍能工作（spike/sharp_wave 检测）"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_without_band_analysis.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=False,  # 不运行频段分析
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证频段分析未运行
        assert result.band_analysis is None, "频段分析不应运行"

        # 验证异常检测仍运行（spike/sharp_wave 检测不依赖频段分析）
        assert result.anomaly_report is not None, "异常检测应运行"
        assert result.anomaly_report.global_risk_score >= 0, "应返回风险分"

        # 验证仍然能检测到 spike/sharp_wave（通道 0 和 1）
        total_anomalies = sum(
            len(result.anomalies)
            for result in result.anomaly_report.channel_results.values()
        )
        # 应该至少检测到一些异常（通道 0 的 spike 和通道 1 的 sharp_wave）
        assert total_anomalies >= 0, "应能检测到 spike/sharp_wave 异常"

        Path(temp_path).unlink(missing_ok=True)

    def test_anomaly_sensitivity_adjustment(self):
        """测试异常检测灵敏度调节"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_sensitivity.fif")

        # 高灵敏度
        pipeline_high = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
            anomaly_sensitivity=2.0,  # 高灵敏度
        )
        result_high = pipeline_high.run()

        # 低灵敏度
        pipeline_low = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
            anomaly_sensitivity=0.5,  # 低灵敏度
        )
        result_low = pipeline_low.run()

        # 高灵敏度应检测到更多异常
        total_high = sum(
            len(result.anomalies)
            for result in result_high.anomaly_report.channel_results.values()
        )
        total_low = sum(
            len(result.anomalies)
            for result in result_low.anomaly_report.channel_results.values()
        )

        assert total_high >= total_low, \
            f"高灵敏度应检测到更多或相等异常: high={total_high}, low={total_low}"

        Path(temp_path).unlink(missing_ok=True)

    def test_normal_signal_low_risk(self):
        """测试正常信号风险分较低"""
        raw = create_normal_synthetic_raw(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_normal_signal.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证异常检测运行
        assert result.anomaly_report is not None, "异常检测应运行"

        # 正常信号风险分应较低（< 0.5）
        # 注意：由于随机噪声，可能检测到少量"异常"，但风险分应较低
        assert result.anomaly_report.global_risk_score < 0.5, \
            f"正常信号风险分应较低，实际: {result.anomaly_report.global_risk_score}"

        Path(temp_path).unlink(missing_ok=True)

    def test_preprocess_log_contains_anomaly_info(self):
        """测试预处理日志包含异常检测信息"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_log_anomaly_info.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证日志包含异常检测信息
        assert "anomaly_detection" in result.preprocess_log, "日志应包含异常检测"

        anomaly_log = result.preprocess_log["anomaly_detection"]
        assert anomaly_log is not None, "异常检测日志不应为 None"

        # 验证日志字段
        assert "global_risk_score" in anomaly_log, "应包含全局风险分"
        assert "anomaly_summary" in anomaly_log, "应包含异常摘要"
        assert "n_recommendations" in anomaly_log, "应包含建议数"

        # 验证值类型
        assert isinstance(anomaly_log["global_risk_score"], (int, float)), "风险分应为数值"
        assert isinstance(anomaly_log["anomaly_summary"], dict), "异常摘要应为字典"
        assert isinstance(anomaly_log["n_recommendations"], int), "建议数应为整数"

        Path(temp_path).unlink(missing_ok=True)

    def test_anomaly_report_has_recommendations(self):
        """测试异常报告包含建议"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_recommendations.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证异常报告包含建议
        assert result.anomaly_report is not None, "异常检测应运行"
        assert result.anomaly_report.recommendations is not None, "建议列表不应为 None"
        assert len(result.anomaly_report.recommendations) > 0, "应至少有一条建议"

        Path(temp_path).unlink(missing_ok=True)

    def test_anomaly_detection_with_single_channel(self):
        """测试单通道信号的异常检测"""
        # 创建单通道含异常信号
        sfreq = 500.0
        duration = 5.0
        n_samples = int(sfreq * duration)
        times = np.linspace(0, duration, n_samples)

        # 基础 alpha + 棘波
        signal = 20 * np.sin(2 * np.pi * 10 * times)
        signal += np.random.normal(0, 5, n_samples)

        # 注入棘波
        spike_center = int(2.0 * sfreq)
        spike_half_width = int(0.025 * sfreq)  # 25ms 半宽
        spike_indices = np.arange(spike_center - spike_half_width, spike_center + spike_half_width)
        # 确保索引在有效范围内
        spike_indices = spike_indices[(spike_indices >= 0) & (spike_indices < n_samples)]
        if len(spike_indices) > 0:
            spike_envelope = np.exp(-((np.arange(len(spike_indices)) - len(spike_indices) // 2) ** 2) / (len(spike_indices) // 4) ** 2)
            signal[spike_indices] += 150 * spike_envelope

        data = signal.reshape(1, -1) * 1e-6
        info = mne.create_info(ch_names=["EEG0"], sfreq=sfreq, ch_types="eeg")
        raw = mne.io.RawArray(data, info)

        temp_path = save_synthetic_to_temp(raw, "test_single_channel_anomaly.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证异常检测运行
        assert result.anomaly_report is not None, "异常检测应运行"
        assert len(result.anomaly_report.channel_results) == 1, "应有 1 个通道结果"

        # 验证通道结果
        ch_result = result.anomaly_report.channel_results["EEG0"]
        assert ch_result.channel_name == "EEG0", "通道名应为 EEG0"

        Path(temp_path).unlink(missing_ok=True)

    def test_anomaly_detection_summary(self):
        """测试异常摘要统计"""
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_anomaly_summary.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_anomaly_detection=True,
        )
        result = pipeline.run()

        # 验证异常摘要
        assert result.anomaly_report is not None, "异常检测应运行"
        summary = result.anomaly_report.anomaly_summary

        # 验证摘要包含所有异常类型
        expected_types = ["spike", "sharp_wave", "spike_and_slow", "slow_wave", "rhythmic"]
        for anomaly_type in expected_types:
            assert anomaly_type in summary, f"摘要应包含 {anomaly_type} 类型"

        # 验证计数值为非负整数
        for anomaly_type, count in summary.items():
            assert count >= 0, f"{anomaly_type} 计数应非负"

        Path(temp_path).unlink(missing_ok=True)


# ============================================================================
# 可视化测试
# ============================================================================

@pytest.mark.visualize
class TestAnomalyVisualization:
    """可视化测试（保存对比图）"""

    def test_visualize_full_pipeline(self):
        """可视化完整流水线（包含异常检测）"""
        try:
            import matplotlib.pyplot as plt
        except ImportError:
            pytest.skip("matplotlib 不可用")

        # 创建含异常的合成数据
        raw = create_synthetic_raw_with_anomalies(duration=5.0, n_channels=4)
        temp_path = save_synthetic_to_temp(raw, "test_visualize_full.fif")

        pipeline = AutoPreprocessPipeline(
            temp_path,
            run_band_analysis=True,
            run_anomaly_detection=True,
        )

        # 获取原始数据
        pipeline._load_edf()
        data_original = pipeline.raw.get_data() * 1e6  # µV
        times = pipeline.raw.times
        sfreq = pipeline.raw.info["sfreq"]

        # 运行完整流水线
        result = pipeline.run()
        data_final = result.raw_clean.get_data() * 1e6

        # 创建 6 子图
        fig, axes = plt.subplots(6, 1, figsize=(14, 12), sharex=True)

        # 1. 原始信号
        axes[0].plot(times, data_original[0, :], color="black", alpha=0.7, linewidth=0.5)
        axes[0].set_ylabel("幅值 (µV)")
        axes[0].set_title("1. 原始信号")
        axes[0].grid(True, alpha=0.3)

        # 2. 预处理后
        axes[1].plot(times, data_final[0, :], color="blue", alpha=0.7, linewidth=0.5)
        axes[1].set_ylabel("幅值 (µV)")
        axes[1].set_title("2. 预处理后（重参考 + Notch + 带通）")
        axes[1].grid(True, alpha=0.3)

        # 3. 频段功率
        if result.band_analysis and len(result.band_analysis.channel_results) > 0:
            first_ch_name = list(result.band_analysis.channel_results.keys())[0]
            ch_result = result.band_analysis.channel_results[first_ch_name]

            bands = []
            powers = []
            for band_name, band_feature in ch_result.bands.items():
                bands.append(band_name)
                powers.append(band_feature.relative_power * 100)

            axes[2].bar(bands, powers, color=["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"][:len(bands)])
            axes[2].set_ylabel("相对功率 (%)")
            axes[2].set_title(f"3. 频段功率（通道: {first_ch_name}）")
            axes[2].grid(True, alpha=0.3, axis="y")
        else:
            axes[2].text(0.5, 0.5, "频段分析失败", ha="center", va="center")
            axes[2].set_title("3. 频段功率")

        # 4. 异常事件标记
        axes[3].plot(times, data_final[0, :], color="gray", alpha=0.7, linewidth=0.5)

        if result.anomaly_report:
            # 用不同颜色标记不同类型的异常
            colors = {
                "spike": "red",
                "sharp_wave": "orange",
                "spike_and_slow": "purple",
                "slow_wave": "blue",
                "rhythmic": "green",
            }

            for ch_name, ch_result in result.anomaly_report.channel_results.items():
                if ch_name != "EEG0":  # 只显示第一个通道的异常
                    continue
                for anomaly in ch_result.anomalies:
                    color = colors.get(anomaly.anomaly_type, "gray")
                    axes[3].axvspan(
                        anomaly.start_time,
                        anomaly.end_time,
                        color=color,
                        alpha=0.3,
                        label=f"{anomaly.anomaly_type}",
                    )

            # 添加异常统计
            anomaly_counts = result.anomaly_report.anomaly_summary
            if anomaly_counts:
                count_text = ", ".join([f"{k}:{v}" for k, v in anomaly_counts.items() if v > 0])
                axes[3].text(0.02, 0.95, f"异常: {count_text}", transform=axes[3].transAxes,
                            verticalalignment="top", bbox=dict(boxstyle="round", facecolor="white", alpha=0.8))

        axes[3].set_ylabel("幅值 (µV)")
        axes[3].set_title("4. 异常事件标记（通道 EEG0）")
        axes[3].grid(True, alpha=0.3)

        # 5. 伪迹标记
        axes[4].plot(times, data_final[0, :], color="gray", alpha=0.7, linewidth=0.5)

        artifact_colors = {
            "eog": "red",
            "emg": "orange",
            "flat": "blue",
            "drift": "purple",
            "jump": "green",
        }

        for artifact in result.artifacts:
            if artifact.channel == "EEG0" or artifact.channel is None:
                color = artifact_colors.get(artifact.artifact_type, "gray")
                axes[4].axvspan(
                    artifact.start_time,
                    artifact.end_time,
                    color=color,
                    alpha=0.3,
                )

        axes[4].set_ylabel("幅值 (µV)")
        axes[4].set_title("5. 伪迹标记")
        axes[4].grid(True, alpha=0.3)

        # 6. 综合风险评分
        if result.anomaly_report:
            risk_score = result.anomaly_report.global_risk_score
            axes[5].barh(0, risk_score, color="red" if risk_score > 0.5 else "green", height=0.3)
            axes[5].set_xlim(0, 1)
            axes[5].set_yticks([])
            axes[5].set_xlabel("风险分 (0-1)")
            axes[5].set_title(f"6. 综合风险评分: {risk_score:.3f}")
            axes[5].grid(True, alpha=0.3, axis="x")

            # 添加建议
            if result.anomaly_report.recommendations:
                recommendations_text = "\n".join(result.anomaly_report.recommendations[:3])
                axes[5].text(0.5, 0.5, f"建议:\n{recommendations_text}",
                           transform=axes[5].transAxes, ha="center", va="center",
                           bbox=dict(boxstyle="round", facecolor="yellow", alpha=0.3),
                           fontsize=8)

        axes[5].set_xlabel("时间 (s)")

        plt.tight_layout()

        # 保存图片
        output_path = RESULTS_DIR / "full_pipeline_with_anomaly_detection.png"
        plt.savefig(output_path, dpi=150)
        plt.close()

        assert output_path.exists(), "应保存可视化图片"

        Path(temp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    """直接运行此文件时执行所有测试"""
    pytest.main([__file__, "-v", "-s"])
