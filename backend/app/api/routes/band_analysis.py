"""
Band Analysis API endpoint - EEG 频段波形识别分析

提供频段分解、特征提取、优势频段识别、时间分段分析等功能。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.band_analyzer import BandAnalyzer
from app.services.edf_parser import EDFParser
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class BandAnalysisRequest(BaseModel):
    """频段分析请求"""
    channels: Optional[List[str]] = None
    start: float
    duration: float
    epoch_duration: Optional[float] = None
    include_gamma: bool = True


class BandFeatureResponse(BaseModel):
    """单频段特征响应"""
    band_name: str
    freq_range: List[float]
    absolute_power: float
    relative_power: float
    peak_freq: float
    center_freq: float
    bandwidth: float


class ChannelBandResultResponse(BaseModel):
    """单通道分析结果响应"""
    channel_name: str
    dominant_band: str
    bands: Dict[str, BandFeatureResponse]


class EpochResultResponse(BaseModel):
    """单时段分析结果响应"""
    start_time: float
    end_time: float
    channel_results: Dict[str, ChannelBandResultResponse]


class BandAnalysisResponse(BaseModel):
    """频段分析响应"""
    file_id: str
    channel_results: Dict[str, ChannelBandResultResponse]
    global_dominant_bands: Dict[str, int]
    epoch_results: List[EpochResultResponse]
    analysis_params: Dict[str, Any]


def _convert_band_feature_to_response(feature) -> BandFeatureResponse:
    """转换 BandFeature 为响应模型"""
    return BandFeatureResponse(
        band_name=feature.band_name,
        freq_range=list(feature.freq_range),
        absolute_power=feature.absolute_power,
        relative_power=feature.relative_power,
        peak_freq=feature.peak_freq,
        center_freq=feature.center_freq,
        bandwidth=feature.bandwidth,
    )


def _convert_channel_result_to_response(result) -> ChannelBandResultResponse:
    """转换 ChannelBandResult 为响应模型"""
    bands = {
        name: _convert_band_feature_to_response(feature)
        for name, feature in result.bands.items()
    }
    return ChannelBandResultResponse(
        channel_name=result.channel_name,
        dominant_band=result.dominant_band,
        bands=bands,
    )


def _convert_epoch_to_response(epoch) -> EpochResultResponse:
    """转换 EpochResult 为响应模型"""
    channel_results = {
        name: _convert_channel_result_to_response(result)
        for name, result in epoch.channel_results.items()
    }
    return EpochResultResponse(
        start_time=epoch.start_time,
        end_time=epoch.end_time,
        channel_results=channel_results,
    )


@router.post("/band_analysis/{file_id}", response_model=BandAnalysisResponse)
async def analyze_bands(file_id: str, request: BandAnalysisRequest):
    """
    EEG 频段波形识别分析

    对预处理后的 EEG 信号进行频段分析，包括：
    - 频段分解：delta (0.5-4Hz), theta (4-8Hz), alpha (8-13Hz), beta (13-30Hz), gamma (30-50Hz)
    - 特征提取：绝对功率、相对功率、峰值频率
    - 优势频段识别：每个通道和全局的优势频段
    - 时间分段分析：按固定窗口分段分析（可选）

    Args:
        file_id: EDF 文件 ID
        request: 包含 channels（可选）、start、duration、epoch_duration（可选）、include_gamma

    Returns:
        完整的频段分析报告
    """
    try:
        # 获取文件路径
        file_path = get_file_path(file_id)

        # 加载 EDF 文件
        parser = EDFParser(file_path)

        # 裁剪到指定时间段
        raw = parser.raw.copy().crop(
            tmin=request.start,
            tmax=request.start + request.duration
        )

        # 如果指定了通道，则选择通道
        if request.channels is not None:
            # 验证通道存在
            for ch in request.channels:
                if ch not in raw.ch_names:
                    raise ValueError(f"Channel {ch} not found in EDF file")
            raw.pick_channels(request.channels)

        # 加载数据
        raw.load_data()

        # 创建 BandAnalyzer
        analyzer = BandAnalyzer(
            raw=raw,
            epoch_duration=request.epoch_duration,
            eeg_channels=None,  # 让 analyzer 自动识别
            include_gamma=request.include_gamma,
        )

        # 执行分析
        report = analyzer.analyze()

        # 转换为响应格式
        channel_results = {
            name: _convert_channel_result_to_response(result)
            for name, result in report.channel_results.items()
        }

        epoch_results = [
            _convert_epoch_to_response(epoch)
            for epoch in report.epoch_results
        ]

        logger.info(
            f"Band analysis completed for {file_id}: "
            f"{len(channel_results)} channels, "
            f"{len(epoch_results)} epochs"
        )

        return BandAnalysisResponse(
            file_id=file_id,
            channel_results=channel_results,
            global_dominant_bands=report.global_dominant_bands,
            epoch_results=epoch_results,
            analysis_params=report.analysis_params,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Band analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")
