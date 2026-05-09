"""
流水线服务 - 串行执行预处理、分析步骤

接受步骤列表，依次执行预处理变换波形数据，
然后对处理后的数据运行分析步骤生成标注。
"""

import time
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from app.services.preprocessing import SignalPreprocessor
from app.services.edf_parser import EDFParser

logger = logging.getLogger(__name__)


class PipelineStepConfig:
    """流水线步骤配置"""
    pass


class PipelineService:
    """EEG 处理流水线服务"""

    def run_pipeline(
        self,
        file_path: str,
        steps: List[Dict[str, Any]],
        start: float,
        duration: float,
        channels: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        执行处理流水线

        Args:
            file_path: EDF 文件路径
            steps: 步骤配置列表，每个包含 category, method, parameters, enabled
            start: 起始时间（秒）
            duration: 持续时间（秒）
            channels: 通道名列表（None = 全部）

        Returns:
            {
                "processed_data": np.ndarray or None,  # (n_channels, n_samples) 微伏
                "times": list,
                "channels": list,
                "sfreq": float,
                "annotations": list,
                "step_logs": list,
            }
        """
        t0 = time.time()
        step_logs = []
        annotations = []

        # 加载 EDF 数据
        parser = EDFParser(file_path)
        waveform = parser.get_waveform_chunk(
            start_time=start,
            duration=duration,
            channel_indices=None,
        )

        raw_data = np.array(waveform["data"], dtype=float)
        channels_list = waveform["channels"]
        sfreq = waveform["sfreq"]
        times = waveform["times"]

        if channels:
            indices = [i for i, ch in enumerate(channels_list) if ch in channels]
            raw_data = raw_data[indices]
            channels_list = [channels_list[i] for i in indices]

        data = raw_data.copy()
        has_preprocess = False

        # 分离步骤：预处理在前，分析在后
        preprocess_steps = [s for s in steps if s.get("category") == "preprocess" and s.get("enabled", True)]
        analysis_steps = [s for s in steps if s.get("category") == "analysis" and s.get("enabled", True)]

        # 执行预处理步骤（串行链接）
        for step in preprocess_steps:
            step_t0 = time.time()
            step_id = step.get("id", "unknown")
            method = step.get("method", "none")
            params = step.get("parameters") or {}

            try:
                if method == "none":
                    step_logs.append({
                        "step_id": step_id,
                        "status": "skipped",
                        "duration_ms": 0,
                        "message": "无预处理",
                    })
                    continue

                preprocessor = SignalPreprocessor(sfreq)
                processed = np.zeros_like(data)
                for i in range(data.shape[0]):
                    processed[i] = preprocessor.process(data[i], method=method, **params)
                data = processed
                has_preprocess = True

                step_logs.append({
                    "step_id": step_id,
                    "status": "success",
                    "duration_ms": int((time.time() - step_t0) * 1000),
                    "message": f"{method} 完成",
                })
            except Exception as e:
                logger.error(f"预处理步骤 {step_id} 失败: {e}")
                step_logs.append({
                    "step_id": step_id,
                    "status": "error",
                    "duration_ms": int((time.time() - step_t0) * 1000),
                    "message": str(e),
                })

        # 执行分析步骤
        for step in analysis_steps:
            step_t0 = time.time()
            step_id = step.get("id", "unknown")
            method = step.get("method", "")
            params = step.get("parameters") or {}

            try:
                step_annotations = self._run_analysis_step(
                    file_path, method, params,
                    start, duration, channels_list, data, sfreq,
                )
                annotations.extend(step_annotations)

                step_logs.append({
                    "step_id": step_id,
                    "status": "success",
                    "duration_ms": int((time.time() - step_t0) * 1000),
                    "message": f"发现 {len(step_annotations)} 条标注",
                })
            except Exception as e:
                logger.error(f"分析步骤 {step_id} 失败: {e}")
                step_logs.append({
                    "step_id": step_id,
                    "status": "error",
                    "duration_ms": int((time.time() - step_t0) * 1000),
                    "message": str(e),
                })

        total_ms = int((time.time() - t0) * 1000)
        logger.info(f"流水线完成: {total_ms}ms, {len(annotations)} 条标注")

        return {
            "processed_data": data if has_preprocess else None,
            "times": times,
            "channels": channels_list,
            "sfreq": sfreq,
            "n_samples": data.shape[1] if len(data.shape) > 1 else len(data),
            "start_time": start,
            "duration": duration,
            "annotations": annotations,
            "step_logs": step_logs,
            "total_processing_time_ms": total_ms,
        }

    def _run_analysis_step(
        self,
        file_path: str,
        method: str,
        params: Dict[str, float],
        start: float,
        duration: float,
        channels: List[str],
        data: np.ndarray,
        sfreq: float,
    ) -> List[Dict[str, Any]]:
        """运行单个分析步骤，返回标注列表"""
        annotations = []

        if method == "anomaly_detection":
            from app.services.anomaly_detector import AnomalyDetector
            sensitivity = params.get("sensitivity", 1.0)
            detector = AnomalyDetector(file_path)
            report = detector.detect(
                start_time=start,
                duration=duration,
                channels=channels,
                sensitivity=sensitivity,
            )
            for ch_name, ch_result in report.channel_results.items():
                for anomaly in ch_result.anomalies:
                    annotations.append({
                        "annotation_type": f"anomaly_{anomaly.anomaly_type}",
                        "source": "pipeline",
                        "channel": ch_name,
                        "start_time": anomaly.onset,
                        "end_time": anomaly.onset + anomaly.duration,
                        "label": anomaly.description,
                        "color": self._anomaly_color(anomaly.anomaly_type),
                        "severity": anomaly.confidence,
                        "confidence": anomaly.confidence,
                        "metadata": {"anomaly_type": anomaly.anomaly_type},
                    })

        elif method == "artifact_detection":
            from app.services.auto_preprocess import AutoPreprocessPipeline
            pipeline = AutoPreprocessPipeline(file_path)
            result = pipeline.run(
                reference="average",
                notch_filter=True,
                bandpass_filter=False,
                artifact_detection=True,
            )
            for event in result.artifact_events:
                if channels and event.channels:
                    overlap = set(event.channels) & set(channels)
                    if not overlap:
                        continue
                annotations.append({
                    "annotation_type": f"artifact_{event.type}",
                    "source": "pipeline",
                    "channel": event.channels[0] if event.channels else None,
                    "start_time": event.onset,
                    "end_time": event.onset + event.duration,
                    "label": event.description,
                    "color": self._artifact_color(event.type),
                    "severity": 0.7,
                    "confidence": 0.8,
                    "metadata": {"artifact_type": event.type, "channels": event.channels},
                })

        elif method == "band_power":
            from app.services.band_analyzer import BandAnalyzer
            analyzer = BandAnalyzer(file_path)
            report = analyzer.analyze(
                start_time=start,
                duration=duration,
                channels=channels,
            )
            for ch_name, ch_result in report.channel_results.items():
                dominant = ch_result.dominant_band
                annotations.append({
                    "annotation_type": "band_dominant",
                    "source": "pipeline",
                    "channel": ch_name,
                    "start_time": start,
                    "end_time": start + duration,
                    "label": f"优势频段: {dominant}",
                    "color": "#9B59B6",
                    "severity": 0.5,
                    "confidence": 0.8,
                    "metadata": {"dominant_band": dominant},
                })

        return annotations

    @staticmethod
    def _anomaly_color(anomaly_type: str) -> str:
        colors = {
            "spike": "#E74C3C",
            "sharp_wave": "#E67E22",
            "spike_and_slow": "#C0392B",
            "slow_wave": "#3498DB",
            "rhythmic": "#9B59B6",
        }
        return colors.get(anomaly_type, "#95A5A6")

    @staticmethod
    def _artifact_color(artifact_type: str) -> str:
        colors = {
            "eog": "#FF6B6B",
            "emg": "#FFA726",
            "flat": "#78909C",
            "drift": "#42A5F5",
            "jump": "#AB47BC",
        }
        return colors.get(artifact_type, "#95A5A6")
