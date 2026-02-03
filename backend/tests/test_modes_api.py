"""
Test suite for Mode Management API

Tests the complete CRUD operations for EEG viewing modes,
including compatibility checking and recommendations.
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import time
import json
import os
from typing import List, Dict, Any

from app.main import app


@pytest.fixture(autouse=True)
def cleanup_test_data():
    """Clean up test data before and after each test"""
    # Setup
    yield

    # Cleanup - remove custom modes and stats files
    from pathlib import Path
    modes_dir = Path(__file__).parent.parent / "storage" / "modes"
    custom_modes_file = modes_dir / "custom_modes.json"
    stats_file = modes_dir / "usage_stats.json"

    if custom_modes_file.exists():
        custom_modes_file.unlink()
    if stats_file.exists():
        stats_file.unlink()


# Sample test data
SAMPLE_MODE_CONFIG = {
    "viewMode": "waveform",
    "timeWindow": 10,
    "amplitudeScale": 1.0,
    "showGrid": True,
    "showAnnotations": True,
    "displayChannels": [
        {"channelName": "Fp1", "channelIndex": 0, "visible": True},
        {"channelName": "Fp2", "channelIndex": 1, "visible": True},
        {"channelName": "F3", "channelIndex": 2, "visible": True},
    ],
    "enableFilter": True,
    "filterHighPass": 0.5,
    "filterLowPass": 70,
    "bands": [
        {"name": "delta", "range": [0.5, 4], "enabled": True, "color": "#6366f1"},
        {"name": "theta", "range": [4, 8], "enabled": True, "color": "#8b5cf6"},
    ],
    "signals": [
        {
            "id": "sig-fp1-f3",
            "name": "Fp1-F3 Diff",
            "expression": "Fp1 - F3",
            "operands": [
                {"id": "op-fp1", "channelName": "Fp1", "channelIndex": 0},
                {"id": "op-f3", "channelName": "F3", "channelIndex": 2},
            ],
            "color": "#ef4444",
            "enabled": True,
        }
    ],
    "analysis": {
        "enabled": True,
        "type": "comprehensive",
        "autoUpdate": False,
    },
    "autoSave": True,
    "maxBookmarks": 50,
}

SAMPLE_MODE_CREATE = {
    "name": "Test Custom Mode",
    "category": "custom",
    "description": "A test mode for unit testing",
    "config": SAMPLE_MODE_CONFIG,
    "tags": ["test", "custom"],
}

BUILT_IN_MODE_IDS = [
    "mode-clinical-standard",
    "mode-research-spectral",
    "mode-education-basic",
]


@pytest.fixture
def client():
    """Create test client for FastAPI app"""
    return TestClient(app)


class TestGetAllModes:
    """Test GET /api/modes/ endpoint"""

    def test_get_all_modes_returns_list(self, client):
        """Should return a list of modes"""
        response = client.get("/api/modes/")
        assert response.status_code == 200

        data = response.json()
        assert "modes" in data
        assert "total" in data
        assert "categories" in data
        assert isinstance(data["modes"], list)
        assert isinstance(data["total"], int)

    def test_get_all_modes_includes_built_in_modes(self, client):
        """Should include all three built-in modes"""
        response = client.get("/api/modes/")
        data = response.json()

        mode_ids = [mode["id"] for mode in data["modes"]]
        for built_in_id in BUILT_IN_MODE_IDS:
            assert built_in_id in mode_ids

    def test_get_all_modes_with_category_filter(self, client):
        """Should filter modes by category"""
        response = client.get("/api/modes/?category=clinical")
        assert response.status_code == 200

        data = response.json()
        for mode in data["modes"]:
            assert mode["category"] == "clinical"

    def test_get_all_modes_with_built_in_filter(self, client):
        """Should filter to only built-in modes"""
        response = client.get("/api/modes/?include_built_in=true&include_custom=false")
        assert response.status_code == 200

        data = response.json()
        for mode in data["modes"]:
            assert mode["isBuiltIn"] is True

    def test_get_all_modes_with_custom_filter(self, client):
        """Should filter to only custom modes"""
        # First create a custom mode
        client.post("/api/modes/", json=SAMPLE_MODE_CREATE)

        response = client.get("/api/modes/?include_built_in=false&include_custom=true")
        assert response.status_code == 200

        data = response.json()
        for mode in data["modes"]:
            assert mode["isBuiltIn"] is False

    def test_get_all_modes_with_pagination(self, client):
        """Should support limit and offset parameters"""
        response = client.get("/api/modes/?limit=2&offset=0")
        assert response.status_code == 200

        data = response.json()
        assert len(data["modes"]) <= 2

    def test_get_all_modes_invalid_category(self, client):
        """Should handle invalid category gracefully"""
        response = client.get("/api/modes/?category=invalid")
        # Should return empty list or handle gracefully
        assert response.status_code in [200, 400]


class TestGetModeById:
    """Test GET /api/modes/{mode_id} endpoint"""

    def test_get_built_in_mode_by_id(self, client):
        """Should retrieve a built-in mode by ID"""
        response = client.get(f"/api/modes/{BUILT_IN_MODE_IDS[0]}")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == BUILT_IN_MODE_IDS[0]
        assert "name" in data
        assert "config" in data
        assert data["isBuiltIn"] is True

    def test_get_custom_mode_by_id(self, client):
        """Should retrieve a custom mode by ID"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Get the mode
        response = client.get(f"/api/modes/{mode_id}")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == mode_id
        assert data["name"] == "Test Custom Mode"
        assert data["isBuiltIn"] is False

    def test_get_nonexistent_mode_returns_404(self, client):
        """Should return 404 for non-existent mode"""
        response = client.get("/api/modes/nonexistent-id")
        assert response.status_code == 404


