"""
Annotation Service Tests

测试 EEG 标注系统的各项功能，包括：
- AnnotationBuilder 数据转换
- AnnotationManager CRUD 和缓存
- API 端点
- 端到端集成测试
- 可视化测试
"""

import pytest
import numpy as np
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import mne

from app.services.annotation_service import (
    Annotation,
    AnnotationSet,
    AnnotationBuilder,
    AnnotationManager,
    get_annotation_manager,
    ANNOTATION_STYLES,
    ARTIFACT_TYPE_MAPPING,
    ANOMALY_TYPE_MAPPING,
)
from app.services.auto_preprocess import ArtifactEvent, PreprocessResult
from app.services.band_analyzer import BandAnalysisReport, ChannelBandResult, BandFeature
from app.services.anomaly_detector import AnomalyReport, AnomalyEvent, ChannelAnomalyResult

# 标记可视化测试
visualize = pytest.mark.visualize


# ============================================================================
# 合成数据辅助函数
# ============================================================================

def create_sample_raw(sfreq=500, duration=10.0, n_channels=4):
    """创建示例 MNE Raw 对象"""
    n_samples = int(sfreq * duration)
    data = np.random.randn(n_channels, n_samples) * 5
    # 动态生成通道名
    ch_names = [f"Fp{i+1}" if i < 2 else f"F{i-1}" for i in range(n_channels)]
    ch_types = ["eeg"] * n_channels
    info = mne.create_info(ch_names, sfreq, ch_types)
    raw = mne.io.RawArray(data, info)
    raw.set_meas_date(None)
    return raw


def create_artifact_events():
    """创建示例伪迹事件"""
    return [
        ArtifactEvent(
            start_time=1.0,
            end_time=2.0,
            artifact_type="eog",
            channel="Fp1",
            severity=0.8,
            description="EOG 伪迹"
        ),
        ArtifactEvent(
            start_time=3.0,
            end_time=4.0,
            artifact_type="emg",
            channel="Fp2",
            severity=0.6,
            description="EMG 伪迹"
        ),
        ArtifactEvent(
            start_time=5.0,
            end_time=6.0,
            artifact_type="flat",
            channel="F3",
            severity=0.9,
            description="平坦信号"
        ),
    ]


def create_band_analysis_report():
    """创建示例频段分析报告"""
    # 创建 BandFeature 对象
    delta_band = BandFeature(
        band_name="delta",
        freq_range=(0.5, 4.0),
        absolute_power=100.0,
        relative_power=0.4,
        peak_freq=2.0,
        center_freq=2.25,
        bandwidth=3.5,
    )
    alpha_band = BandFeature(
        band_name="alpha",
        freq_range=(8.0, 13.0),
        absolute_power=150.0,
        relative_power=0.6,
        peak_freq=10.0,
        center_freq=10.5,
        bandwidth=5.0,
    )

    # 创建 ChannelBandResult 对象
    ch_result1 = ChannelBandResult(
        channel_name="Fp1",
        dominant_band="alpha",
        bands={"delta": delta_band, "alpha": alpha_band}
    )

    ch_result2 = ChannelBandResult(
        channel_name="Fp2",
        dominant_band="delta",
        bands={"delta": delta_band, "alpha": alpha_band}
    )

    # 创建 BandAnalysisReport
    return BandAnalysisReport(
        channel_results={
            "Fp1": ch_result1,
            "Fp2": ch_result2,
        },
        global_dominant_bands={"alpha": 1, "delta": 1},
        epoch_results=[],
        analysis_params={
            'n_channels': 2,
            'channels': ["Fp1", "Fp2"],
            'sfreq': 500.0,
            'duration_seconds': 10.0,
        }
    )


