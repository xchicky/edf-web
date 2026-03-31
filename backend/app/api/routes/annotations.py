"""
Annotations API endpoint - EEG 标注系统

提供伪迹检测、频段分析、异常检测结果的统一标注格式，支持生成、查询和用户标注管理。
"""

import asyncio
import functools
from concurrent.futures import ProcessPoolExecutor

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.annotation_service import (
    Annotation,
    AnnotationSet,
    get_annotation_manager,
)
import logging

logger = logging.getLogger(__name__)

# Dedicated ProcessPoolExecutor for CPU-intensive annotation generation.
# This bypasses the GIL so the uvicorn event loop stays responsive.
_annotation_executor = ProcessPoolExecutor(max_workers=2)

router = APIRouter()


# ============================================================================
# Pydantic 模型
# ============================================================================

class GenerateAnnotationsRequest(BaseModel):
    """生成标注请求"""
    run_band_analysis: bool = True
    run_anomaly_detection: bool = True
    anomaly_sensitivity: float = 1.0


class UserAnnotationRequest(BaseModel):
    """用户标注请求"""
    annotation_type: str = "user_note"
    channel: str
    start_time: float
    end_time: float
    label: str
    note: str = ""


class MetadataResponse(BaseModel):
    """元数据响应"""
    note: Optional[str] = None
    description: Optional[str] = None
    dominant_band: Optional[str] = None
    band_powers: Optional[Dict[str, Any]] = None
    features: Optional[Dict[str, Any]] = None


class AnnotationResponse(BaseModel):
    """标注响应"""
    id: str
    annotation_type: str
    source: str
    channel: Optional[str]
    start_time: float
    end_time: float
    label: str
    color: str
    severity: float
    confidence: float
    metadata: Dict[str, Any]
    is_user_created: bool
    created_at: Optional[str] = None


class AnnotationSetResponse(BaseModel):
    """标注集合响应"""
    file_id: str
    annotations: List[AnnotationResponse]
    summary: Dict[str, int]
    generated_at: str


# ============================================================================
# 转换函数
# ============================================================================

def _annotation_to_response(annotation: Annotation) -> AnnotationResponse:
    """转换 Annotation 为响应模型"""
    return AnnotationResponse(
        id=annotation.id,
        annotation_type=annotation.annotation_type,
        source=annotation.source,
        channel=annotation.channel,
        start_time=annotation.start_time,
        end_time=annotation.end_time,
        label=annotation.label,
        color=annotation.color,
        severity=annotation.severity,
        confidence=annotation.confidence,
        metadata=annotation.metadata,
        is_user_created=annotation.is_user_created,
        created_at=annotation.created_at,
    )


def _annotation_set_to_response(annotation_set: AnnotationSet) -> AnnotationSetResponse:
    """转换 AnnotationSet 为响应模型"""
    return AnnotationSetResponse(
        file_id=annotation_set.file_id,
        annotations=[
            _annotation_to_response(ann) for ann in annotation_set.annotations
        ],
        summary=annotation_set.summary,
        generated_at=annotation_set.generated_at,
    )


# ============================================================================
# API 端点
# ============================================================================

