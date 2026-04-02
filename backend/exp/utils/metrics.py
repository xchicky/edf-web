"""
指标工具模块

提供 EEG 信号分析的各种准确性指标计算函数。
"""

import numpy as np
from typing import Dict, Any
from scipy import signal as scipy_signal
from mne.time_frequency import psd_array_welch


def calculate_snr(signal: np.ndarray, sfreq: float = 500.0) -> float:
    """
    计算信噪比 (SNR)

    使用功率比计算: SNR = 10 * log10(信号功率 / 噪声功率)
    对于纯净信号，假设谐波为信号，其余为噪声

    Args:
        signal: 输入信号
        sfreq: 采样率

    Returns:
        SNR (dB)
    """
    if len(signal) == 0:
        return 0.0

    # 计算 PSD
    psds, freqs = psd_array_welch(
        signal,
        sfreq=sfreq,
        fmin=0.5,
        fmax=50,
        n_fft=min(256, len(signal)),
        verbose=False
    )

    if psds.ndim == 1:
        psds = psds.reshape(1, -1)
    psd_mean = psds.mean(axis=0)

    # 找到主峰频率
    peak_idx = np.argmax(psd_mean)
    peak_freq = freqs[peak_idx]
    peak_power = psd_mean[peak_idx]

    # 计算噪声功率（排除主峰附近的频率）
    noise_mask = np.abs(freqs - peak_freq) > 2  # 排除主峰 ±2Hz
    noise_power = psd_mean[noise_mask].mean() if np.any(noise_mask) else 1e-10

    if noise_power < 1e-10:
        noise_power = 1e-10

    snr = 10 * np.log10(peak_power / noise_power)
    return float(snr)


def calculate_mse(signal1: np.ndarray, signal2: np.ndarray) -> float:
    """
    计算均方误差 (MSE)

    Args:
        signal1: 第一个信号
        signal2: 第二个信号

    Returns:
        MSE 值
    """
    if len(signal1) != len(signal2):
        raise ValueError("信号长度必须相同")

    if len(signal1) == 0:
        return 0.0

    return float(np.mean((signal1 - signal2) ** 2))


def mse(signal1: np.ndarray, signal2: np.ndarray) -> float:
    """MSE 别名，用于向后兼容"""
    return calculate_mse(signal1, signal2)


def rmse(signal1: np.ndarray, signal2: np.ndarray) -> float:
    """
    计算均方根误差 (RMSE)

    Args:
        signal1: 第一个信号
        signal2: 第二个信号

    Returns:
        RMSE 值
    """
    return float(np.sqrt(calculate_mse(signal1, signal2)))


def band_power_error(
    expected: Dict[str, float],
    actual: Dict[str, Dict[str, float]],
    relative_key: str = 'relative'
) -> float:
    """
    计算频带功率误差

    Args:
        expected: 期望的频带功率字典 {band: power}
        actual: 实际的频带功率字典 {band: {relative: x, absolute: y}}
        relative_key: 使用 'relative' 或 'absolute'

    Returns:
        平均绝对百分比误差 (%)
    """
    errors = []

    for band in expected:
        if band in actual:
            exp_val = expected[band]
            act_val = actual[band].get(relative_key, 0)

            if exp_val > 0:
                error = abs(act_val - exp_val) / exp_val * 100
            else:
                error = abs(act_val) * 100  # 期望为0时使用绝对误差
            errors.append(error)

    if not errors:
        return 0.0

    return float(np.mean(errors))


def dominant_band_accuracy(
    band_powers: Dict[str, Dict[str, float]],
    expected_band: str
) -> float:
    """
    计算主导频带识别准确性

    Args:
        band_powers: 频带功率字典
        expected_band: 期望的主导频带

    Returns:
        准确性分数 (1.0 = 完全正确, 0.0 = 完全错误, 0.5 = 平局)
    """
    if not band_powers:
        return 0.0

    # 找到实际主导频带
    powers = {band: data['relative'] for band, data in band_powers.items()}
    max_power = max(powers.values())

    # 检查是否有多个频带达到最大值（平局）
    dominant_bands = [band for band, power in powers.items() if power == max_power]

    if len(dominant_bands) > 1:
        # 平局情况
        if expected_band in dominant_bands:
            return 0.5
        else:
            return 0.0
    else:
        # 唯一主导频带
        if dominant_bands[0] == expected_band:
            return 1.0
        else:
            return 0.0