class TestCreateMode:
    """Test POST /api/modes/ endpoint"""

    def test_create_custom_mode_success(self, client):
        """Should create a new custom mode"""
        response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        assert response.status_code == 201

        data = response.json()
        assert "id" in data
        assert data["name"] == "Test Custom Mode"
        assert data["category"] == "custom"
        assert data["description"] == "A test mode for unit testing"
        assert data["isBuiltIn"] is False
        assert data["isFavorite"] is False
        assert data["usageCount"] == 0
        assert "createdAt" in data
        assert "modifiedAt" in data

    def test_create_mode_generates_unique_id(self, client):
        """Should generate unique IDs for each mode"""
        response1 = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        response2 = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)

        assert response1.json()["id"] != response2.json()["id"]

    def test_create_mode_with_signals(self, client):
        """Should create mode with derived signal configurations"""
        response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        assert response.status_code == 201

        data = response.json()
        assert "signals" in data["config"]
        assert len(data["config"]["signals"]) == 1
        assert data["config"]["signals"][0]["id"] == "sig-fp1-f3"

    def test_create_mode_missing_required_field(self, client):
        """Should reject mode without required fields"""
        incomplete_mode = {
            "name": "Incomplete Mode",
            # Missing category and config
        }
        response = client.post("/api/modes/", json=incomplete_mode)
        assert response.status_code == 422  # Validation error

    def test_create_mode_invalid_category(self, client):
        """Should reject invalid category"""
        invalid_mode = {
            **SAMPLE_MODE_CREATE,
            "category": "invalid_category",
        }
        response = client.post("/api/modes/", json=invalid_mode)
        assert response.status_code == 422

    def test_create_mode_invalid_view_mode(self, client):
        """Should reject invalid viewMode"""
        invalid_config = {
            **SAMPLE_MODE_CONFIG,
            "viewMode": "invalid_view",
        }
        invalid_mode = {
            **SAMPLE_MODE_CREATE,
            "config": invalid_config,
        }
        response = client.post("/api/modes/", json=invalid_mode)
        assert response.status_code == 422


