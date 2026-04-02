"""
Analysis Service Preprocessing Integration Tests (TDD Phase 2)

测试分析服务与预处理模块的集成。

TDD 流程:
1. RED: 先写测试，验证带预处理的频带分析
2. GREEN: 修改 AnalysisService 支持预处理
3. REFACTOR: 保持向后兼容
4. COVERAGE: 确保无回归
"""

import pytest
import numpy as np
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.analysis_service import AnalysisService
from app.services.preprocessing import PreprocessMethod


class TestAnalysisServicePreprocessingIntegration:
    """测试分析服务与预处理的集成"""

    @pytest.fixture
    def temp_edf_file(self):
        """创建临时 EDF 文件"""
        import mne
        import tempfile

        # 创建简单的测试信号
        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 创建带漂移的信号（使用 µV 单位）
        # 注意：EDF 格式限制，使用较小的漂移幅度
        ch1 = np.sin(2 * np.pi * 10 * t) + 2 * t  # 10Hz + 轻微线性漂移
        ch2 = np.sin(2 * np.pi * 20 * t) + 1 * t  # 20Hz + 轻微线性漂移

        # 创建 MNE Raw 对象
        info = mne.create_info(
            ch_names=['Fp1', 'Fp2'],
            sfreq=sfreq,
            ch_types=['eeg', 'eeg']
        )
        raw = mne.io.RawArray(np.array([ch1, ch2]) * 1e6, info, verbose=False)

        # 保存到临时 EDF 文件
        with tempfile.NamedTemporaryFile(suffix='.edf', delete=False) as f:
            temp_path = f.name

        raw.export(str(temp_path), fmt="edf", physical_range=(-1e6, 1e6), overwrite=True, verbose=False)

        yield temp_path

        # 清理
        Path(temp_path).unlink(missing_ok=True)

    def test_band_power_with_preprocessing_none(self, temp_edf_file):
        """测试带预处理（无处理）的频带功率计算"""
        service = AnalysisService(temp_edf_file)

        # 使用 NONE 预处理（默认行为）
        result = service.compute_band_power(
            start_time=0.0,
            duration=1.9,  # Slightly less than 2.0 to account for rounding
            channels=['Fp1', 'Fp2'],
            preprocess_method=PreprocessMethod.NONE
        )

        assert 'Fp1' in result
        assert 'Fp2' in result

        # 无处理时，结果应与不带参数调用相同
        result_default = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1', 'Fp2']
        )

        # 频带功率应该相同（或非常接近）
        for ch in ['Fp1', 'Fp2']:
            for band in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
                rel1 = result[ch][band]['relative']
                rel2 = result_default[ch][band]['relative']
                assert abs(rel1 - rel2) < 0.01, \
                    f"NONE预处理应与默认行为相同，{ch} {band} 差异 {abs(rel1 - rel2)}"

    def test_band_power_with_linear_detrend(self, temp_edf_file):
        """测试带线性去漂移的频带功率计算"""
        service = AnalysisService(temp_edf_file)

        # 使用线性去漂移
        result = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.LINEAR_DETREND
        )

        assert 'Fp1' in result
        assert 'alpha' in result['Fp1']

        # 线性去漂移后，10Hz 信号应主要在 Alpha 频带
        alpha_ratio = result['Fp1']['alpha']['relative']
        assert alpha_ratio > 0.40, \
            f"线性去漂移后 10Hz 信号 Alpha 应>40%, 实际 {alpha_ratio*100:.1f}%"

    def test_band_power_with_highpass_filter(self, temp_edf_file):
        """测试带高通滤波的频带功率计算"""
        service = AnalysisService(temp_edf_file)

        # 使用高通滤波
        result = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.HIGHPASS_FILTER,
            preprocess_params={'cutoff': 0.5}
        )

        assert 'Fp1' in result
        assert 'alpha' in result['Fp1']

        # 高通滤波后，10Hz 信号应主要在 Alpha 频带
        alpha_ratio = result['Fp1']['alpha']['relative']
        assert alpha_ratio > 0.40, \
            f"高通滤波后 10Hz 信号 Alpha 应>40%, 实际 {alpha_ratio*100:.1f}%"

    def test_band_power_preprocessing_comparison(self, temp_edf_file):
        """测试对比不同预处理方法的效果"""
        service = AnalysisService(temp_edf_file)

        # 不使用预处理
        result_none = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.NONE
        )

        # 使用线性去漂移
        result_linear = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.LINEAR_DETREND
        )

        # 验证两种方法都产生了有效结果
        alpha_none = result_none['Fp1']['alpha']['relative']
        alpha_linear = result_linear['Fp1']['alpha']['relative']

        # 两种方法都应该能识别 Alpha 波（虽然可能有差异）
        assert alpha_none > 0.3, \
            f"无预处理应能识别 Alpha 波 (实际: {alpha_none*100:.1f}%)"
        assert alpha_linear > 0.3, \
            f"线性去漂移应能识别 Alpha 波 (实际: {alpha_linear*100:.1f}%)"

    def test_psd_with_preprocessing(self, temp_edf_file):
        """测试带预处理的 PSD 计算"""
        service = AnalysisService(temp_edf_file)

        # 使用线性去漂移
        result = service.compute_psd(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.LINEAR_DETREND
        )

        assert 'Fp1' in result
        assert 'frequencies' in result['Fp1']
        assert 'psd' in result['Fp1']

        # 验证频率范围
        freqs = result['Fp1']['frequencies']
        assert freqs[0] >= 0.5, "最小频率应 >= 0.5Hz"
        assert freqs[-1] <= 50, "最大频率应 <= 50Hz"

    def test_time_domain_with_preprocessing(self, temp_edf_file):
        """测试带预处理的时域统计"""
        service = AnalysisService(temp_edf_file)

        # 使用线性去漂移
        result = service.compute_time_domain_stats(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.LINEAR_DETREND
        )

        assert 'Fp1' in result
        assert 'mean' in result['Fp1']
        assert 'std' in result['Fp1']
        assert 'min' in result['Fp1']
        assert 'max' in result['Fp1']

        # 去漂移后均值应接近 0
        mean = result['Fp1']['mean']
        assert abs(mean) < 5.0, f"去漂移后均值应接近 0, 实际 {mean:.2f}"

    def test_backward_compatibility(self, temp_edf_file):
        """测试向后兼容性：不带预处理参数的调用应正常工作"""
        service = AnalysisService(temp_edf_file)

        # 不带预处理参数调用（向后兼容）
        result = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1']
        )

        assert 'Fp1' in result
        assert 'alpha' in result['Fp1']

    def test_invalid_preprocess_method_raises_error(self, temp_edf_file):
        """测试无效的预处理方法应抛出错误"""
        service = AnalysisService(temp_edf_file)

        with pytest.raises(ValueError, match="未知的预处理方法"):
            service.compute_band_power(
                start_time=0.0,
                duration=1.9,
                channels=['Fp1'],
                preprocess_method="invalid_method"
            )

    def test_preprocess_method_polynomial(self, temp_edf_file):
        """测试多项式去漂移"""
        service = AnalysisService(temp_edf_file)

        # 使用多项式去漂移
        result = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['Fp1'],
            preprocess_method=PreprocessMethod.POLYNOMIAL_DETREND,
            preprocess_params={'order': 2}
        )

        assert 'Fp1' in result
        # 多项式去漂移也应改善 Alpha 识别
        alpha_ratio = result['Fp1']['alpha']['relative']
        assert alpha_ratio > 0.40, \
            f"多项式去漂移后 Alpha 应>40%, 实际 {alpha_ratio*100:.1f}%"

    def test_combined_drift_recovery(self, temp_edf_file):
        """测试组合漂移的恢复效果"""
        # 这个测试需要创建带组合漂移的 EDF 文件
        import mne

        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 组合漂移: 10Hz + 5*sin(0.1*2π*t) + 2*t（使用较小的幅度）
        a, b, drift_freq = 5.0, 2.0, 0.1
        signal = np.sin(2 * np.pi * 10 * t) + \
                 a * np.sin(2 * np.pi * drift_freq * t) + \
                 b * t

        info = mne.create_info(
            ch_names=['Fz'],
            sfreq=sfreq,
            ch_types=['eeg']
        )
        raw = mne.io.RawArray(np.array([signal]) * 1e6, info, verbose=False)

        with tempfile.NamedTemporaryFile(suffix='.edf', delete=False) as f:
            temp_path = f.name

        raw.export(str(temp_path), fmt="edf", physical_range=(-1e6, 1e6), overwrite=True, verbose=False)

        try:
            service = AnalysisService(temp_path)

            # 使用高通滤波（对组合漂移有效）
            result = service.compute_band_power(
                start_time=0.0,
                duration=1.9,
                channels=['Fz'],
                preprocess_method=PreprocessMethod.HIGHPASS_FILTER,
                preprocess_params={'cutoff': 0.5}
            )

            # 高通滤波应能识别 Alpha 波（即使有组合漂移）
            alpha_ratio = result['Fz']['alpha']['relative']
            assert alpha_ratio > 0.10, \
                f"高通滤波后应能识别 Alpha 波 (实际: {alpha_ratio*100:.1f}%)"

        finally:
            Path(temp_path).unlink(missing_ok=True)


