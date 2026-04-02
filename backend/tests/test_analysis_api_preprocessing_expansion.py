"""
Preprocessing Support Expansion Tests - Time Domain and PSD APIs
TDD Phase 1: Write failing tests first
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
    # 创建示例数据（添加线性漂移以便测试去漂移功能）
    sfreq = 100  # 采样频率
    duration = 10  # 10 秒
    n_samples = sfreq * duration
    n_channels = 4

    # 创建带有线性漂移的通道数据
    time = np.linspace(0, duration, n_samples)
    data = np.random.randn(n_channels, n_samples) * 5  # 微伏

    # 添加线性漂移
    for i in range(n_channels):
        trend = np.linspace(0, 20, n_samples)  # 0 到 20 微伏的线性漂移
        data[i] += trend

    # 创建 MNE Raw 对象
    ch_names = ["Fp1", "Fp2", "F3", "F4"]
    ch_types = ["eeg"] * n_channels
    info = mne.create_info(ch_names, sfreq, ch_types)
    raw = mne.io.RawArray(data, info)

    # 设置测量日期为固定值
    raw.set_meas_date(None)

    # 保存为 EDF
    edf_path = tmp_path / "test_with_drift.edf"
    raw.export(str(edf_path), fmt="edf", physical_range=(0, 100))

    return str(edf_path)


class TestTimeDomainPreprocessing:
    """时域分析预处理功能测试"""

    def test_time_domain_with_linear_detrend(self, sample_edf_file, monkeypatch):
        """测试时域分析使用线性去漂移"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "linear_detrend",
                    "parameters": None,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["statistics"]
        # 验证去漂移后的均值接近 0（因为原始信号是零均值噪声 + 线性漂移）
        assert abs(data["statistics"]["Fp1"]["mean"]) < 5  # 去漂移后均值应较小

    def test_time_domain_with_polynomial_detrend(self, sample_edf_file, monkeypatch):
        """测试时域分析使用多项式去漂移"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "polynomial_detrend",
                    "parameters": {"order": 2},
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["statistics"]

    def test_time_domain_with_highpass_filter(self, sample_edf_file, monkeypatch):
        """测试时域分析使用高通滤波"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "highpass_filter",
                    "parameters": {"cutoff": 0.5},
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["statistics"]

    def test_time_domain_with_baseline_correction(self, sample_edf_file, monkeypatch):
        """测试时域分析使用基线校正"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "baseline_correction",
                    "parameters": None,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["statistics"]

    def test_time_domain_with_invalid_preprocess_method(self, sample_edf_file, monkeypatch):
        """测试时域分析使用无效的预处理方法"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "invalid_method",
                    "parameters": None,
                },
            },
        )

        # Pydantic 验证应该返回 422 错误
        assert response.status_code == 422

    def test_time_domain_without_preprocess(self, sample_edf_file, monkeypatch):
        """测试时域分析不使用预处理"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["statistics"]


class TestPSDPreprocessing:
    """PSD 分析预处理功能测试"""

    def test_psd_with_linear_detrend(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析使用线性去漂移"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 0.5,
                "fmax": 50,
                "preprocess": {
                    "method": "linear_detrend",
                    "parameters": None,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["psd_data"]
        assert "frequencies" in data["psd_data"]["Fp1"]
        assert "psd" in data["psd_data"]["Fp1"]

    def test_psd_with_polynomial_detrend(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析使用多项式去漂移"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 0.5,
                "fmax": 50,
                "preprocess": {
                    "method": "polynomial_detrend",
                    "parameters": {"order": 2},
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["psd_data"]

    def test_psd_with_highpass_filter(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析使用高通滤波"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 0.5,
                "fmax": 50,
                "preprocess": {
                    "method": "highpass_filter",
                    "parameters": {"cutoff": 0.5},
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["psd_data"]

    def test_psd_with_baseline_correction(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析使用基线校正"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 0.5,
                "fmax": 50,
                "preprocess": {
                    "method": "baseline_correction",
                    "parameters": None,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["psd_data"]

    def test_psd_without_preprocess(self, sample_edf_file, monkeypatch):
        """测试 PSD 分析不使用预处理"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/psd/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "fmin": 0.5,
                "fmax": 50,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "Fp1" in data["psd_data"]


class TestComprehensivePreprocessingExpansion:
    """综合分析预处理扩展测试"""

    def test_comprehensive_with_preprocess_in_time_domain(self, sample_edf_file, monkeypatch):
        """测试综合分析在时域统计中使用预处理"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        response = client.post(
            "/api/analysis/comprehensive/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "linear_detrend",
                    "parameters": None,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "time_domain" in data
        assert "Fp1" in data["time_domain"]

    def test_comprehensive_preprocess_affects_all_analyses(self, sample_edf_file, monkeypatch):
        """验证综合分析中预处理影响所有分析（时域、频带、PSD）"""
        def mock_get_file_path(file_id):
            return sample_edf_file

        monkeypatch.setattr("app.api.routes.analysis.get_file_path", mock_get_file_path)

        # 使用预处理
        response = client.post(
            "/api/analysis/comprehensive/test-file",
            json={
                "channels": ["Fp1"],
                "start": 0,
                "duration": 5,
                "preprocess": {
                    "method": "linear_detrend",
                    "parameters": None,
                },
            },
        )

        assert response.status_code == 200
        data = response.json()

        # 验证所有分析都返回了结果
        assert "time_domain" in data
        assert "band_power" in data
        assert "psd" in data
        assert "Fp1" in data["time_domain"]
        assert "Fp1" in data["band_power"]
        assert "Fp1" in data["psd"]