class TestUpdateMode:
    """Test PUT /api/modes/{mode_id} endpoint"""

    def test_update_custom_mode_success(self, client):
        """Should update an existing custom mode"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Update the mode
        updates = {
            "name": "Updated Test Mode",
            "description": "Updated description",
        }
        response = client.put(f"/api/modes/{mode_id}", json=updates)
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Updated Test Mode"
        assert data["description"] == "Updated description"
        assert data["id"] == mode_id  # ID should not change

    def test_update_mode_config(self, client):
        """Should update mode configuration"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Update config
        config_updates = {
            "config": {
                **SAMPLE_MODE_CONFIG,
                "timeWindow": 20,
                "amplitudeScale": 2.0,
            }
        }
        response = client.put(f"/api/modes/{mode_id}", json=config_updates)
        assert response.status_code == 200

        data = response.json()
        assert data["config"]["timeWindow"] == 20
        assert data["config"]["amplitudeScale"] == 2.0

    def test_update_mode_tags(self, client):
        """Should update mode tags"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Update tags
        response = client.put(f"/api/modes/{mode_id}", json={"tags": ["updated", "tags"]})
        assert response.status_code == 200

        data = response.json()
        assert data["tags"] == ["updated", "tags"]

    def test_update_built_in_mode_fails(self, client):
        """Should reject updates to built-in modes"""
        response = client.put(
            f"/api/modes/{BUILT_IN_MODE_IDS[0]}",
            json={"name": "Hacked Built-in Mode"}
        )
        assert response.status_code == 403

    def test_update_nonexistent_mode_returns_404(self, client):
        """Should return 404 when updating non-existent mode"""
        response = client.put("/api/modes/nonexistent", json={"name": "New Name"})
        assert response.status_code == 404


class TestDeleteMode:
    """Test DELETE /api/modes/{mode_id} endpoint"""

    def test_delete_custom_mode_success(self, client):
        """Should delete a custom mode"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Delete the mode
        response = client.delete(f"/api/modes/{mode_id}")
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True

        # Verify mode is deleted
        get_response = client.get(f"/api/modes/{mode_id}")
        assert get_response.status_code == 404

    def test_delete_built_in_mode_fails(self, client):
        """Should reject deletion of built-in modes"""
        response = client.delete(f"/api/modes/{BUILT_IN_MODE_IDS[0]}")
        assert response.status_code == 403

    def test_delete_nonexistent_mode_returns_404(self, client):
        """Should return 404 when deleting non-existent mode"""
        response = client.delete("/api/modes/nonexistent")
        assert response.status_code == 404


class TestCompatibilityCheck:
    """Test POST /api/modes/check-compatibility endpoint"""

    def test_check_compatibility_all_channels_available(self, client):
        """Should return compatible when all channels available"""
        request = {
            "mode_id": BUILT_IN_MODE_IDS[0],
            "channel_names": ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "O1", "O2"],
            "sampling_rate": 500,
        }
        response = client.post("/api/modes/check-compatibility", json=request)
        assert response.status_code == 200

        data = response.json()
        assert "is_compatible" in data
        assert "issues" in data
        assert "warnings" in data
        assert "can_apply_with_fixes" in data

    def test_check_compatibility_missing_channels(self, client):
        """Should detect missing required channels"""
        request = {
            "mode_id": BUILT_IN_MODE_IDS[1],  # Research mode requires Fz, Cz, Pz
            "channel_names": ["Fp1", "Fp2"],  # Missing required channels
            "sampling_rate": 500,
        }
        response = client.post("/api/modes/check-compatibility", json=request)
        assert response.status_code == 200

        data = response.json()
        assert data["is_compatible"] is False
        assert len(data["issues"]) > 0

    def test_check_compatibility_low_sampling_rate(self, client):
        """Should detect insufficient sampling rate"""
        request = {
            "mode_id": BUILT_IN_MODE_IDS[1],  # Research mode requires 100 Hz
            "channel_names": ["Fz", "Cz", "Pz"],
            "sampling_rate": 50,  # Too low
        }
        response = client.post("/api/modes/check-compatibility", json=request)
        assert response.status_code == 200

        data = response.json()
        assert data["is_compatible"] is False
        issue_types = [issue.get("type") for issue in data["issues"]]
        assert "low_sampling_rate" in issue_types

    def test_check_compatibility_nonexistent_mode(self, client):
        """Should return 404 for non-existent mode"""
        request = {
            "mode_id": "nonexistent-mode",
            "channel_names": ["Fp1"],
            "sampling_rate": 500,
        }
        response = client.post("/api/modes/check-compatibility", json=request)
        assert response.status_code == 404