def create_anomaly_report():
    """创建示例异常检测报告"""
    # 创建 AnomalyEvent 对象
    spike_event = AnomalyEvent(
        anomaly_type="spike",
        channel="Fp1",
        start_time=2.0,
        end_time=2.1,
        severity=0.8,
        confidence=0.9,
        description="棘波",
        features={'peak_amplitude_uv': 150.0, 'duration_ms': 50}
    )

    sharp_wave_event = AnomalyEvent(
        anomaly_type="sharp_wave",
        channel="Fp2",
        start_time=4.0,
        end_time=4.2,
        severity=0.7,
        confidence=0.8,
        description="尖波",
        features={'peak_amplitude_uv': 120.0, 'duration_ms': 120}
    )

    # 创建 ChannelAnomalyResult 对象
    ch_result1 = ChannelAnomalyResult(
        channel_name="Fp1",
        anomalies=[spike_event],
        risk_score=0.8,
        summary={"spike": 1}
    )

    ch_result2 = ChannelAnomalyResult(
        channel_name="Fp2",
        anomalies=[sharp_wave_event],
        risk_score=0.7,
        summary={"sharp_wave": 1}
    )

    # 创建 AnomalyReport
    return AnomalyReport(
        channel_results={
            "Fp1": ch_result1,
            "Fp2": ch_result2,
        },
        global_risk_score=0.75,
        anomaly_summary={"spike": 1, "sharp_wave": 1},
        recommendations=["检测到棘波/尖波，建议进一步检查"],
        analysis_params={
            'n_channels': 2,
            'channels': ["Fp1", "Fp2"],
            'sfreq': 500.0,
            'sensitivity': 1.0,
        }
    )


def create_preprocess_result(with_band_analysis=True, with_anomaly=True):
    """创建示例预处理结果"""
    raw = create_sample_raw()
    artifacts = create_artifact_events()

    band_analysis = create_band_analysis_report() if with_band_analysis else None
    anomaly_report = create_anomaly_report() if with_anomaly else None

    return PreprocessResult(
        raw_clean=raw,
        artifacts=artifacts,
        preprocess_log={'test': 'log'},
        artifact_annotations=None,
        band_analysis=band_analysis,
        anomaly_report=anomaly_report,
    )


# ============================================================================
# AnnotationBuilder 测试
# ============================================================================

