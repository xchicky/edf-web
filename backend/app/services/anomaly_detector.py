"""
Anomaly Detector - EEG 异常波形检测服务

对预处理后的 EEG 信号进行异常波形检测和分类，提供：
- 棘波 (spike) 和尖波 (sharp_wave) 检测
- 棘慢复合波 (spike_and_slow) 检测
- 慢波异常 (slow_wave) 检测
- 节律异常 (rhythmic) 检测
- 综合风险评估和临床建议
"""

import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
import mne
from scipy import signal
from scipy.signal import butter, filtfilt

logger = logging.getLogger(__name__)

# NumPy 版本兼容性：np.trapezoid (numpy >=2.0) 或 np.trapz (numpy <2.0)
_trapz_func = np.trapezoid if hasattr(np, 'trapezoid') else np.trapz


@dataclass
class AnomalyEvent:
    """异常事件"""
    anomaly_type: str  # "spike", "sharp_wave", "spike_and_slow", "slow_wave", "rhythmic"
    channel: str  # 通道名
    start_time: float  # 开始时间(秒)
    end_time: float  # 结束时间(秒)
    severity: float  # 严重程度 0.0-1.0
    confidence: float  # 检测置信度 0.0-1.0
    description: str  # 描述
    features: Dict[str, Any]  # 检测特征详情（如峰值振幅、持续时间、频率等）

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return asdict(self)


@dataclass
class ChannelAnomalyResult:
    """单通道异常检测结果"""
    channel_name: str
    anomalies: List[AnomalyEvent]
    risk_score: float  # 综合风险分 0.0-1.0
    summary: Dict[str, int]  # {"spike": 3, "sharp_wave": 1, ...}

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return {
            'channel_name': self.channel_name,
            'anomalies': [a.to_dict() for a in self.anomalies],
            'risk_score': self.risk_score,
            'summary': self.summary,
        }


@dataclass
class AnomalyReport:
    """异常检测报告"""
    channel_results: Dict[str, ChannelAnomalyResult]
    global_risk_score: float  # 全局风险分
    anomaly_summary: Dict[str, int]  # 各类型计数
    recommendations: List[str]  # 建议描述
    analysis_params: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return {
            'channel_results': {
                name: result.to_dict()
                for name, result in self.channel_results.items()
            },
            'global_risk_score': self.global_risk_score,
            'anomaly_summary': self.anomaly_summary,
            'recommendations': self.recommendations,
            'analysis_params': self.analysis_params,
        }


