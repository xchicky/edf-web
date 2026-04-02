"""
预处理对比工具

提供对比不同预处理方法效果的统一接口，用于评估去漂移算法的有效性。

主要功能:
1. 对比单个或多个预处理方法
2. 评估恢复效果（相关性、MSE、频带功率）
3. 排序并推荐最佳方法
4. 生成对比报告
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import json
from datetime import datetime

from app.services.preprocessing import SignalPreprocessor, PreprocessMethod


class PreprocessingComparator:
    """预处理方法对比器

    用于评估不同预处理方法对漂移信号的恢复效果。

    验证标准:
    - 相关性 (correlation): >0.9 表示恢复效果好
    - MSE: 越小越好
    - 频带功率误差 (band_power_error): <15% 表示频带识别准确
    - SNR 改善 (snr_improvement): >5dB 表示显著改善
    """

    # 标准 EEG 频带定义
    FREQUENCY_BANDS = {
        "delta": (0.5, 4),
        "theta": (4, 8),
        "alpha": (8, 13),
        "beta": (13, 30),
        "gamma": (30, 50),
    }

    # 默认验证标准
    DEFAULT_VALIDATION_CRITERIA = {
        'min_correlation': 0.90,
        'max_band_error': 15.0,
        'min_snr_improvement': 0.0,  # 可选，不强制要求
        'max_mse': 10.0,
    }

    def __init__(self, sfreq: float):
        """
        初始化对比器

        Args:
            sfreq: 采样率 (Hz)
        """
        self.sfreq = sfreq
        self.preprocessor = SignalPreprocessor(sfreq)

    def compare_method(
        self,
        clean_signal: np.ndarray,
        drifted_signal: np.ndarray,
        method: str,
        method_params: Optional[Dict[str, Any]] = None,
        validation_criteria: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        对比单个预处理方法

        Args:
            clean_signal: 干净的原始信号
            drifted_signal: 带漂移的信号
            method: 预处理方法名称
            method_params: 方法参数（如 {'cutoff': 0.5}）
            validation_criteria: 验证标准（覆盖默认值）

        Returns:
            包含评估指标的字典
        """
        criteria = validation_criteria or self.DEFAULT_VALIDATION_CRITERIA
        params = method_params or {}

        # 应用预处理
        if method == PreprocessMethod.NONE:
            recovered_signal = drifted_signal.copy()
        else:
            recovered_signal = self.preprocessor.process(
                drifted_signal,
                method,
                **params
            )

        # 计算评估指标
        correlation = float(np.corrcoef(clean_signal, recovered_signal)[0, 1])
        mse = float(np.mean((clean_signal - recovered_signal) ** 2))

        # 计算频带功率
        clean_bands = self.calculate_band_power(clean_signal)
        recovered_bands = self.calculate_band_power(recovered_signal)

        # 计算频带功率误差（总误差）
        band_error = self._calculate_total_band_error(clean_bands, recovered_bands)

        # 计算 SNR 改善
        snr_before = self.calculate_snr(drifted_signal)
        snr_after = self.calculate_snr(recovered_signal)
        snr_improvement = snr_after - snr_before

        # 综合判断是否通过
        passed = (
            correlation >= criteria['min_correlation'] and
            band_error <= criteria['max_band_error'] and
            mse <= criteria['max_mse']
        )

        return {
            'method': method,
            'method_params': params,
            'correlation': correlation,
            'mse': mse,
            'band_power_error': band_error,
            'snr_before': snr_before,
            'snr_after': snr_after,
            'snr_improvement': snr_improvement,
            'passed': passed,
            'clean_bands': clean_bands,
            'recovered_bands': recovered_bands,
        }

    def compare_methods(
        self,
        clean_signal: np.ndarray,
        drifted_signal: np.ndarray,
        methods: List[str],
        method_params_map: Optional[Dict[str, Dict[str, Any]]] = None,
        validation_criteria: Optional[Dict[str, float]] = None
    ) -> List[Dict[str, Any]]:
        """
        对比多个预处理方法

        Args:
            clean_signal: 干净的原始信号
            drifted_signal: 带漂移的信号
            methods: 预处理方法列表
            method_params_map: 方法参数映射
            validation_criteria: 验证标准

        Returns:
            评估结果列表
        """
        params_map = method_params_map or {}
        results = []

        for method in methods:
            params = params_map.get(method, {})
            result = self.compare_method(
                clean_signal,
                drifted_signal,
                method,
                params,
                validation_criteria
            )
            results.append(result)

        return results

    def rank_methods(
        self,
        results: List[Dict[str, Any]],
        metric: str = 'correlation'
    ) -> List[Dict[str, Any]]:
        """
        按指标排序方法

        Args:
            results: 评估结果列表
            metric: 排序指标 ('correlation', 'mse', 'band_power_error')

        Returns:
            排序后的结果列表
        """
        reverse = metric in ['correlation', 'snr_improvement']
        return sorted(results, key=lambda x: x[metric], reverse=reverse)

    def calculate_band_power(
        self,
        signal: np.ndarray,
        fmin: float = 0.5,
        fmax: float = 50.0
    ) -> Dict[str, Dict[str, float]]:
        """
        计算频带功率

        使用 Welch 方法计算功率谱密度，然后积分得到各频带功率。

        Args:
            signal: 输入信号
            fmin: 最小频率
            fmax: 最大频率

        Returns:
            频带功率字典
        """
        from mne.time_frequency import psd_array_welch

        n_samples = len(signal)
        target_resolution = 0.5
        min_n_fft = int(self.sfreq / target_resolution)
        power_of_two = 2 ** int(np.log2(n_samples))
        n_fft = max(power_of_two, min_n_fft)

        if n_fft > n_samples:
            n_fft = 2 ** int(np.log2(n_fft)) if n_fft == 2 ** int(np.log2(n_fft)) else 2 ** (int(np.log2(n_fft)) + 1)

        n_fft = max(n_fft, 8)
        n_per_seg = min(n_samples, n_fft)
        n_overlap = min(n_fft // 2, n_samples // 4)

        psds, freqs = psd_array_welch(
            signal,
            sfreq=self.sfreq,
            fmin=fmin,
            fmax=fmax,
            n_fft=n_fft,
            n_per_seg=n_per_seg,
            n_overlap=n_overlap,
            verbose=False
        )

        if psds.ndim == 1:
            psds = psds.reshape(1, -1)
        psd_mean = psds.mean(axis=0)

        bands = {}
        total_power = 0

        for band_name, (fmin_band, fmax_band) in self.FREQUENCY_BANDS.items():
            freq_mask = (freqs >= fmin_band) & (freqs < fmax_band)
            band_psds = psd_mean[freq_mask]
            absolute_power = float(np.trapezoid(band_psds, freqs[freq_mask]))
            total_power += absolute_power
            bands[band_name] = {
                "absolute": absolute_power,
                "relative": 0.0,
            }

        # 计算相对功率
        for band_name in bands:
            if total_power > 0:
                bands[band_name]["relative"] = bands[band_name]["absolute"] / total_power * 100
            else:
                bands[band_name]["relative"] = 0.0

        return bands

    def calculate_snr(self, signal: np.ndarray) -> float:
        """
        计算信噪比 (SNR)

        使用简单方法：信号功率 / 噪声功率
        假设噪声是信号的高频成分

        Args:
            signal: 输入信号

        Returns:
            SNR (dB)
        """
        # 简单方法：使用信号方差
        signal_power = np.mean(signal ** 2)

        # 估计噪声：使用高通滤波后的信号
        from scipy.signal import butter, filtfilt
        nyquist = self.sfreq / 2
        normal_cutoff = 20 / nyquist
        b, a = butter(4, normal_cutoff, btype='high', analog=False)
        high_freq = filtfilt(b, a, signal)
        noise_power = np.mean(high_freq ** 2)

        if noise_power == 0 or signal_power == 0:
            return float('inf')

        snr = 10 * np.log10(signal_power / noise_power)
        return float(snr)

    def generate_report(
        self,
        results: List[Dict[str, Any]],
        output_path: Path,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        生成对比报告

        Args:
            results: 评估结果列表
            output_path: 输出文件路径
            metadata: 额外的元数据
        """
        # 找出最佳方法
        best_by_correlation = max(results, key=lambda x: x['correlation'])
        best_by_mse = min(results, key=lambda x: x['mse'])
        best_by_band_error = min(results, key=lambda x: x['band_power_error'])

        # 统计信息
        passed_count = sum(1 for r in results if r['passed'])
        total_count = len(results)

        # 确定最佳方法（综合评分）
        best_method = best_by_correlation['method']

        report = {
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {},
            'summary': {
                'total_methods': total_count,
                'passed_methods': passed_count,
                'pass_rate': passed_count / total_count if total_count > 0 else 0,
            },
            'best_method': best_method,
            'best_methods': {
                'by_correlation': {
                    'method': best_by_correlation['method'],
                    'correlation': best_by_correlation['correlation'],
                },
                'by_mse': {
                    'method': best_by_mse['method'],
                    'mse': best_by_mse['mse'],
                },
                'by_band_error': {
                    'method': best_by_band_error['method'],
                    'band_error': best_by_band_error['band_power_error'],
                },
            },
            'results': results,
        }

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

    def _calculate_total_band_error(
        self,
        bands1: Dict[str, Dict[str, float]],
        bands2: Dict[str, Dict[str, float]]
    ) -> float:
        """
        计算频带功率总误差

        Args:
            bands1: 频带1
            bands2: 频带2

        Returns:
            总误差（百分比）
        """
        total_error = 0.0
        count = 0

        for band_name in bands1:
            if band_name in bands2:
                rel1 = bands1[band_name]['relative']
                rel2 = bands2[band_name]['relative']
                error = abs(rel1 - rel2)
                total_error += error
                count += 1

        return total_error / count if count > 0 else 0.0


def compare_preprocessing_on_drift(
    drift_type: str,
    drift_params: Dict[str, Any],
    base_frequency: float = 10.0,
    sfreq: float = 500.0,
    duration: float = 2.0
) -> Dict[str, Any]:
    """
    便捷函数：在特定漂移类型上对比预处理方法

    Args:
        drift_type: 漂移类型 ('linear', 'sinusoidal', 'combined')
        drift_params: 漂移参数
        base_frequency: 基础信号频率 (Hz)
        sfreq: 采样率
        duration: 时长 (秒)

    Returns:
        对比结果
    """
    from exp.fixtures.drift_signals import DriftGenerator

    # 生成测试信号
    t = np.arange(0, duration, 1 / sfreq)
    clean_signal = np.sin(2 * np.pi * base_frequency * t)

    # 添加漂移
    drift_gen = DriftGenerator(sfreq)

    if drift_type == 'linear':
        drifted_signal = drift_gen.add_linear_drift(
            clean_signal.copy(),
            **drift_params
        )
    elif drift_type == 'sinusoidal':
        drifted_signal = drift_gen.add_sinusoidal_drift(
            clean_signal.copy(),
            **drift_params
        )
    elif drift_type == 'combined':
        drifted_signal = drift_gen.add_combined_drift(
            clean_signal.copy(),
            **drift_params
        )
    else:
        raise ValueError(f"Unknown drift type: {drift_type}")

    # 对比方法
    comparator = PreprocessingComparator(sfreq)

    methods = [
        PreprocessMethod.NONE,
        PreprocessMethod.LINEAR_DETREND,
        PreprocessMethod.POLYNOMIAL_DETREND,
        PreprocessMethod.HIGHPASS_FILTER,
        PreprocessMethod.BASELINE_CORRECTION,
    ]

    results = comparator.compare_methods(clean_signal, drifted_signal, methods)

    return {
        'drift_type': drift_type,
        'drift_params': drift_params,
        'base_frequency': base_frequency,
        'results': results,
    }