@router.post(
    "/annotations/{file_id}/generate",
    response_model=AnnotationSetResponse
)
async def generate_annotations(
    file_id: str,
    request: GenerateAnnotationsRequest
):
    """
    触发完整分析并生成标注

    执行完整的预处理流水线，包括：
    - 伪迹检测（EOG/EMG/Flat/Drift/Jump）
    - 频段分析（可选）
    - 异常检测（可选）

    Args:
        file_id: EDF 文件 ID
        request: 包含 run_band_analysis、run_anomaly_detection、anomaly_sensitivity

    Returns:
        完整的标注集合
    """
    try:
        manager = get_annotation_manager()

        logger.info(
            f"为文件 {file_id} 生成标注: "
            f"band_analysis={request.run_band_analysis}, "
            f"anomaly_detection={request.run_anomaly_detection}, "
            f"sensitivity={request.anomaly_sensitivity}"
        )

        loop = asyncio.get_event_loop()
        generate_fn = functools.partial(
            manager.generate_annotations,
            file_id=file_id,
            run_band_analysis=request.run_band_analysis,
            run_anomaly_detection=request.run_anomaly_detection,
            anomaly_sensitivity=request.anomaly_sensitivity,
        )
        annotation_set = await loop.run_in_executor(
            _annotation_executor,
            generate_fn,
        )

        return _annotation_set_to_response(annotation_set)

    except FileNotFoundError:
        logger.error(f"文件未找到: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"生成标注失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成标注失败: {str(e)}")


@router.get(
    "/annotations/{file_id}",
    response_model=AnnotationSetResponse
)
async def get_annotations(
    file_id: str,
    start: Optional[float] = Query(None, description="开始时间（秒）"),
    end: Optional[float] = Query(None, description="结束时间（秒）"),
    types: Optional[str] = Query(None, description="标注类型（逗号分隔）"),
    channels: Optional[str] = Query(None, description="通道列表（逗号分隔）"),
):
    """
    获取标注（支持过滤）

    支持按类型、通道、时间范围过滤标注。

    Args:
        file_id: EDF 文件 ID
        start: 开始时间（秒）
        end: 结束时间（秒）
        types: 标注类型（逗号分隔，如 "artifact_eog,anomaly_spike"）
        channels: 通道列表（逗号分隔，如 "Fp1,Fp2"）

    Returns:
        过滤后的标注集合
    """
    try:
        manager = get_annotation_manager()

        # 解析过滤参数
        type_list = None
        if types is not None:
            type_list = [t.strip() for t in types.split(",") if t.strip()]

        channel_list = None
        if channels is not None:
            channel_list = [ch.strip() for ch in channels.split(",") if ch.strip()]

        logger.info(
            f"获取文件 {file_id} 的标注: "
            f"start={start}, end={end}, types={type_list}, channels={channel_list}"
        )

        annotation_set = await asyncio.to_thread(
            manager.get_annotations,
            file_id=file_id,
            start=start,
            end=end,
            types=type_list,
            channels=channel_list,
        )

        return _annotation_set_to_response(annotation_set)

    except FileNotFoundError:
        logger.error(f"文件未找到: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"获取标注失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取标注失败: {str(e)}")


@router.post(
    "/annotations/{file_id}/user",
    response_model=AnnotationResponse
)
async def add_user_annotation(
    file_id: str,
    request: UserAnnotationRequest
):
    """
    添加用户手动标注

    Args:
        file_id: EDF 文件 ID
        request: 包含 annotation_type、channel、start_time、end_time、label、note

    Returns:
        创建的标注
    """
    try:
        manager = get_annotation_manager()

        logger.info(
            f"为文件 {file_id} 添加用户标注: "
            f"{request.label} ({request.start_time}s - {request.end_time}s)"
        )

        annotation = manager.add_user_annotation(
            file_id=file_id,
            annotation_type=request.annotation_type,
            channel=request.channel,
            start_time=request.start_time,
            end_time=request.end_time,
            label=request.label,
            note=request.note,
        )

        return _annotation_to_response(annotation)

    except Exception as e:
        logger.error(f"添加用户标注失败: {e}")
        raise HTTPException(status_code=500, detail=f"添加用户标注失败: {str(e)}")


@router.delete("/annotations/{file_id}/user/{annotation_id}")
async def delete_user_annotation(
    file_id: str,
    annotation_id: str
):
    """
    删除用户标注

    只能删除用户创建的标注，系统生成的标注不能删除。

    Args:
        file_id: EDF 文件 ID
        annotation_id: 标注 ID

    Returns:
        删除结果
    """
    try:
        manager = get_annotation_manager()

        logger.info(f"删除文件 {file_id} 的用户标注: {annotation_id}")

        success = manager.delete_user_annotation(file_id, annotation_id)

        if success:
            return {"message": "标注已删除", "annotation_id": annotation_id}
        else:
            raise HTTPException(
                status_code=404,
                detail=f"未找到标注或标注不是用户创建的: {annotation_id}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除用户标注失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除用户标注失败: {str(e)}")


@router.delete("/annotations/{file_id}/cache")
async def clear_cache(file_id: str):
    """
    清除指定文件的标注缓存

    Args:
        file_id: EDF 文件 ID

    Returns:
        清除结果
    """
    try:
        manager = get_annotation_manager()

        logger.info(f"清除文件 {file_id} 的标注缓存")

        manager.clear_cache(file_id)

        return {"message": f"文件 {file_id} 的标注缓存已清除"}

    except Exception as e:
        logger.error(f"清除缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"清除缓存失败: {str(e)}")


@router.delete("/annotations/cache")
async def clear_all_cache():
    """
    清除所有标注缓存

    Returns:
        清除结果
    """
    try:
        manager = get_annotation_manager()

        logger.info("清除所有标注缓存")

        manager.clear_cache()

        return {"message": "所有标注缓存已清除"}

    except Exception as e:
        logger.error(f"清除缓存失败: {e}")
        raise HTTPException(status_code=500, detail=f"清除缓存失败: {str(e)}")
