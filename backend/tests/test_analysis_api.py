"""
Analysis API Tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from pathlib import Path
import mne
import numpy as np

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


class TestAnalysisAPI:
    """分析 API 测试"""

    def test_time_domain_success(self, sample_edf_file, monkeypatch):
        """测试时域分析成功"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": None,
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "test-file"
        assert len(data["channels"]) == 4
        assert "statistics" in data
        assert "Fp1" in data["statistics"]
        assert "mean" in data["statistics"]["Fp1"]
        assert "std" in data["statistics"]["Fp1"]
        assert "min" in data["statistics"]["Fp1"]
        assert "max" in data["statistics"]["Fp1"]
        assert "rms" in data["statistics"]["Fp1"]
        assert "peak_to_peak" in data["statistics"]["Fp1"]
        assert "kurtosis" in data["statistics"]["Fp1"]
        assert "skewness" in data["statistics"]["Fp1"]
        # MNE crop 包含边界点，所以是 duration * sfreq + 1
        assert data["statistics"]["Fp1"]["n_samples"] >= 500
        assert data["statistics"]["Fp1"]["n_samples"] <= 501

    def test_time_domain_specific_channels(self, sample_edf_file, monkeypatch):
        """测试时域分析指定通道"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1", "F3"],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["channels"]) == 2
        assert "Fp1" in data["statistics"]
        assert "F3" in data["statistics"]
        assert "Fp2" not in data["statistics"]

    def test_time_domain_file_not_found(self):
        """测试时域分析文件未找到"""
        def mock_get_file_path(file_id):
            raise FileNotFoundError("File not found")

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/non-existent-file",
            json={
                "channels": None,
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 404
        monkeypatch.undo()

    def test_time_domain_invalid_channel(self, sample_edf_file, monkeypatch):
        """测试时域分析无效通道"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["InvalidChannel"],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 500

    def test_band_power_success(self, sample_edf_file, monkeypatch):
        """测试频带功率分析成功"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/band_power/test-file",
            json={
                "channels": None,
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "test-file"
        assert len(data["channels"]) == 4
        assert "band_powers" in data

        # 检查每个通道的频带
        for ch in data["channels"]:
            assert ch in data["band_powers"]
            band_data = data["band_powers"][ch]
            assert "delta" in band_data
            assert "theta" in band_data
            assert "alpha" in band_data
            assert "beta" in band_data
            assert "gamma" in band_data

            # 检查频带数据结构
            for band_name in ["delta", "theta", "alpha", "beta", "gamma"]:
                assert "absolute" in band_data[band_name]
                assert "relative" in band_data[band_name]
                assert "range" in band_data[band_name]

                # 验证数据类型
                assert isinstance(band_data[band_name]["absolute"], (int, float))
                assert isinstance(band_data[band_name]["relative"], (int, float))
                assert isinstance(band_data[band_name]["range"], list)
                assert len(band_data[band_name]["range"]) == 2

    def test_band_power_custom_bands(self, sample_edf_file, monkeypatch):
        """测试频带功率分析自定义频带"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/band_power/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "bands": {
                    "low": [1, 10],
                    "high": [10, 30],
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["band_powers"]
        assert "low" in data["band_powers"]["Fp1"]
        assert "high" in data["band_powers"]["Fp1"]
        assert data["band_powers"]["Fp1"]["low"]["range"] == [1, 10]
        assert data["band_powers"]["Fp1"]["high"]["range"] == [10, 30]

    def test_psd_success(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析成功"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": None,
                "start": 0,
                "duration": 5,
                "fmin": 0.5,
                "fmax": 50,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "test-file"
        assert len(data["channels"]) == 4
        assert "psd_data" in data

        # 检查 PSD 数据结构
        for ch in data["channels"]:
            assert ch in data["psd_data"]
            psd_info = data["psd_data"][ch]
            assert "frequencies" in psd_info
            assert "psd" in psd_info
            assert "sfreq" in psd_info

            # 验证数据长度一致
            assert len(psd_info["frequencies"]) == len(psd_info["psd"])

            # 验证频率范围
            assert psd_info["frequencies"][0] >= 0.5
            assert psd_info["frequencies"][-1] <= 50

    def test_psd_custom_frequency_range(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析自定义频率范围"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 1,
                "fmax": 30,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["psd_data"]
        freqs = data["psd_data"]["Fp1"]["frequencies"]
        assert freqs[0] >= 1
        assert freqs[-1] <= 30

    def test_comprehensive_success(self, sample_edf_file, monkeypatch):
        """测试综合分析成功"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/comprehensive/test-file",
            json={
                "channels": None,
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "test-file"
        assert len(data["channels"]) == 4

        # 检查时域统计
        assert "time_domain" in data
        assert "Fp1" in data["time_domain"]
        assert "mean" in data["time_domain"]["Fp1"]

        # 检查频带功率
        assert "band_power" in data
        assert "Fp1" in data["band_power"]
        assert "alpha" in data["band_power"]["Fp1"]

        # 检查 PSD
        assert "psd" in data
        assert "Fp1" in data["psd"]
        assert "frequencies" in data["psd"]["Fp1"]

    def test_comprehensive_specific_channels(self, sample_edf_file, monkeypatch):
        """测试综合分析指定通道"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/comprehensive/test-file",
            json={
                "channels": ["Fp1", "F3"],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["channels"]) == 2
        assert "Fp1" in data["time_domain"]
        assert "F3" in data["time_domain"]
        assert "Fp2" not in data["time_domain"]

    def test_comprehensive_with_custom_params(self, sample_edf_file, monkeypatch):
        """测试综合分析自定义参数"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/comprehensive/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 1,
                "fmax": 30,
                "bands": {
                    "low": [1, 10],
                    "high": [10, 30],
                },
            },
        )

        assert response.status_code == 200
        data = response.json()

        # 检查 PSD 频率范围
        freqs = data["psd"]["Fp1"]["frequencies"]
        assert freqs[0] >= 1
        assert freqs[-1] <= 30

        # 检查自定义频带
        assert "low" in data["band_power"]["Fp1"]
        assert "high" in data["band_power"]["Fp1"]
        assert data["band_power"]["Fp1"]["low"]["range"] == [1, 10]