class TestAnnotationBuilder:
    """测试 AnnotationBuilder"""

    def test_from_artifacts(self):
        """测试从伪迹事件创建标注"""
        artifacts = create_artifact_events()
        annotations = AnnotationBuilder.from_artifacts(artifacts)

        assert len(annotations) == 3

        # 验证第一个标注（EOG）
        eog_ann = annotations[0]
        assert eog_ann.annotation_type == "artifact_eog"
        assert eog_ann.source == "preprocess"
        assert eog_ann.channel == "Fp1"
        assert eog_ann.start_time == 1.0
        assert eog_ann.end_time == 2.0
        assert eog_ann.label == "EOG 眼电伪迹"
        assert eog_ann.color == "#FCD34D"
        assert eog_ann.severity == 0.8
        assert not eog_ann.is_user_created

        # 验证第二个标注（EMG）
        emg_ann = annotations[1]
        assert emg_ann.annotation_type == "artifact_emg"
        assert emg_ann.label == "EMG 肌电伪迹"
        assert emg_ann.color == "#FB923C"

        # 验证第三个标注（Flat）
        flat_ann = annotations[2]
        assert flat_ann.annotation_type == "artifact_flat"
        assert flat_ann.label == "平坦信号"
        assert flat_ann.color == "#9CA3AF"

    def test_from_artifacts_empty(self):
        """测试空伪迹事件列表"""
        annotations = AnnotationBuilder.from_artifacts([])
        assert len(annotations) == 0

    def test_from_band_analysis(self):
        """测试从频段分析创建标注"""
        band_analysis = create_band_analysis_report()
        annotations = AnnotationBuilder.from_band_analysis(band_analysis)

        assert len(annotations) == 2

        # 验证第一个通道标注
        ann1 = annotations[0]
        assert ann1.annotation_type == "band_dominant"
        assert ann1.source == "band_analysis"
        assert ann1.channel == "Fp1"
        assert ann1.start_time == 0.0
        assert ann1.end_time == 10.0
        assert ann1.label == "ALPHA 优势频段"
        assert ann1.color == "#34D399"
        assert ann1.severity == 0.0
        assert "dominant_band" in ann1.metadata
        assert ann1.metadata["dominant_band"] == "alpha"
        assert "band_powers" in ann1.metadata

        # 验证第二个通道标注
        ann2 = annotations[1]
        assert ann2.channel == "Fp2"
        assert ann2.metadata["dominant_band"] == "delta"

    def test_from_band_analysis_none(self):
        """测试 None 频段分析输入"""
        annotations = AnnotationBuilder.from_band_analysis(None)
        assert len(annotations) == 0

    def test_from_anomaly_report(self):
        """测试从异常检测报告创建标注"""
        anomaly_report = create_anomaly_report()
        annotations = AnnotationBuilder.from_anomaly_report(anomaly_report)

        assert len(annotations) == 2

        # 验证第一个异常标注（spike）
        spike_ann = annotations[0]
        assert spike_ann.annotation_type == "anomaly_spike"
        assert spike_ann.source == "anomaly_detection"
        assert spike_ann.channel == "Fp1"
        assert spike_ann.start_time == 2.0
        assert spike_ann.end_time == 2.1
        assert spike_ann.label == "棘波"
        assert spike_ann.color == "#EF4444"
        assert spike_ann.severity == 0.8
        assert spike_ann.confidence == 0.9
        assert "description" in spike_ann.metadata
        assert "features" in spike_ann.metadata

        # 验证第二个异常标注（sharp_wave）
        sharp_ann = annotations[1]
        assert sharp_ann.annotation_type == "anomaly_sharp_wave"
        assert sharp_ann.label == "尖波"
        assert sharp_ann.color == "#F97316"

    def test_from_anomaly_report_empty(self):
        """测试空异常报告"""
        # 创建没有异常的报告
        empty_report = AnomalyReport(
            channel_results={},
            global_risk_score=0.0,
            anomaly_summary={},
            recommendations=["无异常"],
            analysis_params={}
        )
        annotations = AnnotationBuilder.from_anomaly_report(empty_report)
        assert len(annotations) == 0

    def test_from_preprocess_result_full(self):
        """测试从完整预处理结果创建标注集"""
        result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        annotation_set = AnnotationBuilder.from_preprocess_result(result)

        # 验证标注集（file_id 是时间戳，以 "processed_" 开头）
        assert annotation_set.file_id is not None
        assert annotation_set.file_id.startswith("processed_")
        assert len(annotation_set.annotations) == 7  # 3 伪迹 + 2 频段 + 2 异常

        # 验证 summary
        assert annotation_set.summary["artifact_eog"] == 1
        assert annotation_set.summary["artifact_emg"] == 1
        assert annotation_set.summary["artifact_flat"] == 1
        assert annotation_set.summary["band_dominant"] == 2
        assert annotation_set.summary["anomaly_spike"] == 1
        assert annotation_set.summary["anomaly_sharp_wave"] == 1

    def test_from_preprocess_result_partial(self):
        """测试仅伪迹的预处理结果"""
        result = create_preprocess_result(with_band_analysis=False, with_anomaly=False)
        annotation_set = AnnotationBuilder.from_preprocess_result(result)

        # 只有伪迹标注
        assert len(annotation_set.annotations) == 3
        assert annotation_set.summary.get("artifact_eog") == 1
        assert annotation_set.summary.get("band_dominant") is None


# ============================================================================
# AnnotationSet 测试
# ============================================================================

