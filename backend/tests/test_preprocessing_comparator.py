"""
Preprocessing Comparator Tests (TDD Phase 1)

测试预处理对比工具，用于评估不同预处理方法对漂移信号的恢复效果。

TDD 流程:
1. RED: 先写测试，验证预处理对比功能
2. GREEN: 实现 PreprocessingComparator 类
3. REFACTOR: 优化代码结构
4. COVERAGE: 确保 80%+ 测试覆盖率
"""

import pytest
import numpy as np
from pathlib import Path
import sys
import tempfile
from typing import Dict, Any, List

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.preprocessing import SignalPreprocessor, PreprocessMethod


class TestPreprocessingComparator:
    """测试预处理对比工具 - 尚未实现"""

    def test_comparator_initialization(self):
        """测试对比工具初始化"""
        sfreq = 500.0

        # 这个类还不存在，测试会失败 (RED)
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        comparator = PreprocessingComparator(sfreq)

        assert comparator.sfreq == sfreq
        assert hasattr(comparator, 'preprocessor')
        assert isinstance(comparator.preprocessor, SignalPreprocessor)

    def test_compare_single_method(self):
        """测试单个预处理方法的对比"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        # 创建带漂移的测试信号
        sfreq = 500.0
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        clean_signal = np.sin(2 * np.pi * 10 * t)  # 10Hz Alpha波
        drifted_signal = clean_signal + 20 * t  # 添加线性漂移

        comparator = PreprocessingComparator(sfreq)

        # 测试线性去漂移方法
        result = comparator.compare_method(
            clean_signal=clean_signal,
            drifted_signal=drifted_signal,
            method=PreprocessMethod.LINEAR_DETREND
        )

        # 验证返回结果包含所有必需字段
        assert 'method' in result
        assert 'correlation' in result
        assert 'mse' in result
        assert 'band_power_error' in result
        assert 'snr_improvement' in result
        assert 'passed' in result

        # 线性去漂移应该有效恢复信号
        assert result['correlation'] > 0.9, "线性去漂移后相关性应 > 0.9"
        assert result['passed'] is True, "线性去漂移应该通过测试"

    def test_compare_multiple_methods(self):
        """测试多个预处理方法的对比"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        clean_signal = np.sin(2 * np.pi * 10 * t)
        drifted_signal = clean_signal + 20 * t

        comparator = PreprocessingComparator(sfreq)

        # 测试多个预处理方法
        methods = [
            PreprocessMethod.NONE,
            PreprocessMethod.LINEAR_DETREND,
            PreprocessMethod.POLYNOMIAL_DETREND,
            PreprocessMethod.HIGHPASS_FILTER,
        ]

        results = comparator.compare_methods(
            clean_signal=clean_signal,
            drifted_signal=drifted_signal,
            methods=methods
        )

        # 验证返回所有方法的结果
        assert len(results) == len(methods)
        assert all('method' in r for r in results)
        assert all('correlation' in r for r in results)

        # 线性去漂移应该比无处理效果好
        none_result = next(r for r in results if r['method'] == PreprocessMethod.NONE)
        linear_result = next(r for r in results if r['method'] == PreprocessMethod.LINEAR_DETREND)

        assert linear_result['correlation'] > none_result['correlation'], \
            "线性去漂移应该比无处理效果更好"

    def test_rank_methods_by_correlation(self):
        """测试按相关性排序方法"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        t = np.arange(0, 2.0, 1 / sfreq)

        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 20 * t

        comparator = PreprocessingComparator(sfreq)

        methods = [
            PreprocessMethod.NONE,
            PreprocessMethod.LINEAR_DETREND,
            PreprocessMethod.POLYNOMIAL_DETREND,
        ]

        results = comparator.compare_methods(clean, drifted, methods)
        ranked = comparator.rank_methods(results, metric='correlation')

        # 排序后第一个应该是最好的方法
        assert ranked[0]['correlation'] >= ranked[1]['correlation']
        assert ranked[1]['correlation'] >= ranked[2]['correlation']

        # 对于线性漂移，线性去漂移应该是最佳方法
        best_method = ranked[0]['method']
        assert best_method == PreprocessMethod.LINEAR_DETREND, \
            "线性漂移应该用线性去漂移效果最好"

    def test_generate_comparison_report(self):
        """测试生成对比报告"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        t = np.arange(0, 2.0, 1 / sfreq)

        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 20 * t

        comparator = PreprocessingComparator(sfreq)

        methods = [
            PreprocessMethod.NONE,
            PreprocessMethod.LINEAR_DETREND,
        ]

        results = comparator.compare_methods(clean, drifted, methods)

        # 生成报告
        with tempfile.TemporaryDirectory() as tmpdir:
            report_path = Path(tmpdir) / "comparison_report.json"
            comparator.generate_report(results, report_path)

            assert report_path.exists(), "报告文件应该被创建"

            # 验证报告内容
            import json
            with open(report_path, 'r') as f:
                report_data = json.load(f)

            assert 'timestamp' in report_data
            assert 'results' in report_data
            assert 'best_method' in report_data
            assert len(report_data['results']) == len(methods)

    def test_band_power_calculation(self):
        """测试频带功率计算准确性"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 干净的 10Hz Alpha波
        clean_signal = np.sin(2 * np.pi * 10 * t)

        comparator = PreprocessingComparator(sfreq)

        # 计算频带功率
        clean_bands = comparator.calculate_band_power(clean_signal)

        # 验证 Alpha 频带占主导
        assert 'alpha' in clean_bands
        assert 'delta' in clean_bands
        assert 'theta' in clean_bands
        assert 'beta' in clean_bands
        assert 'gamma' in clean_bands

        # 10Hz 信号应主要在 Alpha 频带
        alpha_ratio = clean_bands['alpha']['relative']
        assert alpha_ratio > 70, f"10Hz信号Alpha占比应>70%, 实际{alpha_ratio:.1f}%"

    def test_drift_recovery_validation(self):
        """测试漂移恢复效果验证"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        t = np.arange(0, 2.0, 1 / sfreq)

        # 测试案例：10Hz + 组合漂移
        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 10 * t + 20 * np.sin(2 * np.pi * 0.1 * t)

        comparator = PreprocessingComparator(sfreq)

        # 测试高通滤波（对组合漂移有效）
        result = comparator.compare_method(
            clean_signal=clean,
            drifted_signal=drifted,
            method=PreprocessMethod.HIGHPASS_FILTER,
            method_params={'cutoff': 0.5}
        )

        # 验证关键指标
        assert result['correlation'] > 0.8, "去漂移后相关性应 > 0.8"
        assert result['band_power_error'] < 30, "频带功率误差应 < 30%"

    def test_combined_drift_scenario(self):
        """测试组合漂移场景 (a*sin + b*x)"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 组合漂移: 10Hz + 50µV*sin + 20µV/s*t
        clean = np.sin(2 * np.pi * 10 * t)
        a, b, drift_freq = 50.0, 20.0, 0.1
        drifted = clean + a * np.sin(2 * np.pi * drift_freq * t) + b * t

        comparator = PreprocessingComparator(sfreq)

        # 对比所有方法
        methods = [
            PreprocessMethod.LINEAR_DETREND,
            PreprocessMethod.POLYNOMIAL_DETREND,
            PreprocessMethod.HIGHPASS_FILTER,
        ]

        results = comparator.compare_methods(clean, drifted, methods)

        # 至少有一个方法应该有效
        passed_results = [r for r in results if r['passed']]
        assert len(passed_results) > 0, "至少应有一个方法通过测试"

        # 找出最佳方法
        best = max(results, key=lambda x: x['correlation'])
        assert best['correlation'] > 0.85, "最佳方法相关性应 > 0.85"

    def test_snr_calculation(self):
        """测试 SNR 计算"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        signal = np.sin(2 * np.pi * 10 * np.arange(0, 2.0, 1 / sfreq))

        comparator = PreprocessingComparator(sfreq)

        # 干净信号应有高 SNR
        snr_clean = comparator.calculate_snr(signal)
        assert snr_clean > 20, "干净信号SNR应>20dB"

        # 添加噪声后 SNR 应降低
        noisy = signal + 0.5 * np.random.randn(len(signal))
        snr_noisy = comparator.calculate_snr(noisy)
        assert snr_noisy < snr_clean, "有噪声信号SNR应更低"


