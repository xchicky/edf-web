"""
Pipeline API endpoint - Sequential EEG processing pipeline
"""

import asyncio
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.pipeline_service import PipelineService
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class PipelineStepRequest(BaseModel):
    id: str
    category: str  # "preprocess" | "analysis"
    method: str
    parameters: Optional[Dict[str, Any]] = None
    enabled: bool = True


class PipelineRequest(BaseModel):
    steps: List[PipelineStepRequest]
    start: float
    duration: float
    channels: Optional[List[str]] = None


class StepLog(BaseModel):
    step_id: str
    status: str  # "success" | "error" | "skipped"
    duration_ms: int
    message: str


class ProcessedWaveformData(BaseModel):
    data: List[List[float]]
    times: List[float]
    channels: List[str]
    sfreq: float
    n_samples: int
    start_time: float
    duration: float


class PipelineResponse(BaseModel):
    processed_waveform: Optional[ProcessedWaveformData] = None
    annotations: List[Dict[str, Any]] = []
    step_logs: List[StepLog] = []
    total_processing_time_ms: int = 0


@router.post("/pipeline/{file_id}", response_model=PipelineResponse)
async def run_pipeline(file_id: str, request: PipelineRequest):
    """
    执行处理流水线：串行预处理 → 分析 → 返回处理后波形和标注
    """
    try:
        file_path = get_file_path(file_id)

        steps = [s.model_dump() for s in request.steps]

        def _run():
            service = PipelineService()
            return service.run_pipeline(
                file_path=file_path,
                steps=steps,
                start=request.start,
                duration=request.duration,
                channels=request.channels,
            )

        result = await asyncio.to_thread(_run)

        processed_waveform = None
        if result["processed_data"] is not None:
            data = result["processed_data"]
            if isinstance(data, np.ndarray):
                data = data.tolist()
            processed_waveform = ProcessedWaveformData(
                data=data,
                times=result["times"],
                channels=result["channels"],
                sfreq=result["sfreq"],
                n_samples=result["n_samples"],
                start_time=result["start_time"],
                duration=result["duration"],
            )

        step_logs = [
            StepLog(**log) for log in result.get("step_logs", [])
        ]

        logger.info(
            f"Pipeline completed for {file_id}: "
            f"{len(result.get('annotations', []))} annotations, "
            f"{result.get('total_processing_time_ms', 0)}ms"
        )

        return PipelineResponse(
            processed_waveform=processed_waveform,
            annotations=result.get("annotations", []),
            step_logs=step_logs,
            total_processing_time_ms=result.get("total_processing_time_ms", 0),
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        raise HTTPException(status_code=500, detail=f"流水线执行失败: {str(e)}")
