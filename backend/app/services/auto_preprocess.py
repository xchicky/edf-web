"""
EEG 自动预处理流水线

提供完整的 EEG 数据预处理功能，包括：
- 通道类型识别
- 重参考（平均参考/乳突参考）
- Notch 滤波（去除工频干扰）
- 带通滤波
- 伪迹检测（EOG/EMG/Flat/Drift/Jump）
- 伪迹标记（MNE Annotations）
"""

import mne
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# 数据结构定义
# ============================================================================

@dataclass
class ArtifactEvent:
    """伪迹事件

    Attributes:
        start_time: 开始时间（秒）
        end_time: 结束时间（秒）
        artifact_type: 伪迹类型: "eog", "emg", "line_noise", "drift", "flat", "jump"
        channel: 涉及的通道（None 表示所有通道）
        severity: 严重程度 0-1
        description: 描述
    """
    start_time: float
    end_time: float
    artifact_type: str
    channel: Optional[str]
    severity: float
    description: str


@dataclass
class PreprocessResult:
    """预处理结果

    Attributes:
        raw_clean: 清洗后的信号
        artifacts: 检测到的伪迹列表
        preprocess_log: 每步处理的参数和统计
        artifact_annotations: MNE annotations 对象（伪迹标记）
    """
    raw_clean: mne.io.Raw
    artifacts: List[ArtifactEvent] = field(default_factory=list)
    preprocess_log: Dict[str, Any] = field(default_factory=dict)
    artifact_annotations: Optional[Any] = None


# ============================================================================
# 自动预处理流水线
# ============================================================================