class TestAnnotationSet:
    """测试 AnnotationSet"""

    def test_filter_by_type(self):
        """测试按类型过滤"""
        annotations = [
            Annotation(
                id="1", annotation_type="artifact_eog", source="preprocess",
                channel="Fp1", start_time=0, end_time=1, label="EOG", color="#FCD34D",
                severity=0.5, confidence=1.0, metadata={}, is_user_created=False
            ),
            Annotation(
                id="2", annotation_type="anomaly_spike", source="anomaly_detection",
                channel="Fp1", start_time=1, end_time=2, label="Spike", color="#EF4444",
                severity=0.8, confidence=0.9, metadata={}, is_user_created=False
            ),
        ]
        annotation_set = AnnotationSet(file_id="test", annotations=annotations)

        # 过滤出伪迹
        filtered = annotation_set.filter_by_type(["artifact_eog"])
        assert len(filtered.annotations) == 1
        assert filtered.annotations[0].annotation_type == "artifact_eog"

    def test_filter_by_channel(self):
        """测试按通道过滤"""
        annotations = [
            Annotation(
                id="1", annotation_type="artifact_eog", source="preprocess",
                channel="Fp1", start_time=0, end_time=1, label="EOG", color="#FCD34D",
                severity=0.5, confidence=1.0, metadata={}, is_user_created=False
            ),
            Annotation(
                id="2", annotation_type="artifact_emg", source="preprocess",
                channel="Fp2", start_time=1, end_time=2, label="EMG", color="#FB923C",
                severity=0.6, confidence=1.0, metadata={}, is_user_created=False
            ),
        ]
        annotation_set = AnnotationSet(file_id="test", annotations=annotations)

        # 过滤出 Fp1 通道
        filtered = annotation_set.filter_by_channel(["Fp1"])
        assert len(filtered.annotations) == 1
        assert filtered.annotations[0].channel == "Fp1"

    def test_filter_by_time_range(self):
        """测试按时间范围过滤"""
        annotations = [
            Annotation(
                id="1", annotation_type="artifact_eog", source="preprocess",
                channel="Fp1", start_time=0, end_time=1, label="EOG", color="#FCD34D",
                severity=0.5, confidence=1.0, metadata={}, is_user_created=False
            ),
            Annotation(
                id="2", annotation_type="artifact_emg", source="preprocess",
                channel="Fp2", start_time=2, end_time=3, label="EMG", color="#FB923C",
                severity=0.6, confidence=1.0, metadata={}, is_user_created=False
            ),
        ]
        annotation_set = AnnotationSet(file_id="test", annotations=annotations)

        # 过滤出 0-1.5 秒的标注
        filtered = annotation_set.filter_by_time_range(0, 1.5)
        assert len(filtered.annotations) == 1
        assert filtered.annotations[0].start_time == 0

    def test_to_dict(self):
        """测试序列化"""
        annotation = Annotation(
            id="1", annotation_type="artifact_eog", source="preprocess",
            channel="Fp1", start_time=0, end_time=1, label="EOG", color="#FCD34D",
            severity=0.5, confidence=1.0, metadata={}, is_user_created=False
        )
        annotation_set = AnnotationSet(file_id="test", annotations=[annotation])

        result = annotation_set.to_dict()
        assert result["file_id"] == "test"
        assert len(result["annotations"]) == 1
        assert "summary" in result
        assert "generated_at" in result


# ============================================================================
# AnnotationManager 测试
# ============================================================================

