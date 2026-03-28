"""
Anomaly Detection API endpoint - EEG 异常波形检测分析

提供棘波、尖波、棘慢复合波、慢波异常、节律异常检测功能。
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.anomaly_detector import AnomalyDetector
from app.services.band_analyzer import BandAnalyzer
from app.services.auto_preprocess import AutoPreprocessPipeline
from app.services.edf_parser import EDFParser
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class AnomalyDetectionRequest(BaseModel):
    """异常检测请求"""
    channels: Optional[List[str]] = None
    start: float
    duration: float
    sensitivity: float = 1.0
    run_preprocess: bool = True


class AnomalyEventFeaturesResponse(BaseModel):
    """异常事件特征响应"""
    peak_amplitude_uv: Optional[float] = None
    peak_z_score: Optional[float] = None
    duration_ms: Optional[float] = None
    threshold: Optional[float] = None
    slow_wave_energy_ratio: Optional[float] = None
    slow_wave_window_start: Optional[float] = None
    slow_wave_window_end: Optional[float] = None
    slow_power_sum: Optional[float] = None
    median_slow_power: Optional[float] = None
    z_score: Optional[float] = None
    max_high_amplitude_duration_s: Optional[float] = None
    frequency_hz: Optional[float] = None
    period_s: Optional[float] = None
    autocorrelation_value: Optional[float] = None
    n_periods: Optional[int] = None


class AnomalyEventResponse(BaseModel):
    """异常事件响应"""
    anomaly_type: str
    channel: str
    start_time: float
    end_time: float
    severity: float
    confidence: float
    description: str
    features: Dict[str, Any]


class ChannelAnomalyResultResponse(BaseModel):
    """单通道异常检测结果响应"""
    channel_name: str
    anomalies: List[AnomalyEventResponse]
    risk_score: float
    summary: Dict[str, int]


class AnomalyDetectionResponse(BaseModel):
    """异常检测响应"""
    file_id: str
    channel_results: Dict[str, ChannelAnomalyResultResponse]
    global_risk_score: float
    anomaly_summary: Dict[str, int]
    recommendations: List[str]
    analysis_params: Dict[str, Any]


def _convert_anomaly_event_to_response(event) -> AnomalyEventResponse:
    """转换 AnomalyEvent 为响应模型"""
    return AnomalyEventResponse(
        anomaly_type=event.anomaly_type,
        channel=event.channel,
        start_time=event.start_time,
        end_time=event.end_time,
        severity=event.severity,
        confidence=event.confidence,
        description=event.description,
        features=event.features,
    )


def _convert_channel_result_to_response(result) -> ChannelAnomalyResultResponse:
    """转换 ChannelAnomalyResult 为响应模型"""
    anomalies = [
        _convert_anomaly_event_to_response(event)
        for event in result.anomalies
    ]
    return ChannelAnomalyResultResponse(
        channel_name=result.channel_name,
        anomalies=anomalies,
        risk_score=result.risk_score,
        summary=result.summary,
    )


@router.post("/anomaly_detection/{file_id}", response_model=AnomalyDetectionResponse)
async def detect_anomalies(file_id: str, request: AnomalyDetectionRequest):
    """
    EEG 异常波形检测分析

    对 EEG 信号进行异常波形检测，包括：
    - 棘波 (spike) 和尖波 (sharp_wave) 检测
    - 棘慢复合波 (spike_and_slow) 检测
    - 慢波异常 (slow_wave) 检测
    - 节律异常 (rhythmic) 检测
    - 综合风险评估和临床建议

    Args:
        file_id: EDF 文件 ID
        request: 包含 channels（可选）、start、duration、sensitivity、run_preprocess

    Returns:
        完整的异常检测报告
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

        # 根据是否预处理选择不同的处理流程
        if request.run_preprocess:
            # 执行预处理流水线
            logger.info(f"Running preprocess pipeline for {file_id}")

            # 临时保存裁剪后的 raw 到文件，用于 AutoPreprocessPipeline
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.edf', delete=False) as tmp:
                tmp_path = tmp.name
                raw.export(tmp_path, fmt='edf', overwrite=True)

            try:
                # 运行预处理流水线
                pipeline = AutoPreprocessPipeline(
                    file_path=tmp_path,
                    reference="average",
                    notch_freq=50.0,
                    bandpass_low=0.5,
                    bandpass_high=50.0,
                    run_band_analysis=True,  # 运行频段分析
                )

                preprocess_result = pipeline.run()

                # 使用清洗后的信号和频段分析结果
                raw_for_detection = preprocess_result.raw_clean
                band_analysis = preprocess_result.band_analysis

            finally:
                # 清理临时文件
                import os
                try:
                    os.unlink(tmp_path)
                except:
                    pass

        else:
            # 不预处理，直接使用原始信号
            logger.info(f"Skipping preprocess for {file_id}")
            raw_for_detection = raw

            # 运行 BandAnalyzer 获取频段分析
            band_analyzer = BandAnalyzer(
                raw=raw_for_detection,
                epoch_duration=None,
                eeg_channels=request.channels,
                include_gamma=False,
            )
            band_analysis = band_analyzer.analyze()

        # 创建 AnomalyDetector
        detector = AnomalyDetector(
            raw=raw_for_detection,
            band_analysis=band_analysis,
            eeg_channels=request.channels,
            sensitivity=request.sensitivity,
        )

        # 执行异常检测
        report = detector.detect()

        # 转换为响应格式
        channel_results = {
            name: _convert_channel_result_to_response(result)
            for name, result in report.channel_results.items()
        }

        logger.info(
            f"Anomaly detection completed for {file_id}: "
            f"{len(channel_results)} channels, "
            f"{report.global_risk_score:.3f} risk score, "
            f"{len(report.recommendations)} recommendations"
        )

        return AnomalyDetectionResponse(
            file_id=file_id,
            channel_results=channel_results,
            global_risk_score=report.global_risk_score,
            anomaly_summary=report.anomaly_summary,
            recommendations=report.recommendations,
            analysis_params=report.analysis_params,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"文件未找到: {file_id}")
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")