class AnomalyDetector:
    """EEG 异常波形检测器"""

    # 异常类型权重（用于风险评分）
    ANOMALY_WEIGHTS = {
        "spike_and_slow": 2.0,
        "spike": 1.5,
        "sharp_wave": 1.2,
        "slow_wave": 1.0,
        "rhythmic": 0.8,
    }

    def __init__(
        self,
        raw: mne.io.Raw,
        band_analysis: Optional[Any] = None,  # BandAnalysisReport (延迟导入避免循环依赖)
        eeg_channels: Optional[List[str]] = None,
        sensitivity: float = 1.0,
    ):
        """
        初始化 AnomalyDetector

        Args:
            raw: MNE Raw 对象（预处理后的 EEG 信号）
            band_analysis: BandAnalysisReport 对象（可选，用于慢波异常检测）
            eeg_channels: 指定 EEG 通道，None 自动识别
            sensitivity: 灵敏度倍数，>1 更灵敏，<1 更保守
        """
        self.raw = raw
        self.band_analysis = band_analysis
        self.sensitivity = sensitivity

        # 自动识别或使用指定的 EEG 通道
        if eeg_channels is None:
            self.eeg_channels = self._identify_eeg_channels()
        else:
            # 验证通道存在
            for ch in eeg_channels:
                if ch not in self.raw.ch_names:
                    raise ValueError(f"Channel {ch} not found in Raw object")
            self.eeg_channels = eeg_channels

        # 获取采样率
        self.sfreq = self.raw.info['sfreq']

        logger.info(
            f"AnomalyDetector initialized: {len(self.eeg_channels)} EEG channels, "
            f"sfreq={self.sfreq}Hz, sensitivity={sensitivity}, "
            f"band_analysis={'available' if band_analysis else 'not available'}"
        )

    def _identify_eeg_channels(self) -> List[str]:
        """自动识别 EEG 通道（复用 BandAnalyzer 的逻辑）"""
        # 根据 channel 类型识别
        eeg_chs = []
        for ch_name, ch_type in zip(self.raw.ch_names, self.raw.get_channel_types()):
            if ch_type == 'eeg':
                eeg_chs.append(ch_name)

        # 如果没有明确的 EEG 类型通道，尝试根据名称识别
        if not eeg_chs:
            for ch_name in self.raw.ch_names:
                ch_upper = ch_name.upper()
                if 'EEG' in ch_upper or any(
                    std in ch_upper for std in ['Fp', 'F', 'C', 'P', 'O', 'T']
                ):
                    eeg_chs.append(ch_name)

        # 如果仍然没有，使用所有通道
        if not eeg_chs:
            logger.warning("No EEG channels identified, using all channels")
            eeg_chs = self.raw.ch_names.copy()

        return eeg_chs

    def detect(self) -> AnomalyReport:
        """
        执行完整异常检测

        Returns:
            AnomalyReport: 完整的异常检测报告
        """
        logger.info("Starting anomaly detection...")

        # 分析各通道
        channel_results: Dict[str, ChannelAnomalyResult] = {}
        all_anomalies: List[AnomalyEvent] = []

        for ch_name in self.eeg_channels:
            try:
                result = self._detect_channel_anomalies(ch_name)
                channel_results[ch_name] = result
                all_anomalies.extend(result.anomalies)
            except Exception as e:
                logger.error(f"Failed to detect anomalies in channel {ch_name}: {e}")
                # 创建空结果
                channel_results[ch_name] = ChannelAnomalyResult(
                    channel_name=ch_name,
                    anomalies=[],
                    risk_score=0.0,
                    summary={}
                )
                continue

        # 计算全局风险评分
        global_risk_score = self._compute_global_risk_score(all_anomalies)

        # 统计异常类型
        anomaly_summary = self._summarize_anomalies(all_anomalies)

        # 生成建议
        recommendations = self._generate_recommendations(
            global_risk_score, anomaly_summary, channel_results
        )

        # 记录分析参数
        analysis_params = {
            'n_channels': len(self.eeg_channels),
            'channels': self.eeg_channels,
            'sfreq': float(self.sfreq),
            'sensitivity': self.sensitivity,
            'duration_seconds': self.raw.n_times / self.sfreq,
            'band_analysis_used': self.band_analysis is not None,
        }

        logger.info(
            f"Anomaly detection completed: {len(all_anomalies)} anomalies detected, "
            f"global_risk_score={global_risk_score:.3f}"
        )

        return AnomalyReport(
            channel_results=channel_results,
            global_risk_score=global_risk_score,
            anomaly_summary=anomaly_summary,
            recommendations=recommendations,
            analysis_params=analysis_params,
        )

    def _detect_channel_anomalies(self, ch_name: str) -> ChannelAnomalyResult:
        """
        检测单个通道的异常

        Args:
            ch_name: 通道名称

        Returns:
            ChannelAnomalyResult: 单通道异常检测结果
        """
        # 获取通道数据
        ch_idx = self.raw.ch_names.index(ch_name)
        data = self.raw.get_data(units='µV')[ch_idx]
        sfreq = float(self.sfreq)

        anomalies: List[AnomalyEvent] = []

        # 1. 检测棘波和尖波
        spike_sharp_events = self._detect_spikes(data, sfreq, ch_name)
        anomalies.extend(spike_sharp_events)

        # 2. 检测棘慢复合波
        spike_and_slow_events = self._detect_spike_and_slow(
            spike_sharp_events, data, sfreq, ch_name
        )
        anomalies.extend(spike_and_slow_events)

        # 3. 检测慢波异常（需要 band_analysis）
        slow_wave_event = self._detect_slow_wave_anomaly(ch_name)
        if slow_wave_event:
            anomalies.append(slow_wave_event)

        # 4. 检测节律异常
        rhythmic_events = self._detect_rhythmic_anomaly(data, sfreq, ch_name)
        anomalies.extend(rhythmic_events)

        # 计算通道风险评分
        risk_score = self._compute_risk_score(anomalies)

        # 统计异常类型
        summary = self._summarize_anomalies(anomalies)

        return ChannelAnomalyResult(
            channel_name=ch_name,
            anomalies=anomalies,
            risk_score=risk_score,
            summary=summary,
        )

    def _detect_spikes(
        self, data: np.ndarray, sfreq: float, ch_name: str
    ) -> List[AnomalyEvent]:
        """
        棘波和尖波检测

        算法：
        1. 滑动窗口（100ms）计算局部 Z-score
        2. Z-score > threshold（默认 3.0，受 sensitivity 调节）标记候选点
        3. 合并相邻候选点为事件
        4. 按持续时间分类：20-70ms → spike；70-200ms → sharp_wave
        5. 计算 severity = min(z_score / 10.0, 1.0)
        6. 计算 confidence = (z_score - threshold) / threshold

        Args:
            data: 通道数据（µV）
            sfreq: 采样频率
            ch_name: 通道名称

        Returns:
            List[AnomalyEvent]: 检测到的棘波和尖波事件
        """
        anomalies: List[AnomalyEvent] = []

        # 计算基础阈值（受 sensitivity 调节）
        base_threshold = 2.5
        threshold = base_threshold / self.sensitivity

        # 滑动窗口参数
        window_size = int(0.1 * sfreq)  # 100ms 窗口
        if window_size < 1:
            window_size = 1

        # 计算滑动窗口的均值和标准差
        n_samples = len(data)
        means = np.zeros(n_samples)
        stds = np.zeros(n_samples)

        for i in range(n_samples):
            start_idx = max(0, i - window_size // 2)
            end_idx = min(n_samples, i + window_size // 2 + 1)
            window_data = data[start_idx:end_idx]
            means[i] = np.mean(window_data)
            stds[i] = np.std(window_data) + 1e-10  # 避免除零

        # 计算 Z-score
        z_scores = np.abs(data - means) / stds

        # 标记候选点
        candidate_mask = z_scores > threshold

        # 合并相邻候选点为事件
        candidate_indices = np.where(candidate_mask)[0]

        if len(candidate_indices) == 0:
            return anomalies

        # 分组连续的候选点
        groups = []
        current_group = [candidate_indices[0]]

        for i in range(1, len(candidate_indices)):
            if candidate_indices[i] - candidate_indices[i-1] <= int(0.05 * sfreq):
                # 间隔小于 50ms，认为是同一事件
                current_group.append(candidate_indices[i])
            else:
                groups.append(current_group)
                current_group = [candidate_indices[i]]

        groups.append(current_group)

        # 分析每个事件
        for group in groups:
            start_idx = group[0]
            end_idx = group[-1]
            duration_ms = (end_idx - start_idx + 1) / sfreq * 1000

            # 计算峰值特征
            peak_idx = group[np.argmax(z_scores[group])]
            peak_amplitude = float(data[peak_idx])
            peak_z_score = float(z_scores[peak_idx])

            start_time = start_idx / sfreq
            end_time = end_idx / sfreq

            # 根据持续时间分类
            if 15 <= duration_ms <= 80:
                anomaly_type = "spike"
                description = f"棘波 (持续时间 {duration_ms:.1f}ms)"
            elif 80 < duration_ms <= 250:
                anomaly_type = "sharp_wave"
                description = f"尖波 (持续时间 {duration_ms:.1f}ms)"
            else:
                # 持续时间太长或太短，跳过
                continue

            # 计算严重程度和置信度
            severity = min(peak_z_score / 10.0, 1.0)
            confidence = min((peak_z_score - threshold) / threshold, 1.0)

            # 只保留置信度 > 0 且峰值振幅 > 50µV 的事件
            if confidence <= 0 or abs(peak_amplitude) < 50:
                continue

            features = {
                'peak_amplitude_uv': peak_amplitude,
                'peak_z_score': peak_z_score,
                'duration_ms': duration_ms,
                'threshold': threshold,
            }

            anomalies.append(AnomalyEvent(
                anomaly_type=anomaly_type,
                channel=ch_name,
                start_time=start_time,
                end_time=end_time,
                severity=severity,
                confidence=confidence,
                description=description,
                features=features,
            ))

        return anomalies

    def _detect_spike_and_slow(
        self,
        spike_events: List[AnomalyEvent],
        data: np.ndarray,
        sfreq: float,
        ch_name: str,
    ) -> List[AnomalyEvent]:
        """
        棘慢复合波检测

        算法：
        1. 遍历 spike_events
        2. 在每个 spike 后 200-500ms 窗口内检测慢波（带通滤波 0.5-4Hz，计算能量）
        3. 如果慢波能量 > 基线能量的 2 倍，组合为 spike_and_slow 事件
        4. severity 取 spike 和 slow 波的加权平均

        Args:
            spike_events: 已检测到的棘波和尖波事件
            data: 通道数据（µV）
            sfreq: 采样频率
            ch_name: 通道名称

        Returns:
            List[AnomalyEvent]: 检测到的棘慢复合波事件
        """
        anomalies: List[AnomalyEvent] = []

        if not spike_events:
            return anomalies

        # 设计慢波滤波器 (0.5-4Hz)
        nyquist = sfreq / 2
        low = 0.5 / nyquist
        high = 4.0 / nyquist
        b, a = butter(4, [low, high], btype='band')

        # 滤波得到慢波成分
        slow_wave_data = filtfilt(b, a, data)

        # 计算基线能量（整个信号的平均能量）
        baseline_energy = np.mean(slow_wave_data ** 2)

        if baseline_energy < 1e-10:
            return anomalies

        for spike_event in spike_events:
            # 只检测 spike，不检测 sharp_wave
            if spike_event.anomaly_type != "spike":
                continue

            # 在 spike 后 200-500ms 窗口内检测慢波
            start_time = spike_event.end_time
            end_time = start_time + 0.5  # 500ms 窗口

            start_idx = int(start_time * sfreq)
            end_idx = int(min(end_time * sfreq, len(data)))

            if end_idx <= start_idx:
                continue

            # 计算窗口内慢波能量
            window_slow_energy = np.mean(slow_wave_data[start_idx:end_idx] ** 2)

            # 如果慢波能量 > 基线能量的 1.5 倍，认为是棘慢复合波
            if window_slow_energy > baseline_energy * 1.5:
                # 计算慢波特征
                slow_wave_severity = min(window_slow_energy / baseline_energy / 5.0, 1.0)

                # 综合严重程度（spike 和 slow 波的加权平均）
                combined_severity = (spike_event.severity + slow_wave_severity) / 2
                combined_confidence = spike_event.confidence * 0.9  # 略微降低置信度

                features = spike_event.features.copy()
                features['slow_wave_energy_ratio'] = window_slow_energy / baseline_energy
                features['slow_wave_window_start'] = start_time
                features['slow_wave_window_end'] = end_time

                anomalies.append(AnomalyEvent(
                    anomaly_type="spike_and_slow",
                    channel=ch_name,
                    start_time=spike_event.start_time,
                    end_time=end_time / sfreq,
                    severity=combined_severity,
                    confidence=combined_confidence,
                    description=f"棘慢复合波 (spike + 慢波)",
                    features=features,
                ))

        return anomalies

    def _detect_slow_wave_anomaly(self, ch_name: str) -> Optional[AnomalyEvent]:
        """
        慢波异常检测

        算法（依赖 band_analysis）：
        1. 如果 band_analysis 为 None，跳过
        2. 计算该通道 delta + theta 相对功率之和
        3. 与所有通道的中位数比较，Z-score > 2.0 标记异常
        4. 同时检查时域：连续 > 1s 且振幅 > 阈值的高幅慢波段

        Args:
            ch_name: 通道名称

        Returns:
            Optional[AnomalyEvent]: 检测到的慢波异常事件，如果没有则返回 None
        """
        if self.band_analysis is None:
            return None

        # 检查通道是否在 band_analysis 中
        if ch_name not in self.band_analysis.channel_results:
            return None

        channel_result = self.band_analysis.channel_results[ch_name]

        # 计算 delta + theta 相对功率之和
        delta_power = channel_result.bands.get('delta', float('nan')).relative_power
        theta_power = channel_result.bands.get('theta', float('nan')).relative_power

        if np.isnan(delta_power) or np.isnan(theta_power):
            return None

        slow_power_sum = delta_power + theta_power

        # 计算所有通道的慢波功率中位数
        all_slow_powers = []
        for ch, result in self.band_analysis.channel_results.items():
            delta = result.bands.get('delta', float('nan')).relative_power
            theta = result.bands.get('theta', float('nan')).relative_power
            if not np.isnan(delta) and not np.isnan(theta):
                all_slow_powers.append(delta + theta)

        if not all_slow_powers:
            return None

        median_slow_power = np.median(all_slow_powers)
        std_slow_power = np.std(all_slow_powers) + 1e-10

        # Z-score > 2.0 标记异常
        z_score = (slow_power_sum - median_slow_power) / std_slow_power

        if z_score > 2.0:
            # 获取通道数据进行时域验证
            ch_idx = self.raw.ch_names.index(ch_name)
            data = self.raw.get_data(units='µV')[ch_idx]

            # 检查是否有高幅慢波段（振幅 > 50µV，持续时间 > 1s）
            high_amplitude_mask = np.abs(data) > 50
            high_amp_indices = np.where(high_amplitude_mask)[0]

            if len(high_amp_indices) == 0:
                return None

            # 检查连续高幅段
            max_duration = 0
            current_duration = 0

            for i in range(1, len(high_amp_indices)):
                if high_amp_indices[i] - high_amp_indices[i-1] <= int(0.1 * self.sfreq):
                    current_duration += (high_amp_indices[i] - high_amp_indices[i-1]) / self.sfreq
                else:
                    max_duration = max(max_duration, current_duration)
                    current_duration = 0

            max_duration = max(max_duration, current_duration)

            if max_duration > 1.0:  # 持续时间 > 1s
                severity = min(z_score / 5.0, 1.0)
                confidence = min((z_score - 2.0) / 2.0, 1.0)

                features = {
                    'slow_power_sum': slow_power_sum,
                    'median_slow_power': median_slow_power,
                    'z_score': z_score,
                    'max_high_amplitude_duration_s': max_duration,
                }

                # 计算事件时间（整个记录时间）
                duration = self.raw.n_times / self.sfreq

                return AnomalyEvent(
                    anomaly_type="slow_wave",
                    channel=ch_name,
                    start_time=0.0,
                    end_time=duration,
                    severity=severity,
                    confidence=confidence,
                    description=f"慢波异常 (Z-score: {z_score:.2f})",
                    features=features,
                )

        return None

    def _detect_rhythmic_anomaly(
        self, data: np.ndarray, sfreq: float, ch_name: str
    ) -> List[AnomalyEvent]:
        """
        节律异常检测

        算法：
        1. 对信号做自相关分析（np.correlate）
        2. 检测显著的周期性峰值（归一化自相关 > 0.6）
        3. 周期持续 > 500ms 的标记为节律异常
        4. 排除 alpha 节律（8-13Hz 生理性节律，不做标记）

        Args:
            data: 通道数据（µV）
            sfreq: 采样频率
            ch_name: 通道名称

        Returns:
            List[AnomalyEvent]: 检测到的节律异常事件
        """
        anomalies: List[AnomalyEvent] = []

        # 去均值
        data_centered = data - np.mean(data)

        # 计算自相关
        autocorr = np.correlate(data_centered, data_centered, mode='full')
        autocorr = autocorr[len(autocorr) // 2:]  # 只取正延迟部分

        # 归一化
        autocorr = autocorr / autocorr[0]

        # 限制分析范围（最大延迟 1 秒）
        max_lag = int(1.0 * sfreq)
        autocorr = autocorr[:max_lag + 1]

        # 寻找峰值（排除零延迟）
        peaks, properties = signal.find_peaks(
            autocorr[1:], height=0.6, distance=int(0.05 * sfreq)
        )
        peaks = peaks + 1  # 补偿偏移

        # 分析每个峰值
        for peak in peaks:
            lag_samples = peak
            lag_seconds = lag_samples / sfreq
            frequency = 1.0 / lag_seconds if lag_seconds > 0 else 0

            # 排除 alpha 节律（8-13Hz 生理性节律）
            if 8 <= frequency <= 13:
                continue

            # 只关注持续时间 > 500ms 的节律
            if lag_seconds >= 0.5:
                # 检查在整个信号中是否存在这种节律
                # 通过检查多个周期的一致性
                n_periods = int(len(data) / lag_samples)
                if n_periods < 3:  # 至少 3 个周期
                    continue

                # 计算周期一致性
                period_consistency = autocorr[peak]

                # 计算严重程度和置信度
                severity = min(period_consistency / 0.8, 1.0)
                confidence = min((period_consistency - 0.6) / 0.4, 1.0)

                if confidence <= 0:
                    continue

                features = {
                    'frequency_hz': frequency,
                    'period_s': lag_seconds,
                    'autocorrelation_value': float(period_consistency),
                    'n_periods': n_periods,
                }

                # 计算事件时间（整个记录时间）
                duration = self.raw.n_times / self.sfreq

                anomalies.append(AnomalyEvent(
                    anomaly_type="rhythmic",
                    channel=ch_name,
                    start_time=0.0,
                    end_time=duration,
                    severity=severity,
                    confidence=confidence,
                    description=f"节律异常 ({frequency:.1f} Hz)",
                    features=features,
                ))

        return anomalies

    def _compute_risk_score(self, anomalies: List[AnomalyEvent]) -> float:
        """
        综合风险评分

        risk = Σ(anomaly.severity × confidence × weight) / Σ(weight)

        Args:
            anomalies: 异常事件列表

        Returns:
            float: 风险评分 0.0-1.0
        """
        if not anomalies:
            return 0.0

        total_weighted_score = 0.0
        total_weight = 0.0

        for anomaly in anomalies:
            weight = self.ANOMALY_WEIGHTS.get(anomaly.anomaly_type, 1.0)
            weighted_score = anomaly.severity * anomaly.confidence * weight
            total_weighted_score += weighted_score
            total_weight += weight

        if total_weight == 0:
            return 0.0

        # 归一化到 0-1 范围
        # 使用 max(1, total_weight) 避免除以很小的数
        risk_score = min(total_weighted_score / max(1.0, total_weight), 1.0)

        return risk_score

    def _compute_global_risk_score(self, anomalies: List[AnomalyEvent]) -> float:
        """
        计算全局风险评分

        Args:
            anomalies: 所有通道的异常事件列表

        Returns:
            float: 全局风险评分 0.0-1.0
        """
        return self._compute_risk_score(anomalies)

    def _summarize_anomalies(self, anomalies: List[AnomalyEvent]) -> Dict[str, int]:
        """
        统计异常类型

        Args:
            anomalies: 异常事件列表

        Returns:
            Dict[str, int]: 各类型计数
        """
        summary = {
            "spike": 0,
            "sharp_wave": 0,
            "spike_and_slow": 0,
            "slow_wave": 0,
            "rhythmic": 0,
        }

        for anomaly in anomalies:
            anomaly_type = anomaly.anomaly_type
            if anomaly_type in summary:
                summary[anomaly_type] += 1

        return summary

    def _generate_recommendations(
        self,
        global_risk_score: float,
        anomaly_summary: Dict[str, int],
        channel_results: Dict[str, ChannelAnomalyResult],
    ) -> List[str]:
        """
        根据检测结果生成建议

        Args:
            global_risk_score: 全局风险评分
            anomaly_summary: 异常类型统计
            channel_results: 各通道检测结果

        Returns:
            List[str]: 建议描述列表
        """
        recommendations: List[str] = []

        # 高风险建议
        if global_risk_score > 0.7:
            recommendations.append("检测到高风险异常波形，建议进一步临床评估")
        elif global_risk_score > 0.4:
            recommendations.append("检测到中度异常波形，建议定期随访")
        elif global_risk_score > 0.1:
            recommendations.append("检测到轻微异常波形，建议结合临床症状综合评估")

        # 棘慢复合波建议
        if anomaly_summary.get("spike_and_slow", 0) > 0:
            recommendations.append("检测到棘慢复合波，建议癫痫专科评估")

        # 棘波/尖波建议
        spike_count = anomaly_summary.get("spike", 0) + anomaly_summary.get("sharp_wave", 0)
        if spike_count > 5:
            recommendations.append(f"检测到 {spike_count} 个棘波/尖波事件，建议进一步检查")
        elif spike_count > 0:
            recommendations.append(f"检测到 {spike_count} 个棘波/尖波事件，建议结合临床")

        # 慢波异常建议
        if anomaly_summary.get("slow_wave", 0) > 0:
            recommendations.append("检测到弥漫性慢波异常，建议进一步检查")

        # 节律异常建议
        if anomaly_summary.get("rhythmic", 0) > 0:
            recommendations.append("检测到节律异常，建议评估是否存在病理性节律")

        # 通道特异性建议
        high_risk_channels = [
            ch for ch, result in channel_results.items()
            if result.risk_score > 0.5
        ]
        if high_risk_channels:
            if len(high_risk_channels) <= 3:
                ch_list = ", ".join(high_risk_channels)
                recommendations.append(f"高风险通道：{ch_list}")
            else:
                recommendations.append(f"高风险通道：{len(high_risk_channels)} 个通道")

        # 如果没有检测到异常
        if not recommendations:
            recommendations.append("未检测到明显异常波形")

        return recommendations