class TestRecordModeUsage:
    """Test POST /api/modes/{mode_id}/use endpoint"""

    def test_record_mode_usage_success(self, client):
        """Should record mode usage and increment counter"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]
        initial_count = create_response.json()["usageCount"]

        # Record usage
        response = client.post(f"/api/modes/{mode_id}/use")
        assert response.status_code == 200

        # Verify usage count increased
        get_response = client.get(f"/api/modes/{mode_id}")
        assert get_response.json()["usageCount"] == initial_count + 1

    def test_record_mode_usage_updates_last_used(self, client):
        """Should update last_used_at timestamp"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Record usage
        time.sleep(0.1)  # Small delay to ensure timestamp difference
        response = client.post(f"/api/modes/{mode_id}/use")
        assert response.status_code == 200

        # Verify last_used_at is set
        get_response = client.get(f"/api/modes/{mode_id}")
        last_used = get_response.json()["lastUsedAt"]
        assert last_used is not None
        assert last_used > create_response.json()["createdAt"]

    def test_record_usage_for_built_in_mode(self, client):
        """Should allow recording usage for built-in modes"""
        response = client.post(f"/api/modes/{BUILT_IN_MODE_IDS[0]}/use")
        assert response.status_code == 200


class TestModeStats:
    """Test GET /api/modes/{mode_id}/stats endpoint"""

    def test_get_mode_stats_success(self, client):
        """Should return mode usage statistics"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Record some usage
        client.post(f"/api/modes/{mode_id}/use")
        client.post(f"/api/modes/{mode_id}/use")

        # Get stats
        response = client.get(f"/api/modes/{mode_id}/stats")
        assert response.status_code == 200

        data = response.json()
        assert data["mode_id"] == mode_id
        assert data["mode_name"] == "Test Custom Mode"
        assert data["total_uses"] == 2
        assert "last_used_at" in data
        assert "first_used_at" in data

    def test_get_stats_for_nonexistent_mode(self, client):
        """Should return 404 for non-existent mode"""
        response = client.get("/api/modes/nonexistent/stats")
        assert response.status_code == 404


class TestGetCategories:
    """Test GET /api/modes/categories endpoint"""

    def test_get_categories_returns_all(self, client):
        """Should return all mode categories"""
        response = client.get("/api/modes/categories")
        assert response.status_code == 200

        data = response.json()
        assert "categories" in data
        expected_categories = ["clinical", "research", "education", "custom"]
        assert all(cat in data["categories"] for cat in expected_categories)


class TestRecommendModes:
    """Test POST /api/modes/recommend endpoint"""

    def test_recommend_modes_returns_suggestions(self, client):
        """Should return recommended modes based on context"""
        request = {
            "channel_names": ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "O1", "O2"],
            "sampling_rate": 500,
            "context": {
                "purpose": "clinical_diagnosis",
                "user_level": "intermediate",
            },
        }
        response = client.post("/api/modes/recommend", json=request)
        assert response.status_code == 200

        data = response.json()
        assert "modes" in data
        assert isinstance(data["modes"], list)

    def test_recommend_modes_with_basic_context(self, client):
        """Should work with minimal context"""
        request = {
            "channel_names": ["Fz", "Cz", "Pz"],
            "sampling_rate": 500,
        }
        response = client.post("/api/modes/recommend", json=request)
        assert response.status_code == 200

        data = response.json()
        assert len(data["modes"]) >= 0


class TestAdditionalEndpoints:
    """Test additional convenience endpoints"""

    def test_toggle_favorite(self, client):
        """Test POST /api/modes/{mode_id}/favorite"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]
        initial_favorite = create_response.json()["isFavorite"]

        # Toggle favorite
        response = client.post(f"/api/modes/{mode_id}/favorite")
        assert response.status_code == 200

        data = response.json()
        assert data["isFavorite"] is not initial_favorite

    def test_duplicate_mode(self, client):
        """Test POST /api/modes/{mode_id}/duplicate"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Duplicate
        response = client.post(f"/api/modes/{mode_id}/duplicate", json={"new_name": "Duplicated Mode"})
        assert response.status_code == 201

        data = response.json()
        assert data["id"] != mode_id
        assert data["name"] == "Duplicated Mode"
        assert data["isBuiltIn"] is False

    def test_export_and_import_mode(self, client):
        """Test export and import functionality"""
        import json

        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Export
        export_response = client.get(f"/api/modes/{mode_id}/export")
        assert export_response.status_code == 200
        mode_data = export_response.text
        mode_dict = json.loads(mode_data)

        # Import (send as JSON object, not string)
        import_response = client.post("/api/modes/import", json=mode_dict)
        if import_response.status_code != 201:
            print(f"Import error: {import_response.text}")
            print(f"Exported mode data keys: {mode_dict.keys()}")
        assert import_response.status_code == 201

        data = import_response.json()
        assert data["id"] != mode_id  # New ID on import
        assert data["name"] == "Test Custom Mode"

    def test_reset_mode(self, client):
        """Test POST /api/modes/{mode_id}/reset"""
        # Create and modify a mode
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Modify the mode
        client.put(f"/api/modes/{mode_id}", json={"name": "Modified Name"})

        # Reset
        response = client.post(f"/api/modes/{mode_id}/reset")
        # For custom modes, reset might not be applicable
        # This test verifies the endpoint exists
        assert response.status_code in [200, 400]  # 400 if not applicable

    def test_apply_mode(self, client):
        """Test POST /api/modes/{mode_id}/apply"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Apply mode to a file
        request = {
            "file_id": "test-file-id",
            "auto_load_data": True,
            "preserve_bookmarks": True,
        }
        response = client.post(f"/api/modes/{mode_id}/apply", json=request)
        # File might not exist, but endpoint should handle gracefully
        assert response.status_code in [200, 404]


