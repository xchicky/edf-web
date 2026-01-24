"""Test configuration and fixtures"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Create test client for FastAPI app"""
    return TestClient(app)


@pytest.fixture
def sample_metadata():
    """Sample EDF metadata for testing"""
    return {
        "file_id": "test-123",
        "filename": "test.edf",
        "file_size_mb": 10.5,
        "n_channels": 10,
        "channel_names": [f"EEG Ch{i}" for i in range(10)],
        "sfreq": 500.0,
        "duration_seconds": 600.0,
        "duration_minutes": 10.0,
    }
