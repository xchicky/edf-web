"""
Signals API Tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from pathlib import Path
import mne
import numpy as np
import json

client = TestClient(app)


@pytest.fixture
def sample_edf_file(tmp_path):
    """创建示例 EDF 文件用于测试"""
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


class TestSignalsAPI:
    """信号 API 测试"""

    def test_validate_expression_valid(self):
        """测试有效表达式验证"""
        response = client.post(
            "/api/signals/validate",
            json={
                "expression": "Fp1 - F3",
                "channel_names": ["Fp1", "Fp2", "F3", "F4"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isValid"] is True
        assert "Fp1" in data["referencedChannels"]
        assert "F3" in data["referencedChannels"]

    def test_validate_expression_invalid_channel(self):
        """测试无效通道验证"""
        response = client.post(
            "/api/signals/validate",
            json={
                "expression": "InvalidChannel - F3",
                "channel_names": ["Fp1", "Fp2", "F3", "F4"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isValid"] is False
        assert data["error"] is not None

    def test_validate_expression_empty(self):
        """测试空表达式验证"""
        response = client.post(
            "/api/signals/validate",
            json={
                "expression": "",
                "channel_names": ["Fp1", "Fp2", "F3", "F4"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isValid"] is False

    def test_validate_expression_unbalanced_parentheses(self):
        """测试不平衡括号验证"""
        response = client.post(
            "/api/signals/validate",
            json={
                "expression": "(Fp1 + F3",
                "channel_names": ["Fp1", "Fp2", "F3", "F4"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isValid"] is False

    def test_validate_expression_with_constants(self):
        """测试包含常数的表达式验证"""
        response = client.post(
            "/api/signals/validate",
            json={
                "expression": "(Fp1 + F3) / 2",
                "channel_names": ["Fp1", "Fp2", "F3", "F4"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isValid"] is True
        assert 2 in data["constants"]

    def test_validate_expression_complex(self):
        """测试复杂表达式验证"""
        response = client.post(
            "/api/signals/validate",
            json={
                "expression": "((Fp1 + Fp2) / 2) - ((F3 + F4) / 2)",
                "channel_names": ["Fp1", "Fp2", "F3", "F4"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["isValid"] is True
        assert len(data["referencedChannels"]) == 4

    def test_calculate_signals_success(self, sample_edf_file, monkeypatch):
        """测试信号计算成功"""
        # Mock get_file_path in signals.py
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.signals.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/signals/calculate",
            json={
                "file_id": "test-file",
                "signals": [
                    {
                        "id": "sig-1",
                        "expression": "Fp1 - F3",
                        "operands": [
                            {"id": "op-1", "channelName": "Fp1", "channelIndex": 0},
                            {"id": "op-2", "channelName": "F3", "channelIndex": 2},
                        ],
                    }
                ],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 1
        assert data["results"][0]["id"] == "sig-1"
        assert len(data["results"][0]["data"]) >= 500  # 5 秒 * 100 Hz
        assert data["results"][0]["sfreq"] == 100

    def test_calculate_signals_multiple(self, sample_edf_file, monkeypatch):
        """测试多个信号计算"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.signals.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/signals/calculate",
            json={
                "file_id": "test-file",
                "signals": [
                    {
                        "id": "sig-1",
                        "expression": "Fp1 - F3",
                        "operands": [
                            {"id": "op-1", "channelName": "Fp1", "channelIndex": 0},
                            {"id": "op-2", "channelName": "F3", "channelIndex": 2},
                        ],
                    },
                    {
                        "id": "sig-2",
                        "expression": "Fp2 - F4",
                        "operands": [
                            {"id": "op-3", "channelName": "Fp2", "channelIndex": 1},
                            {"id": "op-4", "channelName": "F4", "channelIndex": 3},
                        ],
                    },
                ],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 2
        assert data["results"][0]["id"] == "sig-1"
        assert data["results"][1]["id"] == "sig-2"

    def test_calculate_signals_file_not_found(self):
        """测试文件未找到"""
        response = client.post(
            "/api/signals/calculate",
            json={
                "file_id": "non-existent-file",
                "signals": [
                    {
                        "id": "sig-1",
                        "expression": "Fp1 - F3",
                        "operands": [
                            {"id": "op-1", "channelName": "Fp1", "channelIndex": 0},
                            {"id": "op-2", "channelName": "F3", "channelIndex": 2},
                        ],
                    }
                ],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 404

    def test_calculate_signals_invalid_channel_index(
        self, sample_edf_file, monkeypatch
    ):
        """测试无效的通道索引"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.signals.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/signals/calculate",
            json={
                "file_id": "test-file",
                "signals": [
                    {
                        "id": "sig-1",
                        "expression": "Fp1 - InvalidChannel",
                        "operands": [
                            {"id": "op-1", "channelName": "Fp1", "channelIndex": 0},
                            {"id": "op-2", "channelName": "InvalidChannel", "channelIndex": 10},
                        ],
                    }
                ],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 500

    def test_calculate_signals_with_average(self, sample_edf_file, monkeypatch):
        """测试平均表达式"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.signals.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/signals/calculate",
            json={
                "file_id": "test-file",
                "signals": [
                    {
                        "id": "sig-avg",
                        "expression": "(Fp1 + F3) / 2",
                        "operands": [
                            {"id": "op-1", "channelName": "Fp1", "channelIndex": 0},
                            {"id": "op-2", "channelName": "F3", "channelIndex": 2},
                        ],
                    }
                ],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["id"] == "sig-avg"