class TestPreprocessingEffectiveness:
    """测试预处理的有效性"""

    @pytest.fixture
    def clean_edf_file(self):
        """创建干净的 EDF 文件（无漂移）"""
        import mne
        import tempfile

        sfreq = 500
        duration = 2.0
        t = np.arange(0, duration, 1 / sfreq)

        # 干净的 10Hz 信号
        signal = np.sin(2 * np.pi * 10 * t)

        info = mne.create_info(
            ch_names=['O1'],
            sfreq=sfreq,
            ch_types=['eeg']
        )
        raw = mne.io.RawArray(np.array([signal]) * 1e6, info, verbose=False)

        with tempfile.NamedTemporaryFile(suffix='.edf', delete=False) as f:
            temp_path = f.name

        raw.export(str(temp_path), fmt="edf", physical_range=(-1e6, 1e6), overwrite=True, verbose=False)

        yield temp_path

        Path(temp_path).unlink(missing_ok=True)

    def test_no_preprocessing_needed_for_clean_signal(self, clean_edf_file):
        """测试干净信号不需要预处理"""
        service = AnalysisService(clean_edf_file)

        # 干净信号，无预处理
        result_none = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['O1'],
            preprocess_method=PreprocessMethod.NONE
        )

        # 干净信号，线性去漂移
        result_linear = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['O1'],
            preprocess_method=PreprocessMethod.LINEAR_DETREND
        )

        # 干净信号上，预处理不应显著改变结果
        alpha_none = result_none['O1']['alpha']['relative']
        alpha_linear = result_linear['O1']['alpha']['relative']

        # 两者应该接近（差异 < 20%）
        assert abs(alpha_none - alpha_linear) < 0.20, \
            f"干净信号上预处理不应显著改变结果 (差异: {abs(alpha_none - alpha_linear)*100:.1f}%)"

    def test_clean_signal_alpha_recognition(self, clean_edf_file):
        """测试干净信号的 Alpha 识别准确度"""
        service = AnalysisService(clean_edf_file)

        result = service.compute_band_power(
            start_time=0.0,
            duration=1.9,
            channels=['O1']
        )

        # 干净的 10Hz 信号应 >90% 在 Alpha 频带
        alpha_ratio = result['O1']['alpha']['relative']
        assert alpha_ratio > 0.85, \
            f"干净的 10Hz 信号 Alpha 应>85%, 实际 {alpha_ratio*100:.1f}%"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
