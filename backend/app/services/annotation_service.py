"""
Annotation Service - EEG 标注系统

将伪迹检测、频段分析、异常检测的结果统一转换为标准化的 Annotation 格式。
提供生成、查询、用户标注管理的 API。
"""

import uuid
import logging
from typing import Dict, List, Any, Optional, TYPE_CHECKING
from dataclasses import dataclass, field, asdict
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

# 延迟导入以避免循环依赖
if TYPE_CHECKING:
    from app.services.auto_preprocess import PreprocessResult, ArtifactEvent
    from app.services.band_analyzer import BandAnalysisReport
    from app.services.anomaly_detector import AnomalyReport


# ============================================================================
# 常量定义
# ============================================================================

ANNOTATION_STYLES = {
    # 伪迹标注（来源：Step 1）
    "artifact_eog":   {"label": "EOG 眼电伪迹", "color": "#FCD34D", "source": "preprocess"},
    "artifact_emg":   {"label": "EMG 肌电伪迹", "color": "#FB923C", "source": "preprocess"},
    "artifact_flat":  {"label": "平坦信号", "color": "#9CA3AF", "source": "preprocess"},
    "artifact_drift": {"label": "信号漂移", "color": "#60A5FA", "source": "preprocess"},
    "artifact_jump":  {"label": "信号跳变", "color": "#A78BFA", "source": "preprocess"},
    # 频段标注（来源：Step 2）
    "band_dominant":  {"label": "优势频段", "color": "#34D399", "source": "band_analysis"},
    # 异常标注（来源：Step 3）
    "anomaly_spike":          {"label": "棘波", "color": "#EF4444", "source": "anomaly_detection"},
    "anomaly_sharp_wave":     {"label": "尖波", "color": "#F97316", "source": "anomaly_detection"},
    "anomaly_spike_and_slow": {"label": "棘慢复合波", "color": "#DC2626", "source": "anomaly_detection"},
    "anomaly_slow_wave":      {"label": "慢波异常", "color": "#FBBF24", "source": "anomaly_detection"},
    "anomaly_rhythmic":       {"label": "节律异常", "color": "#3B82F6", "source": "anomaly_detection"},
    # 用户标注
    "user_note":      {"label": "用户标注", "color": "#10B981", "source": "user"},
}

# 伪迹类型到标注类型的映射
ARTIFACT_TYPE_MAPPING = {
    "eog": "artifact_eog",
    "emg": "artifact_emg",
    "flat": "artifact_flat",
    "drift": "artifact_drift",
    "jump": "artifact_jump",
}

# 异常类型到标注类型的映射
ANOMALY_TYPE_MAPPING = {
    "spike": "anomaly_spike",
    "sharp_wave": "anomaly_sharp_wave",
    "spike_and_slow": "anomaly_spike_and_slow",
    "slow_wave": "anomaly_slow_wave",
    "rhythmic": "anomaly_rhythmic",
}


# ============================================================================
# 数据结构定义
# ============================================================================

@dataclass
class Annotation:
    """统一标注格式"""
    id: str                                          # 唯一标识（uuid）
    annotation_type: str                             # 标注类型
    source: str                                      # 来源："preprocess" / "band_analysis" / "anomaly_detection" / "user"
    channel: Optional[str]                           # 通道名（None 表示所有通道）
    start_time: float                                # 开始时间(秒)
    end_time: float                                  # 结束时间(秒)
    label: str                                       # 显示标签
    color: str                                       # 显示颜色（十六进制）
    severity: float                                  # 严重程度 0.0-1.0
    confidence: float                                # 置信度 0.0-1.0
    metadata: Dict[str, Any]                         # 扩展信息
    is_user_created: bool                            # 是否用户手动创建
    created_at: Optional[str] = None                 # 创建时间（ISO 8601）

    def __post_init__(self):
        """初始化后处理"""
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return asdict(self)