class TestAnnotationManager:
    """测试 AnnotationManager"""

    @patch('app.services.auto_preprocess.AutoPreprocessPipeline')
    @patch('app.services.file_manager.get_file_path')
    def test_generate_and_cache(self, mock_get_file_path, mock_pipeline_class):
        """测试生成标注和缓存"""
        # Mock setup
        mock_get_file_path.return_value = Path("/fake/test.edf")

        mock_pipeline = Mock()
        mock_result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        mock_pipeline.run.return_value = mock_result
        mock_pipeline_class.return_value = mock_pipeline

        manager = AnnotationManager()

        # 第一次生成
        annotation_set1 = manager.generate_annotations("test_file")
        assert len(annotation_set1.annotations) == 7

        # 第二次获取应该从缓存读取
        with patch.object(manager, 'generate_annotations') as mock_generate:
            mock_generate.side_effect = Exception("Should not be called")
            # 直接操作缓存
            manager._cache["test_file"] = annotation_set1
            result = manager.get_annotations("test_file")
            assert len(result.annotations) == 7

    @patch('app.services.auto_preprocess.AutoPreprocessPipeline')
    @patch('app.services.file_manager.get_file_path')
    def test_get_annotations_filtered_by_type(self, mock_get_file_path, mock_pipeline_class):
        """测试按类型过滤获取标注"""
        # Mock setup
        mock_get_file_path.return_value = Path("/fake/test.edf")

        mock_pipeline = Mock()
        mock_result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        mock_pipeline.run.return_value = mock_result
        mock_pipeline_class.return_value = mock_pipeline

        manager = AnnotationManager()
        manager.generate_annotations("test_file")

        # 按类型过滤
        filtered = manager.get_annotations("test_file", types=["artifact_eog"])
        assert len(filtered.annotations) == 1
        assert filtered.annotations[0].annotation_type == "artifact_eog"

    @patch('app.services.auto_preprocess.AutoPreprocessPipeline')
    @patch('app.services.file_manager.get_file_path')
    def test_get_annotations_filtered_by_channel(self, mock_get_file_path, mock_pipeline_class):
        """测试按通道过滤获取标注"""
        # Mock setup
        mock_get_file_path.return_value = Path("/fake/test.edf")

        mock_pipeline = Mock()
        mock_result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        mock_pipeline.run.return_value = mock_result
        mock_pipeline_class.return_value = mock_pipeline

        manager = AnnotationManager()
        manager.generate_annotations("test_file")

        # 按通道过滤
        filtered = manager.get_annotations("test_file", channels=["Fp1"])
        # 应该包含所有 Fp1 通道的标注
        fp1_annotations = [ann for ann in filtered.annotations if ann.channel == "Fp1"]
        assert len(fp1_annotations) > 0

    @patch('app.services.auto_preprocess.AutoPreprocessPipeline')
    @patch('app.services.file_manager.get_file_path')
    def test_get_annotations_filtered_by_time(self, mock_get_file_path, mock_pipeline_class):
        """测试按时间范围过滤获取标注"""
        # Mock setup
        mock_get_file_path.return_value = Path("/fake/test.edf")

        mock_pipeline = Mock()
        mock_result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        mock_pipeline.run.return_value = mock_result
        mock_pipeline_class.return_value = mock_pipeline

        manager = AnnotationManager()
        manager.generate_annotations("test_file")

        # 按时间范围过滤（使用 0-3.1 秒以包含开始时间为 3.0 的标注）
        filtered = manager.get_annotations("test_file", start=0, end=3.1)
        # 应该只包含 0-3.1 秒的标注
        for ann in filtered.annotations:
            if ann.annotation_type != "band_dominant":  # band_dominant 是全时段的
                assert ann.start_time <= 3.0, f"Expected start_time <= 3.0, got {ann.start_time}"

    def test_add_user_annotation(self):
        """测试添加用户标注"""
        manager = AnnotationManager()

        annotation = manager.add_user_annotation(
            file_id="test_file",
            annotation_type="user_note",
            channel="Fp1",
            start_time=5.0,
            end_time=6.0,
            label="用户备注",
            note="测试备注"
        )

        assert annotation.annotation_type == "user_note"
        assert annotation.source == "user"
        assert annotation.channel == "Fp1"
        assert annotation.start_time == 5.0
        assert annotation.end_time == 6.0
        assert annotation.label == "用户备注"
        assert annotation.is_user_created is True
        assert annotation.metadata["note"] == "测试备注"

    def test_delete_user_annotation(self):
        """测试删除用户标注"""
        manager = AnnotationManager()

        # 添加用户标注
        annotation = manager.add_user_annotation(
            file_id="test_file",
            annotation_type="user_note",
            channel="Fp1",
            start_time=5.0,
            end_time=6.0,
            label="用户备注"
        )

        annotation_id = annotation.id

        # 确保标注在缓存中
        assert "test_file" in manager._user_annotations
        assert len(manager._user_annotations["test_file"]) == 1

        # 删除
        success = manager.delete_user_annotation("test_file", annotation_id)
        assert success is True

        # 验证已删除
        user_annotations = manager._user_annotations.get("test_file", [])
        assert len(user_annotations) == 0

    def test_delete_user_annotation_not_found(self):
        """测试删除不存在的用户标注"""
        manager = AnnotationManager()

        success = manager.delete_user_annotation("test_file", "non_existent_id")
        assert success is False

    def test_clear_cache(self):
        """测试清除缓存"""
        manager = AnnotationManager()
        manager._cache["test_file"] = Mock()

        # 清除特定文件缓存
        manager.clear_cache("test_file")
        assert "test_file" not in manager._cache

        # 清除所有缓存
        manager._cache["test_file2"] = Mock()
        manager.clear_cache()
        assert len(manager._cache) == 0


# ============================================================================
# API 测试
# ============================================================================

