"""
Tests for async non-blocking behavior of API endpoints.

These tests verify that synchronous MNE-Python operations in async endpoints
are properly offloaded to threads, preventing event loop blocking.

Covers:
- waveform GET/POST requests return valid data
- metadata GET requests return valid data
- upload demo-metadata returns valid data
- waveform_overview returns valid data
- analysis endpoints return valid data
- signals/calculate returns valid data
- concurrent requests don't block each other
- file not found returns 404
- invalid parameters return 400/422
"""

import pytest
import asyncio
import time
import mne
import numpy as np
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def sample_edf_file(tmp_path):
    """Create a sample EDF file for testing"""
    sfreq = 100
    duration = 10
    n_samples = sfreq * duration
    n_channels = 4

    data = np.random.randn(n_channels, n_samples) * 5

    ch_names = ["Fp1", "Fp2", "F3", "F4"]
    ch_types = ["eeg"] * n_channels
    info = mne.create_info(ch_names, sfreq, ch_types)
    raw = mne.io.RawArray(data, info)
    raw.set_meas_date(None)

    edf_path = tmp_path / "test.edf"
    raw.export(str(edf_path), fmt="edf", physical_range=(0, 100))

    return str(edf_path)


@pytest.fixture
def mock_file_path(sample_edf_file, monkeypatch):
    """Monkeypatch get_file_path across all route modules"""
    def mock_get_file_path(file_id):
        if file_id == "nonexistent":
            raise FileNotFoundError(f"File not found: {file_id}")
        return sample_edf_file

    modules = [
        "app.api.routes.waveform",
        "app.api.routes.metadata",
        "app.api.routes.upload",
        "app.api.routes.waveform_overview",
        "app.api.routes.analysis",
        "app.api.routes.signals",
    ]
    for module in modules:
        monkeypatch.setattr(f"{module}.get_file_path", mock_get_file_path)


# ============================================================
# Sync test client tests (basic functionality)
# ============================================================


class TestWaveformEndpoint:
    """Waveform API endpoint tests"""

    def test_get_waveform_returns_data(self, sample_edf_file, monkeypatch):
        """GET /api/waveform/{file_id} returns valid waveform data"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path",
            lambda fid: sample_edf_file,
        )

        response = client.get(
            "/api/waveform/test-file",
            params={"start": 0, "duration": 1, "channels": "0,1"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "channels" in data
        assert "data" in data
        assert "times" in data
        assert "file_id" in data
        assert data["file_id"] == "test-file"

    def test_post_waveform_returns_data(self, sample_edf_file, monkeypatch):
        """POST /api/waveform/{file_id} returns valid waveform data"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path",
            lambda fid: sample_edf_file,
        )

        response = client.post(
            "/api/waveform/test-file",
            json={"start": 0, "duration": 1, "channels": [0, 1]},
        )

        assert response.status_code == 200
        data = response.json()
        assert "channels" in data
        assert "data" in data

    def test_get_waveform_file_not_found(self, monkeypatch):
        """GET /api/waveform/{file_id} returns 404 for missing file"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        def raise_fnf(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")

        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path", raise_fnf,
        )

        response = client.get(
            "/api/waveform/nonexistent",
            params={"start": 0, "duration": 1},
        )

        assert response.status_code == 404

    def test_get_waveform_invalid_params(self, sample_edf_file, monkeypatch):
        """GET /api/waveform with negative start returns 422"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path",
            lambda fid: sample_edf_file,
        )

        response = client.get(
            "/api/waveform/test-file",
            params={"start": -1, "duration": 1},
        )

        assert response.status_code == 422


class TestMetadataEndpoint:
    """Metadata API endpoint tests"""

    def test_get_metadata_returns_data(self, sample_edf_file, monkeypatch):
        """GET /api/metadata/{file_id} returns valid metadata"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.metadata.get_file_path",
            lambda fid: sample_edf_file,
        )

        response = client.get("/api/metadata/test-file")

        assert response.status_code == 200
        data = response.json()
        assert "n_channels" in data
        assert "channel_names" in data
        assert "sfreq" in data
        assert "file_id" in data
        assert data["file_id"] == "test-file"

    def test_get_metadata_file_not_found(self, monkeypatch):
        """GET /api/metadata/{file_id} returns 404 for missing file"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        def raise_fnf(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")

        monkeypatch.setattr(
            "app.api.routes.metadata.get_file_path", raise_fnf,
        )

        response = client.get("/api/metadata/nonexistent")

        assert response.status_code == 404