@dataclass
class AnnotationSet:
    """标注集合"""
    file_id: str
    annotations: List[Annotation]
    summary: Dict[str, int] = field(default_factory=dict)  # 各类型计数
    generated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def __post_init__(self):
        """初始化后处理：计算 summary"""
        if not self.summary:
            self.summary = {}
            for ann in self.annotations:
                self.summary[ann.annotation_type] = self.summary.get(ann.annotation_type, 0) + 1

    def filter_by_type(self, types: List[str]) -> "AnnotationSet":
        """按类型过滤"""
        filtered = [ann for ann in self.annotations if ann.annotation_type in types]
        return AnnotationSet(
            file_id=self.file_id,
            annotations=filtered,
            generated_at=self.generated_at,
        )

    def filter_by_channel(self, channels: List[str]) -> "AnnotationSet":
        """按通道过滤"""
        filtered = [
            ann for ann in self.annotations
            if ann.channel is None or ann.channel in channels
        ]
        return AnnotationSet(
            file_id=self.file_id,
            annotations=filtered,
            generated_at=self.generated_at,
        )

    def filter_by_time_range(self, start: float, end: float) -> "AnnotationSet":
        """按时间范围过滤"""
        filtered = [
            ann for ann in self.annotations
            if not (ann.end_time < start or ann.start_time > end)
        ]
        return AnnotationSet(
            file_id=self.file_id,
            annotations=filtered,
            generated_at=self.generated_at,
        )

    def to_dict(self) -> Dict[str, Any]:
        """序列化"""
        return {
            'file_id': self.file_id,
            'annotations': [ann.to_dict() for ann in self.annotations],
            'summary': self.summary,
            'generated_at': self.generated_at,
        }


# ============================================================================
# AnnotationBuilder - 从分析结果构建标注
# ============================================================================