class TestAnnotationsAPI:
    """测试 Annotations API"""

    def test_api_generate_annotations(self, client):
        """测试生成标注 API"""
        # 创建测试文件
        from app.services.file_manager import UPLOAD_DIR

        # 创建简单的 EDF 文件（采样率 200Hz 以支持 50Hz 带通滤波）
        sfreq = 200
        duration = 5
        n_samples = sfreq * duration
        n_channels = 2
        data = np.random.randn(n_channels, n_samples) * 5
        ch_names = ["Fp1", "Fp2"]
        ch_types = ["eeg"] * n_channels
        info = mne.create_info(ch_names, sfreq, ch_types)
        raw = mne.io.RawArray(data, info)
        raw.set_meas_date(None)

        test_file_path = UPLOAD_DIR / "test_api_annotations.edf"
        raw.export(str(test_file_path), fmt="edf", physical_range=(0, 100), overwrite=True)

        file_id = "test_api_annotations"

        response = client.post(
            f"/api/annotations/{file_id}/generate",
            json={
                "run_band_analysis": False,
                "run_anomaly_detection": False,
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == file_id
        assert "annotations" in data
        assert "summary" in data
        assert "generated_at" in data

        # 清理
        if test_file_path.exists():
            test_file_path.unlink()

    def test_api_get_annotations(self, client):
        """测试获取标注 API"""
        from app.services.file_manager import UPLOAD_DIR

        # 创建测试文件（采样率 200Hz 以支持 50Hz 带通滤波）
        sfreq = 200
        duration = 5
        n_samples = sfreq * duration
        n_channels = 2
        data = np.random.randn(n_channels, n_samples) * 5
        ch_names = ["Fp1", "Fp2"]
        ch_types = ["eeg"] * n_channels
        info = mne.create_info(ch_names, sfreq, ch_types)
        raw = mne.io.RawArray(data, info)
        raw.set_meas_date(None)

        test_file_path = UPLOAD_DIR / "test_api_get_annotations.edf"
        raw.export(str(test_file_path), fmt="edf", physical_range=(0, 100), overwrite=True)

        file_id = "test_api_get_annotations"

        # 先生成标注
        client.post(
            f"/api/annotations/{file_id}/generate",
            json={"run_band_analysis": False, "run_anomaly_detection": False}
        )

        # 获取标注
        response = client.get(f"/api/annotations/{file_id}")

        assert response.status_code == 200
        data = response.json()
        assert "annotations" in data
        assert "summary" in data

        # 清理
        if test_file_path.exists():
            test_file_path.unlink()

    def test_api_add_user_annotation(self, client):
        """测试添加用户标注 API"""
        from app.services.file_manager import UPLOAD_DIR

        # 创建测试文件
        sfreq = 100
        duration = 5
        n_samples = sfreq * duration
        n_channels = 2
        data = np.random.randn(n_channels, n_samples) * 5
        ch_names = ["Fp1", "Fp2"]
        ch_types = ["eeg"] * n_channels
        info = mne.create_info(ch_names, sfreq, ch_types)
        raw = mne.io.RawArray(data, info)
        raw.set_meas_date(None)

        test_file_path = UPLOAD_DIR / "test_api_user_annotation.edf"
        raw.export(str(test_file_path), fmt="edf", physical_range=(0, 100), overwrite=True)

        file_id = "test_api_user_annotation"

        response = client.post(
            f"/api/annotations/{file_id}/user",
            json={
                "annotation_type": "user_note",
                "channel": "Fp1",
                "start_time": 1.0,
                "end_time": 2.0,
                "label": "测试用户标注",
                "note": "这是一个测试"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["annotation_type"] == "user_note"
        assert data["source"] == "user"
        assert data["is_user_created"] is True
        assert data["label"] == "测试用户标注"

        # 清理
        if test_file_path.exists():
            test_file_path.unlink()

    def test_api_delete_user_annotation(self, client):
        """测试删除用户标注 API"""
        from app.services.file_manager import UPLOAD_DIR

        # 创建测试文件
        sfreq = 100
        duration = 5
        n_samples = sfreq * duration
        n_channels = 2
        data = np.random.randn(n_channels, n_samples) * 5
        ch_names = ["Fp1", "Fp2"]
        ch_types = ["eeg"] * n_channels
        info = mne.create_info(ch_names, sfreq, ch_types)
        raw = mne.io.RawArray(data, info)
        raw.set_meas_date(None)

        test_file_path = UPLOAD_DIR / "test_api_delete_user_annotation.edf"
        raw.export(str(test_file_path), fmt="edf", physical_range=(0, 100), overwrite=True)

        file_id = "test_api_delete_user_annotation"

        # 先添加用户标注
        add_response = client.post(
            f"/api/annotations/{file_id}/user",
            json={
                "annotation_type": "user_note",
                "channel": "Fp1",
                "start_time": 1.0,
                "end_time": 2.0,
                "label": "测试标注",
            }
        )
        annotation_id = add_response.json()["id"]

        # 删除标注
        delete_response = client.delete(f"/api/annotations/{file_id}/user/{annotation_id}")

        assert delete_response.status_code == 200

        # 清理
        if test_file_path.exists():
            test_file_path.unlink()

    def test_api_clear_cache(self, client):
        """测试清除缓存 API"""
        from app.services.file_manager import UPLOAD_DIR

        # 创建测试文件
        sfreq = 100
        duration = 5
        n_samples = sfreq * duration
        n_channels = 2
        data = np.random.randn(n_channels, n_samples) * 5
        ch_names = ["Fp1", "Fp2"]
        ch_types = ["eeg"] * n_channels
        info = mne.create_info(ch_names, sfreq, ch_types)
        raw = mne.io.RawArray(data, info)
        raw.set_meas_date(None)

        test_file_path = UPLOAD_DIR / "test_api_clear_cache.edf"
        raw.export(str(test_file_path), fmt="edf", physical_range=(0, 100), overwrite=True)

        file_id = "test_api_clear_cache"

        # 先生成标注
        client.post(
            f"/api/annotations/{file_id}/generate",
            json={"run_band_analysis": False, "run_anomaly_detection": False}
        )

        # 清除缓存
        response = client.delete(f"/api/annotations/{file_id}/cache")

        assert response.status_code == 200

        # 清理
        if test_file_path.exists():
            test_file_path.unlink()


# ============================================================================
# 端到端测试
# ============================================================================

class TestEndToEnd:
    """端到端集成测试"""

    @patch('app.services.auto_preprocess.AutoPreprocessPipeline')
    @patch('app.services.file_manager.get_file_path')
    def test_full_pipeline_to_annotations(self, mock_get_file_path, mock_pipeline_class):
        """测试完整流程：EDF → 预处理 → 标注生成"""
        # Mock setup
        mock_get_file_path.return_value = Path("/fake/test.edf")

        mock_pipeline = Mock()
        mock_result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        mock_pipeline.run.return_value = mock_result
        mock_pipeline_class.return_value = mock_pipeline

        manager = AnnotationManager()

        # 生成标注
        annotation_set = manager.generate_annotations(
            file_id="test_full_pipeline",
            run_band_analysis=True,
            run_anomaly_detection=True
        )

        # 验证结果
        assert annotation_set.file_id == "test_full_pipeline"
        assert len(annotation_set.annotations) == 7

        # 验证包含所有类型的标注
        types = {ann.annotation_type for ann in annotation_set.annotations}
        assert "artifact_eog" in types
        assert "artifact_emg" in types
        assert "artifact_flat" in types
        assert "band_dominant" in types
        assert "anomaly_spike" in types
        assert "anomaly_sharp_wave" in types

    def test_annotation_color_consistency(self):
        """测试所有标注颜色合法且非空"""
        annotations = [
            Annotation(
                id="1", annotation_type=atype, source="test",
                channel="Fp1", start_time=0, end_time=1, label="Test", color=color,
                severity=0.5, confidence=1.0, metadata={}, is_user_created=False
            )
            for atype, color in [
                ("artifact_eog", "#FCD34D"),
                ("artifact_emg", "#FB923C"),
                ("anomaly_spike", "#EF4444"),
                ("band_dominant", "#34D399"),
                ("user_note", "#10B981"),
            ]
        ]

        for ann in annotations:
            # 验证颜色格式（十六进制）
            assert ann.color.startswith("#")
            assert len(ann.color) == 7
            # 验证所有字符都是合法的十六进制数字
            assert all(c in "0123456789ABCDEFabcdef" for c in ann.color[1:])

    def test_annotation_time_ordering(self):
        """测试所有标注 start_time < end_time"""
        artifacts = create_artifact_events()
        anomaly_report = create_anomaly_report()

        artifact_annotations = AnnotationBuilder.from_artifacts(artifacts)
        anomaly_annotations = AnnotationBuilder.from_anomaly_report(anomaly_report)

        for ann in artifact_annotations + anomaly_annotations:
            assert ann.start_time < ann.end_time, \
                f"标注 {ann.id} 的时间顺序错误: start={ann.start_time}, end={ann.end_time}"


# ============================================================================
# 可视化测试
# ============================================================================

@visualize
class TestVisualization:
    """可视化测试"""

    def test_visualize_annotations(self, tmp_path):
        """生成标注可视化图"""
        import matplotlib.pyplot as plt
        import matplotlib.patches as patches

        # 创建测试数据（修复参数）
        raw = create_sample_raw(sfreq=500, duration=10.0, n_channels=2)
        result = create_preprocess_result(with_band_analysis=True, with_anomaly=True)
        annotation_set = AnnotationBuilder.from_preprocess_result(result)

        # 创建 3 子图
        fig, axes = plt.subplots(3, 1, figsize=(12, 10))
        fig.suptitle("EEG 标注可视化", fontsize=14)

        # 子图 1: 信号波形 + 伪迹标注
        ax1 = axes[0]
        data = raw.get_data()
        times = raw.times

        for ch_idx, ch_name in enumerate(raw.ch_names[:2]):
            ax1.plot(times, data[ch_idx] * 1e6, label=ch_name, alpha=0.7)

        # 添加伪迹标注
        artifact_annotations = [ann for ann in annotation_set.annotations
                               if ann.annotation_type.startswith("artifact_")]
        for ann in artifact_annotations:
            rect = patches.Rectangle(
                (ann.start_time, ax1.get_ylim()[0]),
                ann.end_time - ann.start_time,
                ax1.get_ylim()[1] - ax1.get_ylim()[0],
                linewidth=1, edgecolor=ann.color, facecolor=ann.color, alpha=0.3
            )
            ax1.add_patch(rect)
            ax1.text(ann.start_time, ax1.get_ylim()[1] * 0.9, ann.label,
                    fontsize=8, color=ann.color)

        ax1.set_xlabel("时间 (秒)")
        ax1.set_ylabel("幅值 (µV)")
        ax1.set_title("信号波形 + 伪迹标注")
        ax1.legend(loc='upper right')
        ax1.grid(True, alpha=0.3)

        # 子图 2: 频段分析标注
        ax2 = axes[1]
        band_annotations = [ann for ann in annotation_set.annotations
                           if ann.annotation_type == "band_dominant"]

        y_pos = 0
        for ann in band_annotations:
            rect = patches.Rectangle(
                (0, y_pos), 10, 0.8,
                linewidth=1, edgecolor=ann.color, facecolor=ann.color, alpha=0.6
            )
            ax2.add_patch(rect)
            ax2.text(0.1, y_pos + 0.4,
                    f"{ann.channel}: {ann.metadata.get('dominant_band', '').upper()} 优势频段",
                    fontsize=9, va='center')
            y_pos += 1

        ax2.set_xlim(0, 10)
        ax2.set_ylim(0, y_pos)
        ax2.set_xlabel("时间 (秒)")
        ax2.set_yticks(range(len(band_annotations)))
        ax2.set_yticklabels([ann.channel for ann in band_annotations])
        ax2.set_title("频段分析标注")
        ax2.grid(True, axis='x', alpha=0.3)

        # 子图 3: 异常检测标注
        ax3 = axes[2]
        anomaly_annotations = [ann for ann in annotation_set.annotations
                              if ann.annotation_type.startswith("anomaly_")]

        y_pos = 0
        for ann in anomaly_annotations:
            rect = patches.Rectangle(
                (ann.start_time, y_pos),
                ann.end_time - ann.start_time, 0.8,
                linewidth=1, edgecolor=ann.color, facecolor=ann.color, alpha=0.6
            )
            ax3.add_patch(rect)
            ax3.text(ann.start_time + 0.1, y_pos + 0.4,
                    f"{ann.channel}: {ann.label}",
                    fontsize=9, va='center', color='white', fontweight='bold')
            y_pos += 1

        ax3.set_xlim(0, 10)
        ax3.set_ylim(0, y_pos)
        ax3.set_xlabel("时间 (秒)")
        ax3.set_yticks(range(len(anomaly_annotations)))
        ax3.set_yticklabels([ann.channel for ann in anomaly_annotations])
        ax3.set_title("异常检测标注")
        ax3.grid(True, axis='x', alpha=0.3)

        plt.tight_layout()

        # 保存图片
        results_dir = tmp_path / "results" / "annotations"
        results_dir.mkdir(parents=True, exist_ok=True)
        output_path = results_dir / "test_visualize_annotations.png"
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()

        assert output_path.exists()
        print(f"可视化结果已保存到: {output_path}")
