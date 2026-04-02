"""
分析验证工具模块

提供 EEG 信号分析结果的验证功能，用于实验框架中评估分析工具的准确性。
"""

import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass

from exp.utils.metrics import calculate_snr, calculate_sar, band_power_error


@dataclass
class ValidationResult:
    """验证结果数据类"""
    passed: bool
    metric_name: str
    expected: Any
    actual: Any
    tolerance: Optional[float] = None
    error: Optional[float] = None
    message: str = ""


class AnalysisValidator:
    """分析验证器类

    提供各种验证方法，用于评估 EEG 信号分析的准确性。
    """

    # 标准 EEG 频带定义
    FREQUENCY_BANDS = {
        "delta": (0.5, 4),
        "theta": (4, 8),
        "alpha": (8, 13),
        "beta": (13, 30),
        "gamma": (30, 50),
    }

    def __init__(self, strict_mode: bool = False):
        """
        初始化验证器

        Args:
            strict_mode: 严格模式，使用更严格的容差
        """
        self.strict_mode = strict_mode
        self.results: List[ValidationResult] = []

    def validate_frequency_detection(
        self,
        expected_freq: float,
        detected_freq: float,
        tolerance: float = 0.5
    ) -> ValidationResult:
        """
        验证频率检测准确性

        Args:
            expected_freq: 期望的频率
            detected_freq: 检测到的频率
            tolerance: 容差 (Hz)

        Returns:
            ValidationResult 对象
        """
        error = abs(detected_freq - expected_freq)
        passed = error <= tolerance

        result = ValidationResult(
            passed=passed,
            metric_name="frequency_detection",
            expected=expected_freq,
            actual=detected_freq,
            tolerance=tolerance,
            error=error,
            message=f"频率检测误差: {error:.3f} Hz (容差: {tolerance} Hz)"
        )

        self.results.append(result)
        return result

    def validate_band_classification(
        self,
        expected_band: str,
        frequency: float,
        detected_band: Optional[str] = None
    ) -> ValidationResult:
        """
        验证频带分类准确性

        Args:
            expected_band: 期望的频带 (delta, theta, alpha, beta, gamma)
            frequency: 信号频率
            detected_band: 检测到的频带 (如果 None，则根据频率自动判断)

        Returns:
            ValidationResult 对象
        """
        # 如果没有提供检测到的频带，根据频率自动判断
        if detected_band is None:
            detected_band = self._classify_frequency(frequency)

        passed = expected_band == detected_band

        result = ValidationResult(
            passed=passed,
            metric_name="band_classification",
            expected=expected_band,
            actual=detected_band,
            message=f"频带分类: 期望 {expected_band}, 实际 {detected_band}"
        )

        self.results.append(result)
        return result

    def validate_artifact_detection(
        self,
        artifact_present: bool,
        detected: bool,
        min_confidence: float = 0.7
    ) -> ValidationResult:
        """
        验证伪迹检测准确性

        Args:
            artifact_present: 是否真实存在伪迹
            detected: 是否检测到伪迹
            min_confidence: 最小置信度

        Returns:
            ValidationResult 对象
        """
        passed = (artifact_present and detected) or (not artifact_present and not detected)

        result = ValidationResult(
            passed=passed,
            metric_name="artifact_detection",
            expected=artifact_present,
            actual=detected,
            message=f"伪迹检测: {'正确' if passed else '错误'}"
        )

        self.results.append(result)
        return result

    def validate_drift_detection(
        self,
        clean_signal: np.ndarray,
        drifted_signal: np.ndarray,
        detected_drift: Optional[np.ndarray] = None,
        min_correlation: float = 0.8
    ) -> ValidationResult:
        """
        验证漂移检测准确性

        Args:
            clean_signal: 清洁信号
            drifted_signal: 漂移信号
            detected_drift: 检测到的漂移 (如果 None，则计算漂移)
            min_correlation: 最小相关系数

        Returns:
            ValidationResult 对象
        """
        # 计算漂移
        if detected_drift is None:
            detected_drift = drifted_signal - clean_signal

        # 验证漂移强度
        drift_strength = np.std(detected_drift) / (np.std(clean_signal) + 1e-10)
        has_drift = drift_strength > 0.1

        # 如果有漂移，验证去漂移效果
        if has_drift and len(detected_drift) > 0:
            # 计算去漂移后的信号与原始信号的相关性
            detrended = drifted_signal - detected_drift
            correlation = np.corrcoef(clean_signal, detrended)[0, 1]
            passed = not np.isnan(correlation) and correlation >= min_correlation

            result = ValidationResult(
                passed=passed,
                metric_name="drift_detection",
                expected=f"相关性 >= {min_correlation}",
                actual=f"{correlation:.3f}",
                error=correlation,
                message=f"漂移检测: 强度={drift_strength:.3f}, 去漂移后相关性={correlation:.3f}"
            )
        else:
            result = ValidationResult(
                passed=True,
                metric_name="drift_detection",
                expected="无显著漂移",
                actual=f"强度={drift_strength:.3f}",
                message=f"无显著漂移 (强度={drift_strength:.3f})"
            )

        self.results.append(result)
        return result

    def validate_band_power_accuracy(
        self,
        expected_bands: Dict[str, float],
        actual_bands: Dict[str, float],
        max_error: float = 20.0
    ) -> ValidationResult:
        """
        验证频带功率准确性

        Args:
            expected_bands: 期望的频带功率分布 (百分比)
            actual_bands: 实际的频带功率分布 (百分比)
            max_error: 最大允许误差 (百分比)

        Returns:
            ValidationResult 对象
        """
        # 计算误差
        error = band_power_error(expected_bands, actual_bands)
        passed = error <= max_error

        result = ValidationResult(
            passed=passed,
            metric_name="band_power_accuracy",
            expected=f"误差 <= {max_error}%",
            actual=f"{error:.2f}%",
            error=error,
            message=f"频带功率误差: {error:.2f}% (最大允许: {max_error}%)"
        )

        self.results.append(result)
        return result

    def calculate_detection_metrics(
        self,
        true_positives: int,
        false_positives: int,
        false_negatives: int
    ) -> Dict[str, float]:
        """
        计算检测指标 (精度、召回率、F1)

        Args:
            true_positives: 真阳性数
            false_positives: 假阳性数
            false_negatives: 假阴性数

        Returns:
            包含 precision, recall, f1 的字典
        """
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        return {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives
        }

    def validate_snr(
        self,
        signal: np.ndarray,
        sfreq: float,
        min_snr: float = 10.0
    ) -> ValidationResult:
        """
        验证信噪比

        Args:
            signal: 输入信号
            sfreq: 采样率
            min_snr: 最小 SNR (dB)

        Returns:
            ValidationResult 对象
        """
        snr = calculate_snr(signal, sfreq)
        passed = snr >= min_snr

        result = ValidationResult(
            passed=passed,
            metric_name="snr",
            expected=f"SNR >= {min_snr} dB",
            actual=f"{snr:.2f} dB",
            error=snr,
            message=f"信噪比: {snr:.2f} dB (最小要求: {min_snr} dB)"
        )

        self.results.append(result)
        return result

    def validate_sar(
        self,
        clean_signal: np.ndarray,
        artifact_signal: np.ndarray,
        sfreq: float,
        min_sar: float = 5.0
    ) -> ValidationResult:
        """
        验证信号伪迹比

        Args:
            clean_signal: 清洁信号
            artifact_signal: 含伪迹信号
            sfreq: 采样率
            min_sar: 最小 SAR (dB)

        Returns:
            ValidationResult 对象
        """
        sar = calculate_sar(clean_signal, artifact_signal, sfreq)
        passed = sar >= min_sar

        result = ValidationResult(
            passed=passed,
            metric_name="sar",
            expected=f"SAR >= {min_sar} dB",
            actual=f"{sar:.2f} dB",
            error=sar,
            message=f"信号伪迹比: {sar:.2f} dB (最小要求: {min_sar} dB)"
        )

        self.results.append(result)
        return result

    def get_summary(self) -> Dict[str, Any]:
        """
        获取验证结果摘要

        Returns:
            包含摘要统计的字典
        """
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed

        # 按指标类型分组
        by_metric: Dict[str, Dict[str, int]] = {}
        for result in self.results:
            metric = result.metric_name
            if metric not in by_metric:
                by_metric[metric] = {"passed": 0, "failed": 0}
            if result.passed:
                by_metric[metric]["passed"] += 1
            else:
                by_metric[metric]["failed"] += 1

        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": passed / total if total > 0 else 0.0,
            "by_metric": by_metric,
            "results": self.results
        }

    def clear_results(self) -> None:
        """清除验证结果"""
        self.results = []

    def _classify_frequency(self, freq: float) -> str:
        """
        根据频率分类到 EEG 频带

        Args:
            freq: 频率

        Returns:
            频带名称
        """
        for band, (fmin, fmax) in self.FREQUENCY_BANDS.items():
            if fmin <= freq < fmax:  # 使用半开区间
                return band
        return "unknown"

    def print_summary(self) -> None:
        """打印验证结果摘要"""
        summary = self.get_summary()

        print("\n" + "=" * 60)
        print("验证结果摘要")
        print("=" * 60)
        print(f"总计: {summary['total']} | 通过: {summary['passed']} | 失败: {summary['failed']}")
        print(f"通过率: {summary['pass_rate']:.1%}")

        print("\n按指标分类:")
        for metric, counts in summary['by_metric'].items():
            total_metric = counts['passed'] + counts['failed']
            print(f"  {metric}: {counts['passed']}/{total_metric} 通过")

        print("\n失败的验证:")
        for result in summary['results']:
            if not result.passed:
                print(f"  ✗ {result.metric_name}: {result.message}")

        print("=" * 60 + "\n")