class TestBatchCompatibilityCheck:
    """Test POST /api/modes/batch-check-compatibility endpoint"""

    def test_batch_check_compatibility(self, client):
        """Should check compatibility for multiple modes at once"""
        request = {
            "requests": [
                {
                    "mode_id": BUILT_IN_MODE_IDS[0],
                    "channel_names": ["Fp1", "Fp2", "F3"],
                    "sampling_rate": 500,
                },
                {
                    "mode_id": BUILT_IN_MODE_IDS[1],
                    "channel_names": ["Fz", "Cz", "Pz"],
                    "sampling_rate": 50,  # Too low for research mode
                },
            ]
        }
        response = client.post("/api/modes/batch-check-compatibility", json=request)
        assert response.status_code == 200

        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 2


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_create_mode_with_empty_display_channels(self, client):
        """Should handle mode with no display channels"""
        mode_data = {
            **SAMPLE_MODE_CREATE,
            "config": {
                **SAMPLE_MODE_CONFIG,
                "displayChannels": [],
            }
        }
        response = client.post("/api/modes/", json=mode_data)
        assert response.status_code == 201

    def test_create_mode_with_no_bands(self, client):
        """Should handle mode with no frequency bands"""
        mode_data = {
            **SAMPLE_MODE_CREATE,
            "config": {
                **SAMPLE_MODE_CONFIG,
                "bands": [],
            }
        }
        response = client.post("/api/modes/", json=mode_data)
        assert response.status_code == 201

    def test_create_mode_with_invalid_time_window(self, client):
        """Should reject invalid time window"""
        mode_data = {
            **SAMPLE_MODE_CREATE,
            "config": {
                **SAMPLE_MODE_CONFIG,
                "timeWindow": -1,  # Invalid
            }
        }
        response = client.post("/api/modes/", json=mode_data)
        assert response.status_code == 422

    def test_create_mode_with_no_signals(self, client):
        """Should handle mode with no derived signals"""
        mode_data = {
            **SAMPLE_MODE_CREATE,
            "config": {
                **SAMPLE_MODE_CONFIG,
                "signals": None,
            }
        }
        response = client.post("/api/modes/", json=mode_data)
        assert response.status_code == 201

    def test_get_mode_with_invalid_id_format(self, client):
        """Should handle invalid ID format gracefully"""
        response = client.get("/api/modes/invalid-id-with-special-chars!")
        assert response.status_code == 404

    def test_update_mode_with_empty_body(self, client):
        """Should handle empty update body"""
        # Create a mode first
        create_response = client.post("/api/modes/", json=SAMPLE_MODE_CREATE)
        mode_id = create_response.json()["id"]

        # Empty update
        response = client.put(f"/api/modes/{mode_id}", json={})
        assert response.status_code == 200  # Should succeed, just no changes
