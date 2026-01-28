"""
Signal Calculator Service Tests
"""

import pytest
import numpy as np
from pathlib import Path
from app.services.signal_calculator import SignalCalculator


@pytest.fixture
def sample_edf_file(tmp_path):
    """创建示例 EDF 文件用于测试"""
    import mne

    # 创建示例数据
    sfreq = 100  # 采样频率
    duration = 10  # 10 秒
    n_samples = sfreq * duration
    n_channels = 4

    # 创建通道数据（使用较小的值以避免 EDF 导出问题）
    data = np.random.randn(n_channels, n_samples) * 5  # 微伏

    # 创建 MNE Raw 对象
    ch_names = ["Fp1", "Fp2", "F3", "F4"]
    ch_types = ["eeg"] * n_channels
    info = mne.create_info(ch_names, sfreq, ch_types)
    raw = mne.io.RawArray(data, info)

    # 设置测量日期为固定值以避免时间戳问题
    raw.set_meas_date(None)

    # 保存为 EDF
    edf_path = tmp_path / "test.edf"
    raw.export(str(edf_path), fmt="edf", physical_range=(0, 100))

    return str(edf_path)


class TestSignalCalculator:
    """信号计算器测试"""

    def test_initialization(self, sample_edf_file):
        """测试初始化"""
        calculator = SignalCalculator(sample_edf_file)
        assert calculator.raw is not None
        assert len(calculator.raw.ch_names) == 4

    def test_validate_operands_valid(self, sample_edf_file):
        """测试有效的操作数验证"""
        calculator = SignalCalculator(sample_edf_file)

        operands = [
            {"channelIndex": 0, "channelName": "Fp1"},
            {"channelIndex": 2, "channelName": "F3"},
        ]

        # 应该不抛出异常
        calculator._validate_operands(operands)

    def test_validate_operands_invalid_index(self, sample_edf_file):
        """测试无效的通道索引"""
        calculator = SignalCalculator(sample_edf_file)

        operands = [{"channelIndex": 10, "channelName": "Invalid"}]

        with pytest.raises(ValueError):
            calculator._validate_operands(operands)

    def test_validate_operands_name_mismatch(self, sample_edf_file):
        """测试通道名称不匹配"""
        calculator = SignalCalculator(sample_edf_file)

        operands = [{"channelIndex": 0, "channelName": "WrongName"}]

        with pytest.raises(ValueError):
            calculator._validate_operands(operands)

    def test_load_channel_data(self, sample_edf_file):
        """测试加载通道数据"""
        calculator = SignalCalculator(sample_edf_file)

        operands = [
            {"channelIndex": 0, "channelName": "Fp1"},
            {"channelIndex": 2, "channelName": "F3"},
        ]

        channel_data = calculator._load_channel_data(operands, 0, 5)

        assert "Fp1" in channel_data
        assert "F3" in channel_data
        # 由于 crop 的行为，样本数可能是 500 或 501
        assert len(channel_data["Fp1"]) >= 500
        assert len(channel_data["F3"]) >= 500

    def test_preprocess_expression(self, sample_edf_file):
        """测试表达式预处理"""
        calculator = SignalCalculator(sample_edf_file)

        operands = [
            {"channelIndex": 0, "channelName": "Fp1"},
            {"channelIndex": 2, "channelName": "F3"},
        ]

        expression = "Fp1 - F3"
        processed = calculator._preprocess_expression(expression, operands)

        assert "channels['Fp1']" in processed
        assert "channels['F3']" in processed
        assert "-" in processed

    def test_safe_eval_expression(self, sample_edf_file):
        """测试安全表达式求值"""
        calculator = SignalCalculator(sample_edf_file)

        # 创建测试数据
        channel_data = {
            "Fp1": np.array([1.0, 2.0, 3.0, 4.0, 5.0]),
            "F3": np.array([1.0, 1.0, 1.0, 1.0, 1.0]),
        }

        expression = "channels['Fp1'] - channels['F3']"
        result = calculator._safe_eval_expression(expression, channel_data)

        expected = np.array([0.0, 1.0, 2.0, 3.0, 4.0])
        np.testing.assert_array_almost_equal(result, expected)

    def test_safe_eval_expression_with_constant(self, sample_edf_file):
        """测试包含常数的表达式求值"""
        calculator = SignalCalculator(sample_edf_file)

        channel_data = {
            "Fp1": np.array([1.0, 2.0, 3.0, 4.0, 5.0]),
        }

        expression = "channels['Fp1'] * 2"
        result = calculator._safe_eval_expression(expression, channel_data)

        expected = np.array([2.0, 4.0, 6.0, 8.0, 10.0])
        np.testing.assert_array_almost_equal(result, expected)

    def test_calculate_single_signal(self, sample_edf_file):
        """测试单个信号计算"""
        calculator = SignalCalculator(sample_edf_file)

        signal_def = {
            "id": "sig-1",
            "name": "Fp1-F3",
            "expression": "Fp1 - F3",
            "operands": [
                {"channelIndex": 0, "channelName": "Fp1"},
                {"channelIndex": 2, "channelName": "F3"},
            ],
        }

        result = calculator._calculate_single_signal(signal_def, 0, 5)

        assert result["id"] == "sig-1"
        assert result["name"] == "Fp1-F3"
        # 由于 crop 的行为，样本数可能是 500 或 501
        assert len(result["data"]) >= 500
        assert len(result["times"]) >= 500
        assert result["sfreq"] == 100
        assert result["n_samples"] >= 500

    def test_calculate_signals(self, sample_edf_file):
        """测试多个信号计算"""
        calculator = SignalCalculator(sample_edf_file)

        signals = [
            {
                "id": "sig-1",
                "name": "Fp1-F3",
                "expression": "Fp1 - F3",
                "operands": [
                    {"channelIndex": 0, "channelName": "Fp1"},
                    {"channelIndex": 2, "channelName": "F3"},
                ],
            },
            {
                "id": "sig-2",
                "name": "Fp2-F4",
                "expression": "Fp2 - F4",
                "operands": [
                    {"channelIndex": 1, "channelName": "Fp2"},
                    {"channelIndex": 3, "channelName": "F4"},
                ],
            },
        ]

        results = calculator.calculate_signals(signals, 0, 5)

        assert len(results) == 2
        assert results[0]["id"] == "sig-1"
        assert results[1]["id"] == "sig-2"

    def test_calculate_signals_with_average(self, sample_edf_file):
        """测试平均表达式"""
        calculator = SignalCalculator(sample_edf_file)

        signals = [
            {
                "id": "sig-avg",
                "name": "Average",
                "expression": "(Fp1 + F3) / 2",
                "operands": [
                    {"channelIndex": 0, "channelName": "Fp1"},
                    {"channelIndex": 2, "channelName": "F3"},
                ],
            },
        ]

        results = calculator.calculate_signals(signals, 0, 5)

        assert len(results) == 1
        assert results[0]["id"] == "sig-avg"
        # 由于 crop 的行为，样本数可能是 500 或 501
        assert len(results[0]["data"]) >= 500

    def test_calculate_signals_invalid_expression(self, sample_edf_file):
        """测试无效表达式"""
        calculator = SignalCalculator(sample_edf_file)

        signals = [
            {
                "id": "sig-invalid",
                "name": "Invalid",
                "expression": "Fp1 + InvalidChannel",  # 使用不存在的通道
                "operands": [
                    {"channelIndex": 0, "channelName": "Fp1"},
                    {"channelIndex": 2, "channelName": "InvalidChannel"},
                ],
            },
        ]

        with pytest.raises(ValueError):
            calculator.calculate_signals(signals, 0, 5)