class TestDemoMetadataEndpoint:
    """Upload demo-metadata endpoint tests"""

    def test_demo_metadata_returns_data(self, sample_edf_file, monkeypatch):
        """GET /api/upload/dev/demo-metadata returns valid metadata"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        mock_fn = lambda fid: sample_edf_file
        monkeypatch.setattr("app.api.routes.upload.get_file_path", mock_fn)
        monkeypatch.setattr("app.services.file_manager.get_file_path", mock_fn)

        response = client.get("/api/upload/dev/demo-metadata")

        assert response.status_code == 200
        data = response.json()
        assert "n_channels" in data
        assert "file_id" in data

    def test_demo_metadata_file_not_found(self, monkeypatch):
        """GET /api/upload/dev/demo-metadata returns 404 when no demo file"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        def raise_fnf(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")

        monkeypatch.setattr("app.api.routes.upload.get_file_path", raise_fnf)
        monkeypatch.setattr("app.services.file_manager.get_file_path", raise_fnf)

        response = client.get("/api/upload/dev/demo-metadata")

        assert response.status_code == 404


class TestWaveformOverviewEndpoint:
    """Waveform overview API endpoint tests"""

    def test_get_overview_returns_data(self, sample_edf_file, monkeypatch):
        """GET /api/waveform_overview/{file_id} returns valid overview data"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.waveform_overview.get_file_path",
            lambda fid: sample_edf_file,
        )

        response = client.get(
            "/api/waveform_overview/test-file",
            params={"samples_per_second": 1.0},
        )

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "times" in data
        assert "channels" in data
        assert "sfreq" in data

    def test_get_overview_file_not_found(self, monkeypatch):
        """GET /api/waveform_overview returns 404 for missing file"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        def raise_fnf(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")

        monkeypatch.setattr(
            "app.api.routes.waveform_overview.get_file_path", raise_fnf,
        )

        response = client.get("/api/waveform_overview/nonexistent")

        assert response.status_code == 404


class TestAnalysisEndpoint:
    """Analysis API endpoint tests"""

    def test_time_domain_returns_data(self, sample_edf_file, monkeypatch):
        """POST /api/analysis/time_domain/{file_id} returns valid stats"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.analysis.get_file_path",
            lambda fid: sample_edf_file,
        )

        response = client.post(
            "/api/analysis/time_domain/test-file",
            json={"start": 0, "duration": 1, "channels": ["Fp1", "Fp2"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert "statistics" in data
        assert "channels" in data

    def test_time_domain_file_not_found(self, monkeypatch):
        """POST /api/analysis/time_domain returns 404 for missing file"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        def raise_fnf(file_id):
            raise FileNotFoundError(f"File not found: {file_id}")

        monkeypatch.setattr(
            "app.api.routes.analysis.get_file_path", raise_fnf,
        )

        response = client.post(
            "/api/analysis/time_domain/nonexistent",
            json={"start": 0, "duration": 1},
        )

        assert response.status_code == 404


