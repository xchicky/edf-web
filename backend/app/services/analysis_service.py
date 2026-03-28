"""
Analysis Service - EEG signal analysis functionality
"""

import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import mne
from scipy import stats

logger = logging.getLogger(__name__)

# NumPy 版本兼容性：np.trapezoid (numpy >=2.0) 或 np.trapz (numpy <2.0)
_trapz_func = np.trapezoid if hasattr(np, 'trapezoid') else np.trapz


class AnalysisService:
    """EEG 信号分析服务"""

    # 标准 EEG 频带定义
    FREQUENCY_BANDS = {
        "delta": (0.5, 4),
        "theta": (4, 8),
        "alpha": (8, 13),
        "beta": (13, 30),
        "gamma": (30, 50),
    }

    def __init__(self, file_path: str):
        """
        初始化分析服务

        Args:
            file_path: EDF 文件路径
        """
        self.file_path = Path(file_path)
        self.raw: Optional[mne.io.Raw] = None
        self._load_edf()

    def _load_edf(self) -> None:
        """加载 EDF 文件（延迟加载模式）"""
        try:
            logger.info(f"Loading EDF file for analysis: {self.file_path}")
            self.raw = mne.io.read_raw_edf(
                str(self.file_path),
                preload=False,
                encoding="latin1",
                verbose=False,
            )
            logger.info(f"EDF loaded: {len(self.raw.ch_names)} channels")
        except Exception as e:
            logger.error(f"Failed to load EDF file: {e}")
            raise

    def compute_time_domain_stats(
        self,
        start_time: float,
        duration: float,
        channels: Optional[List[str]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        计算时域统计量

        Args:
            start_time: 开始时间（秒）
            duration: 持续时间（秒）
            channels: 通道名称列表（None 表示所有通道）

        Returns:
            每个通道的统计量字典
        """
        if self.raw is None:
            raise ValueError("EDF file not loaded")

        # 确定要分析的通道
        if channels is None:
            channels = self.raw.ch_names
        else:
            # 验证通道存在
            for ch in channels:
                if ch not in self.raw.ch_names:
                    raise ValueError(f"Channel {ch} not found in EDF file")

        # 裁剪并加载数据
        raw_cropped = self.raw.copy().crop(
            tmin=start_time, tmax=start_time + duration
        )
        raw_cropped.pick_channels(channels)
        raw_cropped.load_data()

        # 获取数据（微伏）
        data = raw_cropped.get_data(units="µV")
        sfreq = self.raw.info["sfreq"]

        results = {}

        for i, ch_name in enumerate(channels):
            channel_data = data[i]

            # 基本统计量
            mean = float(np.mean(channel_data))
            std = float(np.std(channel_data))
            min_val = float(np.min(channel_data))
            max_val = float(np.max(channel_data))

            # RMS
            rms = float(np.sqrt(np.mean(channel_data**2)))

            # 峰峰值
            peak_to_peak = max_val - min_val

            # 峰度和偏度
            kurtosis = float(stats.kurtosis(channel_data))
            skewness = float(stats.skew(channel_data))

            # 样本数
            n_samples = len(channel_data)

            results[ch_name] = {
                "mean": mean,
                "std": std,
                "min": min_val,
                "max": max_val,
                "rms": rms,
                "peak_to_peak": peak_to_peak,
                "kurtosis": kurtosis,
                "skewness": skewness,
                "n_samples": n_samples,
            }

            logger.debug(
                f"Channel {ch_name}: mean={mean:.2f}, std={std:.2f}, "
                f"rms={rms:.2f}, n_samples={n_samples}"
            )

        return results

    def compute_band_power(
        self,
        start_time: float,
        duration: float,
        channels: Optional[List[str]] = None,
        bands: Optional[Dict[str, Tuple[float, float]]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        计算频带功率

        Args:
            start_time: 开始时间（秒）
            duration: 持续时间（秒）
            channels: 通道名称列表（None 表示所有通道）
            bands: 频带定义字典（None 使用标准频带）

        Returns:
            频带功率结果
        """
        if self.raw is None:
            raise ValueError("EDF file not loaded")

        # 使用默认频带或自定义频带
        if bands is None:
            bands = self.FREQUENCY_BANDS

        # 确定要分析的通道
        if channels is None:
            channels = self.raw.ch_names
        else:
            # 验证通道存在
            for ch in channels:
                if ch not in self.raw.ch_names:
                    raise ValueError(f"Channel {ch} not found in EDF file")

        # 裁剪并加载数据
        raw_cropped = self.raw.copy().crop(
            tmin=start_time, tmax=start_time + duration
        )
        raw_cropped.pick_channels(channels)
        raw_cropped.load_data()

        # 获取数据
        data = raw_cropped.get_data(units="µV")
        sfreq = float(self.raw.info["sfreq"])

        results = {}

        for i, ch_name in enumerate(channels):
            channel_data = data[i]
            n_samples = len(channel_data)

            # 动态计算 n_fft，确保不超过信号长度
            # 使用 2 的幂次方以获得更高效的 FFT
            n_fft = min(256, 2 ** int(np.log2(n_samples)))
            n_fft = max(n_fft, 8)  # 最小值为 8
            # n_overlap 不应超过 n_fft // 2
            n_overlap = min(n_fft // 2, n_samples // 4)

            logger.debug(
                f"Channel {ch_name}: n_samples={n_samples}, n_fft={n_fft}, n_overlap={n_overlap}"
            )

            # 计算 PSD 使用 Welch 方法
            from mne.time_frequency import psd_array_welch

            psds, freqs = psd_array_welch(
                channel_data,
                sfreq=sfreq,
                fmin=0.5,
                fmax=50,
                n_fft=n_fft,
                n_overlap=n_overlap,
                verbose=False,
            )

            # psds 的形状可能是 (n_freqs,) 或 (n_segments, n_freqs)
            # 确保是 2D 数组
            if psds.ndim == 1:
                psds = psds.reshape(1, -1)

            # 平均 PSD（跨段）
            psd_mean = psds.mean(axis=0)

            # 计算各频带的功率
            band_results = {}
            total_power = 0

            for band_name, (fmin_band, fmax_band) in bands.items():
                # 找到频带范围内的频率索引
                freq_mask = (freqs >= fmin_band) & (freqs <= fmax_band)
                band_psds = psd_mean[freq_mask]

                # 绝对功率（积分）
                absolute_power = float(_trapz_func(band_psds, freqs[freq_mask]))
                total_power += absolute_power

                band_results[band_name] = {
                    "absolute": absolute_power,
                    "range": [fmin_band, fmax_band],
                }

            # 计算相对功率
            for band_name in band_results:
                if total_power > 0:
                    relative_power = (
                        band_results[band_name]["absolute"] / total_power
                    )
                else:
                    relative_power = 0.0
                band_results[band_name]["relative"] = relative_power

            results[ch_name] = band_results

            logger.debug(f"Channel {ch_name} band power computed")

        return results

    def compute_psd(
        self,
        start_time: float,
        duration: float,
        channels: Optional[List[str]] = None,
        fmin: float = 0.5,
        fmax: float = 50,
    ) -> Dict[str, Dict[str, Any]]:
        """
        计算功率谱密度

        Args:
            start_time: 开始时间（秒）
            duration: 持续时间（秒）
            channels: 通道名称列表（None 表示所有通道）
            fmin: 最小频率
            fmax: 最大频率

        Returns:
            PSD 结果（频率数组和 PSD 值）
        """
        if self.raw is None:
            raise ValueError("EDF file not loaded")

        # 确定要分析的通道
        if channels is None:
            channels = self.raw.ch_names
        else:
            # 验证通道存在
            for ch in channels:
                if ch not in self.raw.ch_names:
                    raise ValueError(f"Channel {ch} not found in EDF file")

        # 裁剪并加载数据
        raw_cropped = self.raw.copy().crop(
            tmin=start_time, tmax=start_time + duration
        )
        raw_cropped.pick_channels(channels)
        raw_cropped.load_data()

        # 获取数据
        data = raw_cropped.get_data(units="µV")
        sfreq = float(self.raw.info["sfreq"])

        results = {}

        from mne.time_frequency import psd_array_welch

        for i, ch_name in enumerate(channels):
            channel_data = data[i]
            n_samples = len(channel_data)

            # 动态计算 n_fft，确保不超过信号长度
            # 使用 2 的幂次方以获得更高效的 FFT
            n_fft = min(256, 2 ** int(np.log2(n_samples)))
            n_fft = max(n_fft, 8)  # 最小值为 8
            # n_overlap 不应超过 n_fft // 2
            n_overlap = min(n_fft // 2, n_samples // 4)

            # 计算 PSD
            psds, freqs = psd_array_welch(
                channel_data,
                sfreq=sfreq,
                fmin=fmin,
                fmax=fmax,
                n_fft=n_fft,
                n_overlap=n_overlap,
                verbose=False,
            )

            # psds 的形状可能是 (n_freqs,) 或 (n_segments, n_freqs)
            # 确保是 2D 数组以便平均
            if psds.ndim == 1:
                psds = psds.reshape(1, -1)

            # 平均 PSD（跨段）
            psd_mean = psds.mean(axis=0)

            results[ch_name] = {
                "frequencies": freqs.tolist(),
                "psd": psd_mean.tolist(),
                "sfreq": sfreq,
            }

            logger.debug(f"Channel {ch_name} PSD computed, {len(freqs)} frequency bins")

        return results

    def __del__(self):
        """清理资源"""
        if self.raw is not None:
            del self.raw