class AnnotationBuilder:
    """从分析结果构建标注集"""

    @staticmethod
    def from_artifacts(artifacts: List["ArtifactEvent"]) -> List[Annotation]:
        """将伪迹事件转为标注

        映射：artifact_type -> annotation_type
        eog -> artifact_eog, emg -> artifact_emg, flat -> artifact_flat,
        drift -> artifact_drift, jump -> artifact_jump

        Args:
            artifacts: 伪迹事件列表

        Returns:
            标注列表
        """
        annotations = []

        for artifact in artifacts:
            # 映射伪迹类型
            annotation_type = ARTIFACT_TYPE_MAPPING.get(
                artifact.artifact_type,
                f"artifact_{artifact.artifact_type}"
            )

            # 获取样式配置
            style = ANNOTATION_STYLES.get(annotation_type, {})
            label = style.get("label", f"{artifact.artifact_type} 伪迹")
            color = style.get("color", "#999999")

            # 创建标注
            annotation = Annotation(
                id=str(uuid.uuid4()),
                annotation_type=annotation_type,
                source="preprocess",
                channel=artifact.channel,
                start_time=artifact.start_time,
                end_time=artifact.end_time,
                label=label,
                color=color,
                severity=float(artifact.severity),
                confidence=1.0,  # 伪迹检测没有置信度，设为 1.0
                metadata={
                    "description": artifact.description,
                },
                is_user_created=False,
            )
            annotations.append(annotation)

        logger.info(f"从 {len(artifacts)} 个伪迹事件创建了 {len(annotations)} 个标注")
        return annotations

    @staticmethod
    def from_band_analysis(band_analysis: "BandAnalysisReport") -> List[Annotation]:
        """将频段分析结果转为标注

        对每个通道，标记 dominant_band 作为 band_dominant 标注
        时间范围覆盖整个信号
        metadata 包含各频段的 relative_power

        Args:
            band_analysis: 频段分析报告

        Returns:
            标注列表
        """
        annotations = []

        if band_analysis is None or not band_analysis.channel_results:
            logger.warning("频段分析结果为空，无法创建标注")
            return annotations

        # 获取信号时长（从分析参数中）
        duration = band_analysis.analysis_params.get('duration_seconds', 0)

        for ch_name, ch_result in band_analysis.channel_results.items():
            dominant_band = ch_result.dominant_band

            # 构建频段功率信息
            band_powers = {}
            for band_name, band_feature in ch_result.bands.items():
                band_powers[band_name] = {
                    'relative_power': band_feature.relative_power,
                    'absolute_power': band_feature.absolute_power,
                    'peak_freq': band_feature.peak_freq,
                }

            # 创建标注
            annotation = Annotation(
                id=str(uuid.uuid4()),
                annotation_type="band_dominant",
                source="band_analysis",
                channel=ch_name,
                start_time=0.0,
                end_time=duration,
                label=f"{dominant_band.upper()} 优势频段",
                color=ANNOTATION_STYLES["band_dominant"]["color"],
                severity=0.0,  # 频段不是异常，严重程度为 0
                confidence=1.0,
                metadata={
                    'dominant_band': dominant_band,
                    'band_powers': band_powers,
                },
                is_user_created=False,
            )
            annotations.append(annotation)

        logger.info(f"从频段分析创建了 {len(annotations)} 个标注")
        return annotations

    @staticmethod
    def from_anomaly_report(anomaly_report: "AnomalyReport") -> List[Annotation]:
        """将异常检测报告转为标注

        映射：anomaly_type -> annotation_type
        spike -> anomaly_spike, sharp_wave -> anomaly_sharp_wave,
        spike_and_slow -> anomaly_spike_and_slow, slow_wave -> anomaly_slow_wave,
        rhythmic -> anomaly_rhythmic

        Args:
            anomaly_report: 异常检测报告

        Returns:
            标注列表
        """
        annotations = []

        if anomaly_report is None or not anomaly_report.channel_results:
            logger.warning("异常检测报告为空，无法创建标注")
            return annotations

        for ch_result in anomaly_report.channel_results.values():
            for anomaly in ch_result.anomalies:
                # 映射异常类型
                annotation_type = ANOMALY_TYPE_MAPPING.get(
                    anomaly.anomaly_type,
                    f"anomaly_{anomaly.anomaly_type}"
                )

                # 获取样式配置
                style = ANNOTATION_STYLES.get(annotation_type, {})
                label = style.get("label", anomaly.anomaly_type)
                color = style.get("color", "#999999")

                # 创建标注
                annotation = Annotation(
                    id=str(uuid.uuid4()),
                    annotation_type=annotation_type,
                    source="anomaly_detection",
                    channel=anomaly.channel,
                    start_time=anomaly.start_time,
                    end_time=anomaly.end_time,
                    label=label,
                    color=color,
                    severity=float(anomaly.severity),
                    confidence=float(anomaly.confidence),
                    metadata={
                        'description': anomaly.description,
                        'features': anomaly.features,
                    },
                    is_user_created=False,
                )
                annotations.append(annotation)

        logger.info(f"从异常检测报告创建了 {len(annotations)} 个标注")
        return annotations

    @staticmethod
    def from_preprocess_result(result: "PreprocessResult") -> AnnotationSet:
        """从完整预处理结果构建标注集（合并所有来源）

        1. 始终从 artifacts 构建伪迹标注
        2. 如果 band_analysis 不为 None，构建频段标注
        3. 如果 anomaly_report 不为 None，构建异常标注

        Args:
            result: 预处理结果

        Returns:
            标注集合
        """
        all_annotations = []

        # 1. 伪迹标注（始终存在）
        artifact_annotations = AnnotationBuilder.from_artifacts(result.artifacts)
        all_annotations.extend(artifact_annotations)

        # 2. 频段标注（可选）
        if result.band_analysis is not None:
            band_annotations = AnnotationBuilder.from_band_analysis(result.band_analysis)
            all_annotations.extend(band_annotations)

        # 3. 异常标注（可选）
        if result.anomaly_report is not None:
            anomaly_annotations = AnnotationBuilder.from_anomaly_report(result.anomaly_report)
            all_annotations.extend(anomaly_annotations)

        # 生成 file_id（使用 raw 的第一个文件名，如果没有则使用时间戳）
        if (hasattr(result.raw_clean, 'filenames') and
            result.raw_clean.filenames and
            result.raw_clean.filenames[0] is not None):
            file_id = result.raw_clean.filenames[0]
        else:
            import time
            file_id = f"processed_{int(time.time())}"

        return AnnotationSet(
            file_id=file_id,
            annotations=all_annotations,
        )