class AutoPreprocessPipeline:
    """EEG 自动预处理流水线

    执行完整的 EEG 数据预处理流程，包括重参考、滤波和伪迹检测。

    Example:
        >>> pipeline = AutoPreprocessPipeline("data.edf")
        >>> result = pipeline.run()
        >>> print(f"检测到 {len(result.artifacts)} 个伪迹")
    """

    def __init__(
        self,
        file_path: str,
        reference: Literal["average", "linked-mastoid"] = "average",
        notch_freq: Optional[float] = 50.0,      # None 跳过 notch 滤波
        notch_harmonics: bool = True,              # 是否去除谐波（100Hz, 150Hz...）
        bandpass_low: float = 0.5,
        bandpass_high: float = 50.0,
        bandpass_order: int = 4,
        # 伪迹检测阈值
        eog_threshold: float = 75.0,               # EOG 幅值阈值（µV）
        emg_threshold: float = 50.0,               # EMG 幅值阈值（µV）
        flat_threshold: float = 0.5,               # 平坦信号阈值（µV）
        drift_threshold: float = 100.0,            # 漂移阈值（µV）
        jump_threshold: float = 200.0,             # 跳变阈值（µV）
        artifact_window: float = 0.5,              # 伪迹标记窗口（秒）
    ):
        """
        初始化预处理流水线

        Args:
            file_path: EDF 文件路径
            reference: 重参考方式（"average" 或 "linked-mastoid"）
            notch_freq: Notch 滤波频率（Hz），None 表示跳过
            notch_harmonics: 是否去除谐波
            bandpass_low: 带通滤波低频截止（Hz）
            bandpass_high: 带通滤波高频截止（Hz）
            bandpass_order: 带通滤波阶数
            eog_threshold: EOG 伪迹检测阈值（µV）
            emg_threshold: EMG 伪迹检测阈值（µV）
            flat_threshold: 平坦信号检测阈值（µV）
            drift_threshold: 漂移检测阈值（µV）
            jump_threshold: 跳变检测阈值（µV）
            artifact_window: 伪迹标记窗口大小（秒）
        """
        self.file_path = Path(file_path)
        self.reference = reference
        self.notch_freq = notch_freq
        self.notch_harmonics = notch_harmonics
        self.bandpass_low = bandpass_low
        self.bandpass_high = bandpass_high
        self.bandpass_order = bandpass_order

        # 伪迹检测参数
        self.eog_threshold = eog_threshold
        self.emg_threshold = emg_threshold
        self.flat_threshold = flat_threshold
        self.drift_threshold = drift_threshold
        self.jump_threshold = jump_threshold
        self.artifact_window = artifact_window

        # 内部状态
        self.raw: Optional[mne.io.Raw] = None
        self.channel_types: Dict[str, str] = {}
        self.preprocess_log: Dict[str, Any] = {}

    def _load_edf(self) -> None:
        """加载 EDF/FIF 文件（延迟加载模式）"""
        try:
            logger.info(f"加载文件: {self.file_path}")
            file_ext = self.file_path.suffix.lower()

            if file_ext in [".edf", ".edf+", ".bdf"]:
                # EDF 格式
                self.raw = mne.io.read_raw_edf(
                    str(self.file_path),
                    preload=False,
                    encoding="latin1",
                    verbose=False,
                )
            elif file_ext in [".fif", ".fif.gz"]:
                # FIF 格式
                self.raw = mne.io.read_raw_fif(
                    str(self.file_path),
                    preload=False,
                    verbose=False,
                )
            else:
                # 尝试自动检测
                self.raw = mne.io.read_raw(str(self.file_path), preload=False, verbose=False)

            logger.info(f"文件加载成功: {len(self.raw.ch_names)} 个通道")
        except Exception as e:
            logger.error(f"文件加载失败: {e}")
            raise

    def run(self) -> PreprocessResult:
        """执行完整的预处理流水线

        步骤：
        1. 加载 EDF 文件（preload=False）
        2. 识别通道类型（EEG/EOG/EMG/其他）
        3. 重参考（average 或 linked-mastoid）
        4. 伪迹检测（在原始数据上，避免高频 EMG 被带通滤波滤除）
        5. Notch 滤波（去除工频干扰）
        6. 带通滤波
        7. 记录伪迹到 MNE annotations
        8. 返回结果

        Returns:
            PreprocessResult: 预处理结果对象
        """
        logger.info("开始 EEG 自动预处理流水线")

        # 1. 加载 EDF 文件
        self._load_edf()

        # 2. 识别通道类型
        logger.info("识别通道类型")
        self.channel_types = self._identify_channel_types()
        self.preprocess_log["channel_types"] = self.channel_types

        # 3. 重参考
        logger.info(f"执行重参考: {self.reference}")
        ref_info = self._set_reference()
        self.preprocess_log["reference"] = ref_info

        # 4. 伪迹检测（在带通滤波之前，以检测高频 EMG）
        logger.info("检测伪迹")
        artifacts = self._detect_artifacts()
        self.preprocess_log["artifact_detection"] = {
            "n_artifacts": len(artifacts),
            "by_type": {
                atype: sum(1 for a in artifacts if a.artifact_type == atype)
                for atype in set(a.artifact_type for a in artifacts)
            }
        }

        # 5. Notch 滤波
        if self.notch_freq is not None:
            logger.info(f"执行 Notch 滤波: {self.notch_freq} Hz")
            notch_info = self._apply_notch_filter()
            self.preprocess_log["notch_filter"] = notch_info
        else:
            logger.info("跳过 Notch 滤波")
            self.preprocess_log["notch_filter"] = None

        # 6. 带通滤波
        logger.info(f"执行带通滤波: {self.bandpass_low}-{self.bandpass_high} Hz")
        bandpass_info = self._apply_bandpass_filter()
        self.preprocess_log["bandpass_filter"] = bandpass_info

        # 7. 标记伪迹
        logger.info(f"标记 {len(artifacts)} 个伪迹")
        annotations = self._mark_artifacts(artifacts)

        logger.info("预处理流水线完成")

        # 8. 返回结果
        return PreprocessResult(
            raw_clean=self.raw.copy(),
            artifacts=artifacts,
            preprocess_log=self.preprocess_log,
            artifact_annotations=annotations,
        )

    def _identify_channel_types(self) -> Dict[str, str]:
        """识别通道类型

        根据通道名称自动识别类型（MNE 标准）：
        - 通道名包含 "EEG" 或标准 10-20 系统命名 → EEG
        - 通道名包含 "EOG" 或 "eye" → EOG
        - 通道名包含 "EMG" 或 "muscle" → EMG
        - 乳突通道（M1, M2, A1, A2）→ EEG
        - 其他 → misc
        - 如果无法识别，默认所有通道为 EEG

        同时设置 self.channel_types 以便其他方法使用。

        Returns:
            Dict[str, str]: 通道名称到类型的映射
        """
        channel_types = {}

        # 标准 10-20 系统通道名
        eeg_channels_10_20 = [
            "Fp1", "Fp2", "Fz", "F3", "F4", "F7", "F8",
            "FCz", "FC3", "FC4",
            "Cz", "C3", "C4",
            "CPz", "CP3", "CP4",
            "Pz", "P3", "P4", "P7", "P8",
            "Oz", "O1", "O2",
            "M1", "M2", "A1", "A2",  # 乳突通道
        ]

        for ch_name in self.raw.ch_names:
            ch_upper = ch_name.upper()

            # EOG 通道
            if "EOG" in ch_upper or "EYE" in ch_upper:
                channel_types[ch_name] = "eog"
            # EMG 通道
            elif "EMG" in ch_upper or "MUSCLE" in ch_upper:
                channel_types[ch_name] = "emg"
            # EEG 通道（标准 10-20 或包含 EEG）
            elif ch_upper in eeg_channels_10_20 or "EEG" in ch_upper:
                channel_types[ch_name] = "eeg"
            # 其他默认为 EEG
            else:
                channel_types[ch_name] = "eeg"
                logger.debug(f"通道 {ch_name} 无法识别，默认为 EEG")

        # 自动设置 self.channel_types 以便其他方法使用
        self.channel_types = channel_types

        logger.info(f"识别通道类型: EEG={sum(1 for t in channel_types.values() if t=='eeg')}, "
                    f"EOG={sum(1 for t in channel_types.values() if t=='eog')}, "
                    f"EMG={sum(1 for t in channel_types.values() if t=='emg')}")

        return channel_types

    def _set_reference(self) -> Dict[str, Any]:
        """重参考

        使用 mne.io.Raw.set_eeg_reference()

        - average: 所有 EEG 通道的平均值作为参考
        - linked-mastoid: 需要识别乳突通道（M1, M2, A1, A2），如果没有则退化为 average

        Returns:
            Dict[str, Any]: 重参考信息（方法、通道等）
        """
        # 确保数据已加载
        if not self.raw.preload:
            self.raw.load_data()

        ref_info = {
            "method": self.reference,
            "channels": [],
        }

        # 获取所有 EEG 通道
        eeg_channels = [
            ch for ch, ch_type in self.channel_types.items()
            if ch_type == "eeg" and ch in self.raw.ch_names
        ]

        if not eeg_channels:
            logger.warning("没有找到 EEG 通道，跳过重参考")
            return ref_info

        if self.reference == "average":
            # 平均参考
            self.raw.set_eeg_reference("average", projection=False)
            ref_info["channels"] = eeg_channels
            logger.info(f"使用平均参考，涉及 {len(eeg_channels)} 个通道")

        elif self.reference == "linked-mastoid":
            # 乳突参考 - 查找所有通道中的乳突通道
            mastoid_channels = [
                ch for ch in self.raw.ch_names
                if ch.upper() in ["M1", "M2", "A1", "A2"]
            ]

            if mastoid_channels:
                # 找到乳突通道
                self.raw.set_eeg_reference(mastoid_channels, projection=False)
                ref_info["channels"] = list(mastoid_channels)  # 记录使用的参考通道
                logger.info(f"使用乳突参考: {mastoid_channels}")
            else:
                # 没有乳突通道，退化为平均参考
                logger.warning("未找到乳突通道（M1/M2/A1/A2），退化为平均参考")
                self.raw.set_eeg_reference("average", projection=False)
                ref_info["method"] = "average (fallback from linked-mastoid)"
                ref_info["channels"] = list(eeg_channels)

        return ref_info

    def _apply_notch_filter(self) -> Optional[Dict[str, Any]]:
        """Notch 滤波

        使用 mne.filter.notch_filter 或 raw.notch_filter()
        默认去除 50Hz（中国工频）
        如果 notch_harmonics=True，同时去除 100Hz, 150Hz（不超过 Nyquist）

        Returns:
            Optional[Dict[str, Any]]: 滤波参数，如果跳过则返回 None
        """
        if self.notch_freq is None:
            return None

        # 确保数据已加载
        if not self.raw.preload:
            self.raw.load_data()

        # 确定要去除的频率
        sfreq = self.raw.info["sfreq"]
        nyquist = sfreq / 2

        freqs = [self.notch_freq]
        if self.notch_harmonics:
            # 添加谐波（2x, 3x, ...），不超过 Nyquist
            harmonic = 2
            while self.notch_freq * harmonic < nyquist * 0.95:
                freqs.append(self.notch_freq * harmonic)
                harmonic += 1

        # 执行 Notch 滤波
        self.raw.notch_filter(
            freqs=freqs,
            picks="eeg",
            filter_length="auto",
            notch_widths=None,
            trans_bandwidth=1.0,
            n_jobs=1,
            method="fir",
            iir_params=None,
            mt_bandwidth=None,
            p_value=0.05,
            phase="zero",
            fir_window="hamming",
            fir_design="firwin2",
            verbose=False,
        )

        notch_info = {
            "freqs": freqs,
            "n_freqs": len(freqs),
        }

        logger.info(f"Notch 滤波完成，去除频率: {freqs} Hz")

        return notch_info

    def _apply_bandpass_filter(self) -> Dict[str, Any]:
        """带通滤波

        使用 mne.filter.filter 或 raw.filter()
        FIR 滤波器（零相位）

        Returns:
            Dict[str, Any]: 滤波参数和统计
        """
        # 确保数据已加载
        if not self.raw.preload:
            self.raw.load_data()

        # 获取滤波前数据统计
        data_before = self.raw.get_data()
        stats_before = {
            "mean": float(np.mean(data_before)),
            "std": float(np.std(data_before)),
            "min": float(np.min(data_before)),
            "max": float(np.max(data_before)),
        }

        # 执行带通滤波
        self.raw.filter(
            l_freq=self.bandpass_low,
            h_freq=self.bandpass_high,
            picks="eeg",
            filter_length="auto",
            l_trans_bandwidth="auto",
            h_trans_bandwidth="auto",
            n_jobs=1,
            method="fir",
            iir_params=None,
            phase="zero",
            fir_window="hamming",
            fir_design="firwin2",
            verbose=False,
        )

        # 获取滤波后数据统计
        data_after = self.raw.get_data()
        stats_after = {
            "mean": float(np.mean(data_after)),
            "std": float(np.std(data_after)),
            "min": float(np.min(data_after)),
            "max": float(np.max(data_after)),
        }

        bandpass_info = {
            "low": self.bandpass_low,
            "high": self.bandpass_high,
            "order": self.bandpass_order,
            "stats_before": stats_before,
            "stats_after": stats_after,
        }

        logger.info(f"带通滤波完成: {self.bandpass_low}-{self.bandpass_high} Hz")

        return bandpass_info

    def _detect_artifacts(self) -> List[ArtifactEvent]:
        """伪迹检测

        在带通滤波后的数据上进行检测：
        1. 眼电伪迹 (EOG): 幅值超过阈值
        2. 肌电伪迹 (EMG): 短时能量（RMS）超过阈值
        3. 平坦信号 (Flat): 标准差低于阈值
        4. 大幅漂移 (Drift): 峰峰值超过阈值
        5. 线缆伪影 (Jump): 瞬时大幅跳变

        Returns:
            List[ArtifactEvent]: 检测到的伪迹列表
        """
        artifacts = []
        sfreq = self.raw.info["sfreq"]
        data = self.raw.get_data() * 1e6  # 转换为 µV
        times = self.raw.times

        # 1. 检测 EOG 伪迹
        eog_channels = [
            ch for ch, ch_type in self.channel_types.items()
            if ch_type == "eog" and ch in self.raw.ch_names
        ]

        if eog_channels:
            # 使用 EOG 通道
            eog_ch_names = eog_channels
        else:
            # 使用前方通道（Fp1, Fp2）作为近似
            eog_ch_names = [
                ch for ch in self.raw.ch_names
                if ch.upper() in ["FP1", "FP2"]
            ]

        for ch_name in eog_ch_names:
            ch_idx = self.raw.ch_names.index(ch_name)
            ch_data = data[ch_idx, :]

            # 找到超过阈值的段
            above_threshold = np.abs(ch_data) > self.eog_threshold
            artifact_segments = self._find_segments(
                above_threshold, times, min_duration=0.1
            )

            for start, end in artifact_segments:
                artifacts.append(ArtifactEvent(
                    start_time=start,
                    end_time=end,
                    artifact_type="eog",
                    channel=ch_name,
                    severity=min(1.0, np.max(np.abs(ch_data)) / self.eog_threshold),
                    description=f"EOG 伪迹（幅值 > {self.eog_threshold} µV）",
                ))

        # 2. 检测 EMG 伪迹
        emg_channels = [
            ch for ch, ch_type in self.channel_types.items()
            if ch_type == "emg" and ch in self.raw.ch_names
        ]

        if emg_channels:
            # 使用 EMG 通道
            emg_ch_names = emg_channels
        else:
            # 对所有 EEG 通道检测
            emg_ch_names = [
                ch for ch, ch_type in self.channel_types.items()
                if ch_type == "eeg" and ch in self.raw.ch_names
            ]

        window_samples = int(0.2 * sfreq)  # 0.2s 窗口
        for ch_name in emg_ch_names:
            ch_idx = self.raw.ch_names.index(ch_name)
            ch_data = data[ch_idx, :]

            # 计算短时 RMS
            rms = self._compute_rms(ch_data.reshape(1, -1), window_samples)[0, :]

            # 找到超过阈值的段
            above_threshold = rms > self.emg_threshold
            artifact_segments = self._find_segments(
                above_threshold, times[:len(rms)], min_duration=0.1
            )

            for start, end in artifact_segments:
                artifacts.append(ArtifactEvent(
                    start_time=start,
                    end_time=end,
                    artifact_type="emg",
                    channel=ch_name,
                    severity=min(1.0, np.max(rms) / self.emg_threshold),
                    description=f"EMG 伪迹（RMS > {self.emg_threshold} µV）",
                ))

        # 3. 检测平坦信号
        for ch_name in self.raw.ch_names:
            if self.channel_types.get(ch_name) != "eeg":
                continue

            ch_idx = self.raw.ch_names.index(ch_name)
            ch_data = data[ch_idx, :]

            # 计算滑动窗口标准差
            window_samples = int(1.0 * sfreq)  # 1s 窗口
            std = self._compute_rolling_std(ch_data, window_samples)

            # 找到低于阈值的段
            below_threshold = std < self.flat_threshold
            artifact_segments = self._find_segments(
                below_threshold, times[:len(std)], min_duration=0.5
            )

            for start, end in artifact_segments:
                artifacts.append(ArtifactEvent(
                    start_time=start,
                    end_time=end,
                    artifact_type="flat",
                    channel=ch_name,
                    severity=1.0 - (np.max(std) / self.flat_threshold),
                    description=f"平坦信号（std < {self.flat_threshold} µV）",
                ))

        # 4. 检测大幅漂移
        for ch_name in self.raw.ch_names:
            if self.channel_types.get(ch_name) != "eeg":
                continue

            ch_idx = self.raw.ch_names.index(ch_name)
            ch_data = data[ch_idx, :]

            # 计算滑动窗口峰峰值
            window_samples = int(2.0 * sfreq)  # 2s 窗口
            peak_to_peak = self._compute_rolling_peak_to_peak(ch_data, window_samples)

            # 找到超过阈值的段
            above_threshold = peak_to_peak > self.drift_threshold
            artifact_segments = self._find_segments(
                above_threshold, times[:len(peak_to_peak)], min_duration=1.0
            )

            for start, end in artifact_segments:
                artifacts.append(ArtifactEvent(
                    start_time=start,
                    end_time=end,
                    artifact_type="drift",
                    channel=ch_name,
                    severity=min(1.0, np.max(peak_to_peak) / self.drift_threshold),
                    description=f"大幅漂移（峰峰值 > {self.drift_threshold} µV）",
                ))

        # 5. 检测瞬时跳变
        for ch_name in self.raw.ch_names:
            if self.channel_types.get(ch_name) != "eeg":
                continue

            ch_idx = self.raw.ch_names.index(ch_name)
            ch_data = data[ch_idx, :]

            # 检测跳变
            jump_indices = self._detect_jumps(ch_data.reshape(1, -1), self.jump_threshold)

            for idx in jump_indices:
                # 在跳变位置标记一个短窗口
                start = max(0, times[idx] - self.artifact_window / 2)
                end = min(times[-1], times[idx] + self.artifact_window / 2)

                artifacts.append(ArtifactEvent(
                    start_time=start,
                    end_time=end,
                    artifact_type="jump",
                    channel=ch_name,
                    severity=1.0,
                    description=f"线缆伪影（跳变 > {self.jump_threshold} µV）",
                ))

        # 合并相邻的伪迹窗口
        artifacts = self._merge_artifact_windows(artifacts, gap=0.1)

        logger.info(f"检测到 {len(artifacts)} 个伪迹")

        return artifacts

    def _mark_artifacts(self, artifacts: List[ArtifactEvent]) -> Any:
        """标记伪迹

        将检测到的伪迹转为 MNE Annotations
        添加到 raw_clean 中

        Args:
            artifacts: 伪迹列表

        Returns:
            MNE Annotations 对象
        """
        if not artifacts:
            return None

        # 创建 annotations
        onset = [a.start_time for a in artifacts]
        duration = [a.end_time - a.start_time for a in artifacts]
        description = [f"{a.artifact_type}_{a.channel or 'all'}" for a in artifacts]

        annotations = mne.Annotations(
            onset=onset,
            duration=duration,
            description=description,
        )

        # 添加到 raw
        self.raw.set_annotations(annotations)

        logger.info(f"添加了 {len(artifacts)} 个伪迹标记")

        return annotations

    # ========================================================================
    # 辅助方法
    # ========================================================================

    def _compute_rms(self, data: np.ndarray, window_samples: int) -> np.ndarray:
        """计算滑动窗口 RMS

        Args:
            data: 数据 (n_channels, n_samples)
            window_samples: 窗口大小（采样点数）

        Returns:
            RMS 数据 (n_channels, n_samples - window_samples + 1)
        """
        n_channels, n_samples = data.shape
        rms = np.zeros((n_channels, n_samples - window_samples + 1))

        for i in range(n_channels):
            for j in range(n_samples - window_samples + 1):
                window = data[i, j:j + window_samples]
                rms[i, j] = np.sqrt(np.mean(window ** 2))

        return rms

    def _compute_rolling_std(self, data: np.ndarray, window_samples: int) -> np.ndarray:
        """计算滑动窗口标准差

        Args:
            data: 数据 (n_samples,)
            window_samples: 窗口大小

        Returns:
            标准差数据
        """
        n_samples = len(data)
        std = np.zeros(n_samples - window_samples + 1)

        for i in range(n_samples - window_samples + 1):
            window = data[i:i + window_samples]
            std[i] = np.std(window)

        return std

    def _compute_rolling_peak_to_peak(self, data: np.ndarray, window_samples: int) -> np.ndarray:
        """计算滑动窗口峰峰值

        Args:
            data: 数据 (n_samples,)
            window_samples: 窗口大小

        Returns:
            峰峰值数据
        """
        n_samples = len(data)
        peak_to_peak = np.zeros(n_samples - window_samples + 1)

        for i in range(n_samples - window_samples + 1):
            window = data[i:i + window_samples]
            peak_to_peak[i] = np.max(window) - np.min(window)

        return peak_to_peak

    def _detect_jumps(self, data: np.ndarray, threshold: float) -> List[int]:
        """检测瞬时跳变

        Args:
            data: 数据 (n_channels, n_samples)，单位为 µV
            threshold: 跳变阈值（µV）

        Returns:
            跳变位置的索引列表
        """
        n_channels, n_samples = data.shape
        jump_indices = []

        for i in range(n_channels):
            # 计算相邻采样点的差值
            diff = np.abs(np.diff(data[i, :]))

            # 找到超过阈值的索引
            jumps = np.where(diff > threshold)[0]

            jump_indices.extend(jumps.tolist())

        return list(set(jump_indices))  # 去重

    def _find_segments(
        self,
        mask: np.ndarray,
        times: np.ndarray,
        min_duration: float = 0.1,
    ) -> List[tuple]:
        """找到满足条件的连续时间段

        Args:
            mask: 布尔掩码
            times: 时间数组
            min_duration: 最小时长（秒）

        Returns:
            [(start_time, end_time), ...] 时间段列表
        """
        segments = []
        in_segment = False
        start_idx = None

        for i, value in enumerate(mask):
            if value and not in_segment:
                # 开始新段
                in_segment = True
                start_idx = i
            elif not value and in_segment:
                # 结束当前段
                end_idx = i
                start_time = times[start_idx]
                end_time = times[end_idx - 1] if end_idx > 0 else times[0]

                # 检查时长
                if end_time - start_time >= min_duration:
                    segments.append((start_time, end_time))

                in_segment = False

        # 处理最后一段
        if in_segment and start_idx is not None:
            start_time = times[start_idx]
            end_time = times[-1]
            if end_time - start_time >= min_duration:
                segments.append((start_time, end_time))

        return segments

    def _merge_artifact_windows(
        self,
        artifacts: List[ArtifactEvent],
        gap: float = 0.1,
    ) -> List[ArtifactEvent]:
        """合并相邻的伪迹窗口

        只合并相同类型和通道的伪迹，避免不同类型的伪迹被错误合并。

        Args:
            artifacts: 伪迹列表
            gap: 合并间隔（秒），小于此间隔的窗口会被合并

        Returns:
            合并后的伪迹列表
        """
        if not artifacts:
            return []

        # 按类型和通道分组
        groups = {}
        for artifact in artifacts:
            key = (artifact.artifact_type, artifact.channel)
            if key not in groups:
                groups[key] = []
            groups[key].append(artifact)

        # 对每个组分别进行合并
        merged = []
        for key, group_artifacts in groups.items():
            # 按开始时间排序
            sorted_artifacts = sorted(group_artifacts, key=lambda a: a.start_time)

            current = sorted_artifacts[0]

            for artifact in sorted_artifacts[1:]:
                # 检查是否与当前窗口重叠或间隔很小
                if artifact.start_time - current.end_time <= gap:
                    # 合并
                    current = ArtifactEvent(
                        start_time=current.start_time,
                        end_time=max(current.end_time, artifact.end_time),
                        artifact_type=current.artifact_type,
                        channel=current.channel,
                        severity=max(current.severity, artifact.severity),
                        description=f"{current.description} + {artifact.description}",
                    )
                else:
                    # 不合并，保存当前窗口
                    merged.append(current)
                    current = artifact

            # 保存最后一个窗口
            merged.append(current)

        return merged