class TestPreprocessingIntegration:
    """测试预处理与分析服务的集成"""

    def test_preprocessing_before_band_power_analysis(self):
        """测试在频带分析前应用预处理"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 带漂移的 10Hz 信号
        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 30 * t

        comparator = PreprocessingComparator(sfreq)

        # 不使用预处理的频带功率
        bands_no_preprocess = comparator.calculate_band_power(drifted)
        alpha_no_preprocess = bands_no_preprocess['alpha']['relative']

        # 使用预处理的频带功率
        recovered = comparator.preprocessor.process(drifted, PreprocessMethod.LINEAR_DETREND)
        bands_with_preprocess = comparator.calculate_band_power(recovered)
        alpha_with_preprocess = bands_with_preprocess['alpha']['relative']

        # 预处理后 Alpha 识别率应提高
        assert alpha_with_preprocess > alpha_no_preprocess, \
            "预处理后Alpha识别率应提高"

    def test_validation_criteria(self):
        """测试验证标准"""
        from exp.utils.preprocessing_comparator import PreprocessingComparator

        sfreq = 500.0
        t = np.arange(0, 2.0, 1 / sfreq)

        clean = np.sin(2 * np.pi * 10 * t)
        drifted = clean + 10 * t

        comparator = PreprocessingComparator(sfreq)

        # 设置严格的验证标准
        criteria = {
            'min_correlation': 0.95,
            'max_band_error': 15.0,
            'min_snr_improvement': 5.0,
            'max_mse': 10.0,
        }

        result = comparator.compare_method(
            clean_signal=clean,
            drifted_signal=drifted,
            method=PreprocessMethod.LINEAR_DETREND,
            validation_criteria=criteria
        )

        # 验证结果应使用指定的标准
        if result['correlation'] >= criteria['min_correlation']:
            assert result['passed'], "满足所有标准时应通过"
        else:
            assert not result['passed'], "不满足标准时应失败"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
