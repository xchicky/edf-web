"""
Band Analyzer - EEG 频段波形识别服务

对预处理后的 EEG 信号进行频段分析和波形识别，提供：
- 频段分解（delta, theta, alpha, beta, gamma）
- 特征提取（绝对功率、相对功率、峰值频率）
- 优势频段识别
- 时间分段分析（epoch-based）
"""

import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
import mne
from mne.time_frequency import psd_array_welch

logger = logging.getLogger(__name__)

# NumPy 版本兼容性：np.trapezoid (numpy >=2.0) 或 np.trapz (numpy <2.0)
_trapz_func = np.trapezoid if hasattr(np, 'trapezoid') else np.trapz


@dataclass
class BandFeature:
    """单通道单频段特征"""
    band_name: str  # "delta", "theta", "alpha", "beta", "gamma"
    freq_range: Tuple[float, float]  # (0.5, 4.0)
    absolute_power: float  # µV²
    relative_power: float  # 0.0-1.0
    peak_freq: float  # Hz
    center_freq: float  # 频段中心频率
    bandwidth: float  # 频段带宽
    filtered_data: Optional[np.ndarray] = None  # 滤波后的信号数据

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        d = asdict(self)
        # 将 numpy 数组转换为列表
        if self.filtered_data is not None:
            d['filtered_data'] = self.filtered_data.tolist()
        # 转换元组为列表
        d['freq_range'] = list(self.freq_range)
        return d


@dataclass
class ChannelBandResult:
    """单通道频段分析结果"""
    channel_name: str
    dominant_band: str  # 优势频段名称
    bands: Dict[str, BandFeature]  # 各频段特征

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return {
            'channel_name': self.channel_name,
            'dominant_band': self.dominant_band,
            'bands': {name: feature.to_dict() for name, feature in self.bands.items()}
        }


@dataclass
class EpochResult:
    """单时段分析结果"""
    start_time: float
    end_time: float
    channel_results: Dict[str, ChannelBandResult]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return {
            'start_time': self.start_time,
            'end_time': self.end_time,
            'channel_results': {
                name: result.to_dict() for name, result in self.channel_results.items()
            }
        }