def spectral_centroid(signal: np.ndarray, sfreq: float) -> float:
    """
    计算频谱质心

    频谱质心表示频谱分布的"重心"位置

    Args:
        signal: 输入信号
        sfreq: 采样率

    Returns:
        频谱质心 (Hz)
    """
    if len(signal) == 0:
        return 0.0

    # 计算 FFT
    fft = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / sfreq)

    # 计算功率
    power = np.abs(fft) ** 2

    # 计算质心
    total_power = np.sum(power)
    if total_power == 0:
        return 0.0

    centroid = np.sum(freqs * power) / total_power
    return float(centroid)


def spectral_flatness(signal: np.ndarray, sfreq: float) -> float:
    """
    计算频谱平坦度

    平坦度表示频谱的"平坦"程度:
    - 接近 1: 白噪声（平坦）
    - 接近 0: 纯音（尖锐）

    Args:
        signal: 输入信号
        sfreq: 采样率

    Returns:
        频谱平坦度 (0-1)
    """
    if len(signal) == 0:
        return 0.0

    # 计算 PSD
    psds, freqs = psd_array_welch(
        signal,
        sfreq=sfreq,
        fmin=0.5,
        fmax=50,
        n_fft=min(256, len(signal)),
        verbose=False
    )

    if psds.ndim == 1:
        psds = psds.reshape(1, -1)
    psd_mean = psds.mean(axis=0)

    # 移除零值以避免 log(0)
    psd_mean = psd_mean[psd_mean > 0]

    if len(psd_mean) == 0:
        return 0.0

    # 计算几何平均和算术平均
    geometric_mean = np.exp(np.mean(np.log(psd_mean)))
    arithmetic_mean = np.mean(psd_mean)

    if arithmetic_mean == 0:
        return 0.0

    flatness = geometric_mean / arithmetic_mean
    return float(flatness)


def calculate_thd(signal: np.ndarray, sfreq: float, fundamental: float) -> float:
    """
    计算总谐波失真 (THD)

    Args:
        signal: 输入信号
        sfreq: 采样率
        fundamental: 基频 (Hz)

    Returns:
        THD (%)
    """
    if len(signal) == 0 or fundamental <= 0:
        return 0.0

    # 计算 FFT
    fft = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / sfreq)
    power = np.abs(fft) ** 2

    # 找到基频功率
    fundamental_idx = np.argmin(np.abs(freqs - fundamental))
    fundamental_power = power[fundamental_idx]

    # 计算谐波功率 (2-5次谐波)
    harmonic_power = 0.0
    for n in range(2, 6):
        harmonic_freq = fundamental * n
        if harmonic_freq < sfreq / 2:
            idx = np.argmin(np.abs(freqs - harmonic_freq))
            harmonic_power += power[idx]

    if fundamental_power == 0:
        return 0.0

    thd = np.sqrt(harmonic_power) / np.sqrt(fundamental_power) * 100
    return float(thd)


def signal_to_artifact_ratio(
    clean_signal: np.ndarray,
    artifact_signal: np.ndarray
) -> float:
    """
    计算信号伪迹比 (SAR)

    Args:
        clean_signal: 干净信号
        artifact_signal: 含伪迹信号

    Returns:
        SAR (dB)
    """
    if len(clean_signal) != len(artifact_signal):
        raise ValueError("信号长度必须相同")

    if len(clean_signal) == 0:
        return 0.0

    signal_power = np.mean(clean_signal ** 2)
    artifact_power = np.mean((artifact_signal - clean_signal) ** 2)

    if artifact_power == 0:
        return float('inf')

    sar = 10 * np.log10(signal_power / artifact_power)
    return float(sar)


def calculate_sar(clean_signal: np.ndarray, artifact_signal: np.ndarray, sfreq: float = None) -> float:
    """
    计算信号伪迹比 (SAR)

    Args:
        clean_signal: 干净信号
        artifact_signal: 含伪迹信号
        sfreq: 采样率 (保留用于兼容性，未使用)

    Returns:
        SAR (dB)
    """
    return signal_to_artifact_ratio(clean_signal, artifact_signal)