# ============================================================================
# AnnotationManager - 标注管理器
# ============================================================================

class AnnotationManager:
    """标注管理器（负责 CRUD 和缓存）"""

    def __init__(self):
        self._cache: Dict[str, AnnotationSet] = {}
        self._user_annotations: Dict[str, List[Annotation]] = {}

    def generate_annotations(
        self,
        file_id: str,
        run_band_analysis: bool = True,
        run_anomaly_detection: bool = True,
        anomaly_sensitivity: float = 1.0
    ) -> AnnotationSet:
        """执行完整分析并生成标注

        1. 加载 EDF -> AutoPreprocessPipeline -> PreprocessResult
        2. 调用 AnnotationBuilder.from_preprocess_result(result)
        3. 合并已有的用户标注
        4. 缓存结果

        Args:
            file_id: 文件 ID
            run_band_analysis: 是否运行频段分析
            run_anomaly_detection: 是否运行异常检测
            anomaly_sensitivity: 异常检测灵敏度

        Returns:
            标注集合
        """
        from app.services.auto_preprocess import AutoPreprocessPipeline
        from app.services.file_manager import get_file_path

        logger.info(f"为文件 {file_id} 生成标注")

        try:
            # 获取文件路径
            file_path = get_file_path(file_id)

            # 运行预处理流水线
            pipeline = AutoPreprocessPipeline(
                file_path=str(file_path),
                reference="average",
                notch_freq=50.0,
                bandpass_low=0.5,
                bandpass_high=50.0,
                run_band_analysis=run_band_analysis,
                run_anomaly_detection=run_anomaly_detection,
                anomaly_sensitivity=anomaly_sensitivity,
            )

            result = pipeline.run()

            # 构建标注集
            annotation_set = AnnotationBuilder.from_preprocess_result(result)
            annotation_set.file_id = file_id  # 使用指定的 file_id

            # 合并已有的用户标注
            if file_id in self._user_annotations:
                user_annotations = self._user_annotations[file_id]
                annotation_set.annotations.extend(user_annotations)

            # 重新计算 summary
            annotation_set.summary = {}
            for ann in annotation_set.annotations:
                annotation_set.summary[ann.annotation_type] = \
                    annotation_set.summary.get(ann.annotation_type, 0) + 1

            # 缓存结果
            self._cache[file_id] = annotation_set

            logger.info(
                f"为文件 {file_id} 生成了 {len(annotation_set.annotations)} 个标注: "
                f"{annotation_set.summary}"
            )

            return annotation_set

        except FileNotFoundError:
            logger.error(f"文件未找到: {file_id}")
            raise
        except Exception as e:
            logger.error(f"生成标注失败: {e}")
            raise

    def get_annotations(
        self,
        file_id: str,
        start: Optional[float] = None,
        end: Optional[float] = None,
        types: Optional[List[str]] = None,
        channels: Optional[List[str]] = None
    ) -> AnnotationSet:
        """获取标注（支持过滤），优先从缓存读取

        Args:
            file_id: 文件 ID
            start: 开始时间（可选）
            end: 结束时间（可选）
            types: 标注类型列表（可选）
            channels: 通道列表（可选）

        Returns:
            标注集合
        """
        if file_id not in self._cache:
            logger.warning(f"文件 {file_id} 的标注未缓存，尝试生成")
            self.generate_annotations(file_id)

        annotation_set = self._cache[file_id]

        # 应用过滤
        if types is not None:
            annotation_set = annotation_set.filter_by_type(types)
        if channels is not None:
            annotation_set = annotation_set.filter_by_channel(channels)
        if start is not None or end is not None:
            start = start if start is not None else 0
            end = end if end is not None else float('inf')
            annotation_set = annotation_set.filter_by_time_range(start, end)

        return annotation_set

    def add_user_annotation(
        self,
        file_id: str,
        annotation_type: str,
        channel: str,
        start_time: float,
        end_time: float,
        label: str,
        note: str = ""
    ) -> Annotation:
        """添加用户手动标注

        Args:
            file_id: 文件 ID
            annotation_type: 标注类型
            channel: 通道名
            start_time: 开始时间
            end_time: 结束时间
            label: 标签
            note: 备注

        Returns:
            创建的标注
        """
        # 获取样式配置
        style = ANNOTATION_STYLES.get(annotation_type, {})
        color = style.get("color", "#10B981")

        # 创建用户标注
        annotation = Annotation(
            id=str(uuid.uuid4()),
            annotation_type=annotation_type,
            source="user",
            channel=channel,
            start_time=start_time,
            end_time=end_time,
            label=label,
            color=color,
            severity=0.0,
            confidence=1.0,
            metadata={
                'note': note,
            },
            is_user_created=True,
        )

        # 添加到用户标注列表
        if file_id not in self._user_annotations:
            self._user_annotations[file_id] = []
        self._user_annotations[file_id].append(annotation)

        # 如果缓存存在，也添加到缓存中
        if file_id in self._cache:
            self._cache[file_id].annotations.append(annotation)
            # 更新 summary
            self._cache[file_id].summary[annotation_type] = \
                self._cache[file_id].summary.get(annotation_type, 0) + 1

        logger.info(f"为文件 {file_id} 添加了用户标注: {label}")
        return annotation

    def delete_user_annotation(self, file_id: str, annotation_id: str) -> bool:
        """删除用户标注

        Args:
            file_id: 文件 ID
            annotation_id: 标注 ID

        Returns:
            是否成功删除
        """
        deleted = False

        # 从用户标注列表中删除
        if file_id in self._user_annotations:
            original_count = len(self._user_annotations[file_id])
            self._user_annotations[file_id] = [
                ann for ann in self._user_annotations[file_id]
                if ann.id != annotation_id
            ]
            if len(self._user_annotations[file_id]) < original_count:
                deleted = True

        # 从缓存中删除（只删除用户标注）
        if file_id in self._cache:
            cache_annotations = self._cache[file_id].annotations
            original_count = len(cache_annotations)
            self._cache[file_id].annotations = [
                ann for ann in cache_annotations
                if not (ann.is_user_created and ann.id == annotation_id)
            ]

            if len(self._cache[file_id].annotations) < original_count:
                # 更新 summary
                for ann in cache_annotations:
                    if ann.is_user_created and ann.id == annotation_id:
                        ann_type = ann.annotation_type
                        if ann_type in self._cache[file_id].summary:
                            self._cache[file_id].summary[ann_type] -= 1
                            if self._cache[file_id].summary[ann_type] <= 0:
                                del self._cache[file_id].summary[ann_type]
                        break
                deleted = True

        if deleted:
            logger.info(f"为文件 {file_id} 删除了用户标注: {annotation_id}")
            return True

        logger.warning(f"未找到文件 {file_id} 的用户标注: {annotation_id}")
        return False

    def clear_cache(self, file_id: Optional[str] = None):
        """清除缓存

        Args:
            file_id: 文件 ID，None 表示清除所有缓存
        """
        if file_id is None:
            self._cache.clear()
            logger.info("清除了所有标注缓存")
        elif file_id in self._cache:
            del self._cache[file_id]
            logger.info(f"清除了文件 {file_id} 的标注缓存")


# 全局单例
_annotation_manager = AnnotationManager()


def get_annotation_manager() -> AnnotationManager:
    """获取全局标注管理器单例"""
    return _annotation_manager
