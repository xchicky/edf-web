"""
Signals API endpoint - Validate and calculate derived signals
"""

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.signal_calculator import SignalCalculator
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class OperandDefinition(BaseModel):
    """操作数定义"""
    id: str
    channelName: str
    channelIndex: int
    coefficient: Optional[float] = 1.0


class SignalDefinition(BaseModel):
    """信号定义"""
    id: str
    expression: str
    operands: List[OperandDefinition]


class SignalValidationRequest(BaseModel):
    """表达式验证请求"""
    expression: str
    channel_names: List[str]


class SignalValidationResponse(BaseModel):
    """表达式验证响应"""
    isValid: bool
    error: Optional[str] = None
    referencedChannels: Optional[List[str]] = None
    constants: Optional[List[float]] = None


class SignalCalculationRequest(BaseModel):
    """信号计算请求"""
    file_id: str
    signals: List[SignalDefinition]
    start: float
    duration: float


class SignalComputationResult(BaseModel):
    """信号计算结果"""
    id: str
    name: str
    data: List[float]
    times: List[float]
    sfreq: float
    n_samples: int


class SignalCalculationResponse(BaseModel):
    """信号计算响应"""
    results: List[SignalComputationResult]


@router.post("/validate", response_model=SignalValidationResponse)
async def validate_signal_expression(request: SignalValidationRequest):
    """
    验证信号表达式

    Args:
        request: 包含 expression 和 channel_names

    Returns:
        验证结果
    """
    try:
        from app.utils.expression_validator import validate_expression

        result = validate_expression(request.expression, request.channel_names)

        return SignalValidationResponse(
            isValid=result["isValid"],
            error=result.get("error"),
            referencedChannels=result.get("referencedChannels"),
            constants=result.get("constants"),
        )

    except Exception as e:
        logger.error(f"Expression validation error: {e}")
        raise HTTPException(status_code=400, detail=f"验证失败: {str(e)}")


@router.post("/calculate", response_model=SignalCalculationResponse)
async def calculate_signals(request: SignalCalculationRequest):
    """
    计算派生信号

    Args:
        request: 包含 file_id、signals、start、duration

    Returns:
        计算结果
    """
    try:
        # 获取文件路径
        file_path = get_file_path(request.file_id)

        # 转换信号定义为字典格式
        signals_data = []
        for signal in request.signals:
            signals_data.append({
                "id": signal.id,
                "name": signal.id,  # 使用 id 作为 name（前端会提供完整的 name）
                "expression": signal.expression,
                "operands": [
                    {
                        "channelIndex": op.channelIndex,
                        "channelName": op.channelName,
                    }
                    for op in signal.operands
                ],
            })

        def _compute():
            calculator = SignalCalculator(file_path)
            return calculator.calculate_signals(
                signals_data,
                request.start,
                request.duration,
            )

        # 计算信号（在线程池中执行阻塞操作）
        results = await asyncio.to_thread(_compute)

        # 转换结果
        response_results = []
        for result in results:
            response_results.append(
                SignalComputationResult(
                    id=result["id"],
                    name=result["name"],
                    data=result["data"],
                    times=result["times"],
                    sfreq=result["sfreq"],
                    n_samples=result["n_samples"],
                )
            )

        logger.info(f"Calculated {len(response_results)} signals for {request.file_id}")

        return SignalCalculationResponse(results=response_results)

    except FileNotFoundError:
        logger.error(f"File not found: {request.file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {request.file_id}")
    except Exception as e:
        logger.error(f"Signal calculation error: {e}")
        raise HTTPException(status_code=500, detail=f"计算失败: {str(e)}")
