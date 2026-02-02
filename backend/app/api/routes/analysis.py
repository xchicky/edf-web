"""
Analysis API endpoint - Time domain stats, frequency analysis, and comprehensive analysis
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.analysis_service import AnalysisService
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class TimeDomainRequest(BaseModel):
    """时域分析请求"""
    channels: Optional[List[str]] = None
    start: float
    duration: float


class ChannelTimeDomainStats(BaseModel):
    """单个通道的时域统计"""
    mean: float
    std: float
    min: float
    max: float
    rms: float
    peak_to_peak: float
    kurtosis: float
    skewness: float
    n_samples: int


class TimeDomainResponse(BaseModel):
    """时域分析响应"""
    file_id: str
    channels: List[str]
    statistics: Dict[str, ChannelTimeDomainStats]


class BandPowerRequest(BaseModel):
    """频带功率分析请求"""
    channels: Optional[List[str]] = None
    start: float
    duration: float
    bands: Optional[Dict[str, List[float]]] = None


class BandPowerResult(BaseModel):
    """单个频带的功率结果"""
    absolute: float
    relative: float
    range: List[float]


class BandPowerResponse(BaseModel):
    """频带功率响应"""
    file_id: str
    channels: List[str]
    band_powers: Dict[str, Dict[str, BandPowerResult]]


class PSDRequest(BaseModel):
    """PSD 分析请求"""
    channels: Optional[List[str]] = None
    start: float
    duration: float
    fmin: float = 0.5
    fmax: float = 50


class PSDResult(BaseModel):
    """单个通道的 PSD 结果"""
    frequencies: List[float]
    psd: List[float]
    sfreq: float


class PSDResponse(BaseModel):
    """PSD 响应"""
    file_id: str
    channels: List[str]
    psd_data: Dict[str, PSDResult]


class ComprehensiveRequest(BaseModel):
    """综合分析请求"""
    channels: Optional[List[str]] = None
    start: float
    duration: float
    fmin: float = 0.5
    fmax: float = 50
    bands: Optional[Dict[str, List[float]]] = None


class ComprehensiveResponse(BaseModel):
    """综合分析响应"""
    file_id: str
    channels: List[str]
    time_domain: Optional[Dict[str, ChannelTimeDomainStats]] = None
    band_power: Optional[Dict[str, Dict[str, BandPowerResult]]] = None
    psd: Optional[Dict[str, PSDResult]] = None


@router.post("/time_domain/{file_id}", response_model=TimeDomainResponse)
async def analyze_time_domain(file_id: str, request: TimeDomainRequest):
    """
    时域统计分析

    计算指定时间窗口内各通道的统计量：
    - mean: 平均值
    - std: 标准差
    - min/max: 最小/最大值
    - rms: 均方根
    - peak_to_peak: 峰峰值
    - kurtosis: 峰度
    - skewness: 偏度

    Args:
        file_id: EDF 文件 ID
        request: 包含 channels（可选）、start、duration

    Returns:
        时域统计结果
    """
    try:
        # 获取文件路径
        file_path = get_file_path(file_id)

        # 创建分析服务
        analyzer = AnalysisService(file_path)

        # 计算时域统计
        results = analyzer.compute_time_domain_stats(
            start_time=request.start,
            duration=request.duration,
            channels=request.channels,
        )

        # 确定通道列表
        if request.channels is None:
            # 从结果中获取通道
            channels = list(results.keys())
        else:
            channels = request.channels

        # 构建响应
        statistics = {}
        for ch in channels:
            if ch in results:
                statistics[ch] = ChannelTimeDomainStats(**results[ch])

        logger.info(
            f"Time domain analysis completed for {file_id}: "
            f"{len(statistics)} channels, {request.duration}s window"
        )

        return TimeDomainResponse(
            file_id=file_id,
            channels=channels,
            statistics=statistics,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"Time domain analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/band_power/{file_id}", response_model=BandPowerResponse)
async def analyze_band_power(file_id: str, request: BandPowerRequest):
    """
    频带功率分析

    计算各 EEG 频带的绝对功率和相对功率：
    - delta: 0.5-4 Hz
    - theta: 4-8 Hz
    - alpha: 8-13 Hz
    - beta: 13-30 Hz
    - gamma: 30-50 Hz

    Args:
        file_id: EDF 文件 ID
        request: 包含 channels（可选）、start、duration、bands（可选）

    Returns:
        频带功率结果
    """
    try:
        # 获取文件路径
        file_path = get_file_path(file_id)

        # 创建分析服务
        analyzer = AnalysisService(file_path)

        # 转换频带格式
        bands = None
        if request.bands is not None:
            bands = {
                name: (range_[0], range_[1])
                for name, range_ in request.bands.items()
            }

        # 计算频带功率
        results = analyzer.compute_band_power(
            start_time=request.start,
            duration=request.duration,
            channels=request.channels,
            bands=bands,
        )

        # 确定通道列表
        if request.channels is None:
            channels = list(results.keys())
        else:
            channels = request.channels

        # 构建响应
        band_powers = {}
        for ch in channels:
            if ch in results:
                band_powers[ch] = {}
                for band_name, band_data in results[ch].items():
                    band_powers[ch][band_name] = BandPowerResult(
                        absolute=band_data["absolute"],
                        relative=band_data["relative"],
                        range=band_data["range"],
                    )

        logger.info(
            f"Band power analysis completed for {file_id}: "
            f"{len(band_powers)} channels"
        )

        return BandPowerResponse(
            file_id=file_id,
            channels=channels,
            band_powers=band_powers,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"Band power analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/psd/{file_id}", response_model=PSDResponse)
async def analyze_psd(file_id: str, request: PSDRequest):
    """
    功率谱密度 (PSD) 分析

    使用 Welch 方法计算功率谱密度

    Args:
        file_id: EDF 文件 ID
        request: 包含 channels（可选）、start、duration、fmin、fmax

    Returns:
        PSD 结果（频率数组和功率值）
    """
    try:
        # 获取文件路径
        file_path = get_file_path(file_id)

        # 创建分析服务
        analyzer = AnalysisService(file_path)

        # 计算 PSD
        results = analyzer.compute_psd(
            start_time=request.start,
            duration=request.duration,
            channels=request.channels,
            fmin=request.fmin,
            fmax=request.fmax,
        )

        # 确定通道列表
        if request.channels is None:
            channels = list(results.keys())
        else:
            channels = request.channels

        # 构建响应
        psd_data = {}
        for ch in channels:
            if ch in results:
                psd_data[ch] = PSDResult(**results[ch])

        logger.info(
            f"PSD analysis completed for {file_id}: {len(psd_data)} channels"
        )

        return PSDResponse(
            file_id=file_id,
            channels=channels,
            psd_data=psd_data,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"PSD analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/comprehensive/{file_id}", response_model=ComprehensiveResponse)
async def analyze_comprehensive(file_id: str, request: ComprehensiveRequest):
    """
    综合分析

    同时返回时域统计、频带功率和 PSD 结果

    Args:
        file_id: EDF 文件 ID
        request: 包含 channels（可选）、start、duration、fmin、fmax、bands（可选）

    Returns:
        综合分析结果
    """
    try:
        # 获取文件路径
        file_path = get_file_path(file_id)

        # 创建分析服务
        analyzer = AnalysisService(file_path)

        # 转换频带格式
        bands = None
        if request.bands is not None:
            bands = {
                name: (range_[0], range_[1])
                for name, range_ in request.bands.items()
            }

        # 确定通道列表
        channels = request.channels

        # 计算时域统计
        time_domain_results = analyzer.compute_time_domain_stats(
            start_time=request.start,
            duration=request.duration,
            channels=channels,
        )

        # 构建时域统计响应
        time_domain = {}
        if channels is None:
            channels = list(time_domain_results.keys())

        for ch in channels:
            if ch in time_domain_results:
                time_domain[ch] = ChannelTimeDomainStats(**time_domain_results[ch])

        # 计算频带功率
        band_power_results = analyzer.compute_band_power(
            start_time=request.start,
            duration=request.duration,
            channels=channels,
            bands=bands,
        )

        # 构建频带功率响应
        band_power = {}
        for ch in channels:
            if ch in band_power_results:
                band_power[ch] = {}
                for band_name, band_data in band_power_results[ch].items():
                    band_power[ch][band_name] = BandPowerResult(
                        absolute=band_data["absolute"],
                        relative=band_data["relative"],
                        range=band_data["range"],
                    )

        # 计算 PSD
        psd_results = analyzer.compute_psd(
            start_time=request.start,
            duration=request.duration,
            channels=channels,
            fmin=request.fmin,
            fmax=request.fmax,
        )

        # 构建 PSD 响应
        psd = {}
        for ch in channels:
            if ch in psd_results:
                psd[ch] = PSDResult(**psd_results[ch])

        logger.info(
            f"Comprehensive analysis completed for {file_id}: "
            f"{len(channels)} channels"
        )

        return ComprehensiveResponse(
            file_id=file_id,
            channels=channels,
            time_domain=time_domain,
            band_power=band_power,
            psd=psd,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except Exception as e:
        logger.error(f"Comprehensive analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")