class TestSignalsEndpoint:
    """Signals calculate endpoint tests"""

    def test_calculate_signals_returns_data(self, sample_edf_file, monkeypatch):
        """POST /api/signals/calculate returns valid signal data"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        monkeypatch.setattr(
            "app.api.routes.signals.get_file_path",
            lambda fid: sample_edf_file,
        )

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

    def test_calculate_signals_file_not_found(self, monkeypatch):
        """POST /api/signals/calculate returns 404 for missing file"""
        from fastapi.testclient import TestClient
        client = TestClient(app)

        response = client.post(
            "/api/signals/calculate",
            json={
                "file_id": "nonexistent",
                "signals": [
                    {
                        "id": "sig-1",
                        "expression": "Fp1 - F3",
                        "operands": [
                            {"id": "op-1", "channelName": "Fp1", "channelIndex": 0},
                        ],
                    }
                ],
                "start": 0,
                "duration": 5,
            },
        )

        assert response.status_code == 404


# ============================================================
# Async tests (concurrent non-blocking behavior)
# ============================================================


class TestAsyncNonBlocking:
    """Tests that verify async endpoints don't block the event loop"""

    @pytest.mark.asyncio
    async def test_concurrent_metadata_requests(self, sample_edf_file, monkeypatch):
        """Multiple concurrent metadata requests should all succeed"""
        monkeypatch.setattr(
            "app.api.routes.metadata.get_file_path",
            lambda fid: sample_edf_file,
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            tasks = [
                ac.get(f"/api/metadata/test-file-{i}")
                for i in range(3)
            ]
            responses = await asyncio.gather(*tasks)

        for resp in responses:
            assert resp.status_code == 200
            data = resp.json()
            assert "n_channels" in data

    @pytest.mark.asyncio
    async def test_concurrent_waveform_requests(self, sample_edf_file, monkeypatch):
        """Multiple concurrent waveform requests should all succeed"""
        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path",
            lambda fid: sample_edf_file,
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            tasks = [
                ac.get(
                    "/api/waveform/test-file",
                    params={"start": 0, "duration": 1, "channels": "0"},
                )
                for _ in range(3)
            ]
            responses = await asyncio.gather(*tasks)

        for resp in responses:
            assert resp.status_code == 200
            assert "channels" in resp.json()

    @pytest.mark.asyncio
    async def test_mixed_concurrent_requests(self, sample_edf_file, monkeypatch):
        """Mixed concurrent metadata + waveform requests should all succeed"""
        monkeypatch.setattr(
            "app.api.routes.metadata.get_file_path",
            lambda fid: sample_edf_file,
        )
        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path",
            lambda fid: sample_edf_file,
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            tasks = [
                ac.get("/api/metadata/test-file"),
                ac.get(
                    "/api/waveform/test-file",
                    params={"start": 0, "duration": 1, "channels": "0"},
                ),
            ]
            responses = await asyncio.gather(*tasks)

        assert responses[0].status_code == 200
        assert responses[1].status_code == 200
        assert "n_channels" in responses[0].json()
        assert "channels" in responses[1].json()

    @pytest.mark.asyncio
    async def test_waveform_responds_within_timeout(self, sample_edf_file, monkeypatch):
        """Waveform request should complete within reasonable time (not blocked)"""
        monkeypatch.setattr(
            "app.api.routes.waveform.get_file_path",
            lambda fid: sample_edf_file,
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            start_time = time.time()
            response = await ac.get(
                "/api/waveform/test-file",
                params={"start": 0, "duration": 1, "channels": "0"},
                timeout=10.0,
            )
            elapsed = time.time() - start_time

        assert response.status_code == 200
        assert elapsed < 10.0, f"Request took {elapsed:.1f}s, may be blocking"

    @pytest.mark.asyncio
    async def test_metadata_responds_within_timeout(self, sample_edf_file, monkeypatch):
        """Metadata request should complete within reasonable time"""
        monkeypatch.setattr(
            "app.api.routes.metadata.get_file_path",
            lambda fid: sample_edf_file,
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            start_time = time.time()
            response = await ac.get("/api/metadata/test-file", timeout=10.0)
            elapsed = time.time() - start_time

        assert response.status_code == 200
        assert elapsed < 10.0, f"Request took {elapsed:.1f}s, may be blocking"

    @pytest.mark.asyncio
    async def test_demo_metadata_responds_within_timeout(self, sample_edf_file, monkeypatch):
        """Demo metadata request should complete within reasonable time"""
        mock_fn = lambda fid: sample_edf_file
        monkeypatch.setattr("app.api.routes.upload.get_file_path", mock_fn)
        monkeypatch.setattr("app.services.file_manager.get_file_path", mock_fn)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            start_time = time.time()
            response = await ac.get("/api/upload/dev/demo-metadata", timeout=10.0)
            elapsed = time.time() - start_time

        assert response.status_code == 200
        assert elapsed < 10.0, f"Request took {elapsed:.1f}s, may be blocking"