@dataclass
class BandAnalysisReport:
    """频段分析报告"""
    channel_results: Dict[str, ChannelBandResult]  # 通道级
    global_dominant_bands: Dict[str, int]  # 全局优势频段统计
    epoch_results: List[EpochResult]  # 时段分析（如果启用了分段）
    analysis_params: Dict[str, Any]  # 分析参数记录

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 序列化）"""
        return {
            'channel_results': {
                name: result.to_dict() for name, result in self.channel_results.items()
            },
            'global_dominant_bands': self.global_dominant_bands,
            'epoch_results': [epoch.to_dict() for epoch in self.epoch_results],
            'analysis_params': self.analysis_params
        }


class BandAnalyzer:
    """EEG 频段波形识别分析器"""

    # 标准 EEG 频带定义
    FREQUENCY_BANDS = {
        "delta": (0.5, 4),
        "theta": (4, 8),
        "alpha": (8, 13),
        "beta": (13, 30),
        "gamma": (30, 50),
    }

    def __init__(
        self,
        raw: mne.io.Raw,
        epoch_duration: Optional[float] = None,
        eeg_channels: Optional[List[str]] = None,
        include_gamma: bool = True,
    ):
        """
        初始化 BandAnalyzer

        Args:
            raw: MNE Raw 对象（预处理后的 EEG 信号）
            epoch_duration: 分段窗口（秒），None 表示不分段
            eeg_channels: 指定 EEG 通道，None 自动识别
            include_gamma: 是否包含 gamma 频段（需要 sfreq > 100）
        """
        self.raw = raw
        self.epoch_duration = epoch_duration
        self.include_gamma = include_gamma

        # 自动识别或使用指定的 EEG 通道
        if eeg_channels is None:
            self.eeg_channels = self._identify_eeg_channels()
        else:
            # 验证通道存在
            for ch in eeg_channels:
                if ch not in self.raw.ch_names:
                    raise ValueError(f"Channel {ch} not found in Raw object")
            self.eeg_channels = eeg_channels

        # 检查采样率是否支持 gamma 频段
        self.sfreq = self.raw.info['sfreq']
        if self.include_gamma and self.sfreq <= 100:
            logger.warning(
                f"Sampling rate {self.sfreq} Hz is too low for gamma band analysis. "
                "Gamma band will be excluded."
            )
            self.include_gamma = False

        # 根据采样率确定要分析的频段
        self.active_bands = self._get_active_bands()

        logger.info(
            f"BandAnalyzer initialized: {len(self.eeg_channels)} EEG channels, "
            f"sfreq={self.sfreq}Hz, epoch_duration={epoch_duration}, "
            f"bands={list(self.active_bands.keys())}"
        )

    def _identify_eeg_channels(self) -> List[str]:
        """自动识别 EEG 通道"""
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

    def _get_active_bands(self) -> Dict[str, Tuple[float, float]]:
        """根据采样率确定要分析的频段"""
        bands = {}
        for name, (fmin, fmax) in self.FREQUENCY_BANDS.items():
            # Nyquist 频率检查
            if fmax >= self.sfreq / 2:
                logger.warning(
                    f"Band {name} ({fmin}-{fmax} Hz) exceeds Nyquist frequency "
                    f"({self.sfreq / 2} Hz), skipping"
                )
                continue

            # Gamma 频段需要更高的采样率
            if name == 'gamma' and not self.include_gamma:
                continue

            bands[name] = (fmin, fmax)

        return bands

    def analyze(self) -> BandAnalysisReport:
        """
        执行完整的频段分析

        Returns:
            BandAnalysisReport: 完整的分析报告
        """
        logger.info("Starting band analysis...")

        # 分析各通道
        channel_results: Dict[str, ChannelBandResult] = {}
        for ch_name in self.eeg_channels:
            try:
                result = self.analyze_channel(ch_name)
                channel_results[ch_name] = result
            except Exception as e:
                logger.error(f"Failed to analyze channel {ch_name}: {e}")
                continue

        # 计算全局优势频段统计
        global_dominant_bands = self._compute_global_dominant_bands(channel_results)

        # 执行时间分段分析（如果启用）
        epoch_results: List[EpochResult] = []
        if self.epoch_duration is not None:
            epoch_results = self.analyze_epochs()

        # 记录分析参数
        analysis_params = {
            'n_channels': len(self.eeg_channels),
            'channels': self.eeg_channels,
            'sfreq': float(self.sfreq),
            'epoch_duration': self.epoch_duration,
            'include_gamma': self.include_gamma,
            'active_bands': list(self.active_bands.keys()),
            'duration_seconds': self.raw.n_times / self.sfreq,
        }

        logger.info(
            f"Band analysis completed: {len(channel_results)} channels, "
            f"{len(epoch_results)} epochs"
        )

        return BandAnalysisReport(
            channel_results=channel_results,
            global_dominant_bands=global_dominant_bands,
            epoch_results=epoch_results,
            analysis_params=analysis_params,
        )

    def analyze_channel(self, ch_name: str) -> ChannelBandResult:
        """
        分析单个通道

        Args:
            ch_name: 通道名称

        Returns:
            ChannelBandResult: 单通道分析结果
        """
        # 获取通道数据
        ch_idx = self.raw.ch_names.index(ch_name)
        data = self.raw.get_data(units='µV')[ch_idx]
        sfreq = float(self.sfreq)
        n_samples = len(data)

        # 计算各频段特征
        bands: Dict[str, BandFeature] = {}
        for band_name, (fmin, fmax) in self.active_bands.items():
            feature = self._compute_band_feature(
                data, sfreq, band_name, fmin, fmax
            )
            bands[band_name] = feature

        # 识别优势频段
        dominant_band = max(
            bands.keys(),
            key=lambda b: bands[b].relative_power
        )

        return ChannelBandResult(
            channel_name=ch_name,
            dominant_band=dominant_band,
            bands=bands,
        )

    def _compute_band_feature(
        self,
        data: np.ndarray,
        sfreq: float,
        band_name: str,
        fmin: float,
        fmax: float,
    ) -> BandFeature:
        """
        计算单个频段的特征

        Args:
            data: 通道数据（µV）
            sfreq: 采样频率
            band_name: 频段名称
            fmin: 最小频率
            fmax: 最大频率

        Returns:
            BandFeature: 频段特征
        """
        n_samples = len(data)

        # 动态计算 n_fft
        n_fft = min(256, 2 ** int(np.log2(n_samples)))
        n_fft = max(n_fft, 8)
        n_overlap = min(n_fft // 2, n_samples // 4)

        # 计算 PSD
        psds, freqs = psd_array_welch(
            data,
            sfreq=sfreq,
            fmin=0.5,
            fmax=min(50, sfreq / 2 - 1),  # 不超过 Nyquist
            n_fft=n_fft,
            n_overlap=n_overlap,
            verbose=False,
        )

        # 确保 psds 是 2D 数组
        if psds.ndim == 1:
            psds = psds.reshape(1, -1)

        # 平均 PSD
        psd_mean = psds.mean(axis=0)

        # 计算绝对功率（积分）
        freq_mask = (freqs >= fmin) & (freqs <= fmax)
        band_psds = psd_mean[freq_mask]
        absolute_power = float(_trapz_func(band_psds, freqs[freq_mask]))

        # 计算总功率（用于相对功率）
        total_mask = (freqs >= 0.5) & (freqs <= min(50, sfreq / 2 - 1))
        total_power = float(_trapz_func(psd_mean[total_mask], freqs[total_mask]))

        # 相对功率
        if total_power > 0:
            relative_power = absolute_power / total_power
        else:
            relative_power = 0.0

        # 峰值频率
        if len(band_psds) > 0:
            peak_idx = np.argmax(band_psds)
            peak_freq = float(freqs[freq_mask][peak_idx])
        else:
            peak_freq = (fmin + fmax) / 2

        # 中心频率和带宽
        center_freq = (fmin + fmax) / 2
        bandwidth = fmax - fmin

        # 滤波后的数据（可选）
        try:
            raw_copy = self.raw.copy()
            raw_copy.filter(
                l_freq=fmin,
                h_freq=fmax,
                picks=[self.raw.ch_names.index(self.raw.ch_names[0])],
                verbose=False
            )
            # 注意：这里我们只做演示，实际滤波需要在通道级别
            filtered_data = None  # 暂时不保存滤波数据以节省内存
        except Exception:
            filtered_data = None

        return BandFeature(
            band_name=band_name,
            freq_range=(fmin, fmax),
            absolute_power=absolute_power,
            relative_power=relative_power,
            peak_freq=peak_freq,
            center_freq=center_freq,
            bandwidth=bandwidth,
            filtered_data=filtered_data,
        )

    def _compute_global_dominant_bands(
        self,
        channel_results: Dict[str, ChannelBandResult]
    ) -> Dict[str, int]:
        """
        计算全局优势频段统计

        Args:
            channel_results: 各通道分析结果

        Returns:
            Dict[str, int]: 各频段成为优势的通道数
        """
        global_dominant = {band: 0 for band in self.active_bands.keys()}

        for result in channel_results.values():
            dominant = result.dominant_band
            if dominant in global_dominant:
                global_dominant[dominant] += 1

        return global_dominant

    def analyze_epochs(self) -> List[EpochResult]:
        """
        执行时间分段分析

        Returns:
            List[EpochResult]: 各时段分析结果
        """
        if self.epoch_duration is None:
            return []

        total_duration = self.raw.n_times / self.sfreq
        n_epochs = int(np.floor(total_duration / self.epoch_duration))

        if n_epochs == 0:
            logger.warning(
                f"Epoch duration ({self.epoch_duration}s) is longer than "
                f"signal duration ({total_duration}s), skipping epoch analysis"
            )
            return []

        logger.info(f"Analyzing {n_epochs} epochs of {self.epoch_duration}s each")

        epoch_results: List[EpochResult] = []

        for i in range(n_epochs):
            start_time = i * self.epoch_duration
            end_time = start_time + self.epoch_duration

            # 裁剪时段（确保不超过最大时间）
            max_time = self.raw.n_times / self.sfreq - 1 / self.sfreq
            end_time = min(end_time, max_time)

            raw_epoch = self.raw.copy().crop(tmin=start_time, tmax=end_time)

            # 创建临时分析器
            temp_analyzer = BandAnalyzer(
                raw=raw_epoch,
                epoch_duration=None,  # 不再分段
                eeg_channels=self.eeg_channels,
                include_gamma=self.include_gamma,
            )

            # 分析各通道
            channel_results: Dict[str, ChannelBandResult] = {}
            for ch_name in self.eeg_channels:
                try:
                    result = temp_analyzer.analyze_channel(ch_name)
                    channel_results[ch_name] = result
                except Exception as e:
                    logger.error(
                        f"Failed to analyze channel {ch_name} in epoch {i}: {e}"
                    )
                    continue

            epoch_result = EpochResult(
                start_time=start_time,
                end_time=end_time,
                channel_results=channel_results,
            )
            epoch_results.append(epoch_result)

        return epoch_results
