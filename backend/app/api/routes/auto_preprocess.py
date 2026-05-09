"""
Auto Preprocess API Routes

提供 EEG 自动预处理流水线 API 端点
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
import logging
import time
import asyncio

from app.services.file_manager import get_file_path
from app.services.auto_preprocess import AutoPreprocessPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auto_preprocess", tags=["auto_preprocess"])


# ============================================================================
# Pydantic Models
# ============================================================================

class AutoPreprocessConfig(BaseModel):
    """自动预处理配置"""
    reference: Literal["average", "linked-mastoid"] = "average"
    notch_filter: bool = True
    notch_freq: float = Field(default=50.0, description="Notch 滤波频率 (Hz)")
    notch_harmonics: bool = Field(default=True, description="是否去除谐波")
    bandpass_enabled: bool = True
    bandpass_low: float = Field(default=0.5, ge=0.1, le=10.0)
    bandpass_high: float = Field(default=50.0, ge=10.0, le=100.0)
    # 伪迹检测
    artifact_detection: bool = True
    eog_threshold: float = Field(default=75.0, description="EOG 幅值阈值 (µV)")
    emg_threshold: float = Field(default=50.0, description="EMG 幅值阈值 (µV)")
    flat_threshold: float = Field(default=0.5, description="平坦信号阈值 (µV)")
    drift_threshold: float = Field(default=100.0, description="漂移阈值 (µV)")
    jump_threshold: float = Field(default=200.0, description="跳变阈值 (µV)")
    # 可选分析
    run_band_analysis: bool = False
    run_anomaly_detection: bool = False
    anomaly_sensitivity: float = Field(default=1.0, ge=0.5, le=2.0)


class ArtifactEventResponse(BaseModel):
    """伪迹事件响应"""
    start_time: float
    end_time: float
    artifact_type: str
    channel: Optional[str] = None
    severity: float
    description: str


class AutoPreprocessResponse(BaseModel):
    """自动预处理响应"""
    file_id: str
    processing_time: float
    channel_types: Dict[str, str]
    preprocess_log: Dict[str, Any]
    artifacts: List[ArtifactEventResponse]
    artifact_summary: Dict[str, int]


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/{file_id}", response_model=AutoPreprocessResponse)
async def run_auto_preprocess(
    file_id: str,
    config: AutoPreprocessConfig,
):
    """
    执行自动预处理流水线

    步骤：
    1. 通道类型识别
    2. 重参考
    3. Notch 滤波
    4. 带通滤波
    5. 伪迹检测
    6. 伪迹标记
    """
    start_time = time.time()

    # 获取文件路径
    file_path = get_file_path(file_id)
    if not file_path:
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")

    try:
        # 在进程池中执行 CPU 密集任务
        def run_pipeline():
            pipeline = AutoPreprocessPipeline(
                file_path=str(file_path),
                reference=config.reference,
                notch_freq=config.notch_freq if config.notch_filter else None,
                notch_harmonics=config.notch_harmonics,
                bandpass_low=config.bandpass_low,
                bandpass_high=config.bandpass_high,
                eog_threshold=config.eog_threshold,
                emg_threshold=config.emg_threshold,
                flat_threshold=config.flat_threshold,
                drift_threshold=config.drift_threshold,
                jump_threshold=config.jump_threshold,
                run_band_analysis=config.run_band_analysis,
                run_anomaly_detection=config.run_anomaly_detection,
                anomaly_sensitivity=config.anomaly_sensitivity,
            )
            return pipeline.run()

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_pipeline)

        # 转换伪迹事件
        artifacts = [
            ArtifactEventResponse(
                start_time=a.start_time,
                end_time=a.end_time,
                artifact_type=a.artifact_type,
                channel=a.channel,
                severity=a.severity,
                description=a.description,
            )
            for a in result.artifacts
        ]

        # 生成伪迹摘要
        artifact_summary = {}
        for a in result.artifacts:
            artifact_summary[a.artifact_type] = artifact_summary.get(a.artifact_type, 0) + 1

        processing_time = time.time() - start_time

        return AutoPreprocessResponse(
            file_id=file_id,
            processing_time=processing_time,
            channel_types=result.preprocess_log.get("channel_types", {}),
            preprocess_log=result.preprocess_log,
            artifacts=artifacts,
            artifact_summary=artifact_summary,
        )

    except Exception as e:
        logger.error(f"自动预处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"预处理失败: {str(e)}")
