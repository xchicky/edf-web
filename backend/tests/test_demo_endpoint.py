"""
Tests for the dev demo metadata endpoint.
"""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path


class TestDemoMetadataEndpoint:
    """Tests for GET /api/upload/dev/demo-metadata"""

    def test_get_demo_metadata_success(self, client):
        """Should return metadata with fixed file_id 'dev-demo'"""
        mock_metadata = {
            "filename": "demo.edf",
            "file_size_mb": 1.0,
            "n_channels": 19,
            "channel_names": ["Fp1", "Fp2", "F3", "F4", "C3", "C4",
                              "P3", "P4", "O1", "O2", "F7", "F8",
                              "T3", "T4", "T5", "T6", "Fz", "Cz", "Pz"],
            "sfreq": 256.0,
            "duration_seconds": 600.0,
            "duration_minutes": 10.0,
        }

        with patch("app.services.file_manager.get_file_path") as mock_get_path, \
             patch("app.services.edf_parser.EDFParser") as mock_parser_cls:
            mock_get_path.return_value = "/some/path/demo.edf"
            mock_parser = MagicMock()
            mock_parser.get_metadata.return_value = mock_metadata
            mock_parser_cls.return_value = mock_parser

            response = client.get("/api/upload/dev/demo-metadata")

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == "dev-demo"
        assert data["filename"] == "demo.edf"
        assert data["n_channels"] == 19
        assert data["sfreq"] == 256.0

    def test_get_demo_metadata_file_not_found(self, client):
        """Should return 404 when demo file doesn't exist"""
        with patch("app.services.file_manager.get_file_path") as mock_get_path:
            mock_get_path.side_effect = FileNotFoundError("Demo EDF file not found")

            response = client.get("/api/upload/dev/demo-metadata")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_demo_metadata_parse_error(self, client):
        """Should return 500 when EDF parsing fails"""
        with patch("app.services.file_manager.get_file_path") as mock_get_path, \
             patch("app.services.edf_parser.EDFParser") as mock_parser_cls:
            mock_get_path.return_value = "/some/path/demo.edf"
            mock_parser = MagicMock()
            mock_parser.load.side_effect = Exception("Corrupted EDF file")
            mock_parser_cls.return_value = mock_parser

            response = client.get("/api/upload/dev/demo-metadata")

        assert response.status_code == 500
        assert "Corrupted EDF file" in response.json()["detail"]

    def test_get_demo_metadata_uses_dev_demo_file_id(self, client):
        """Should call get_file_path with 'dev-demo' file_id"""
        mock_metadata = {
            "filename": "demo.edf",
            "n_channels": 10,
        }

        with patch("app.services.file_manager.get_file_path") as mock_get_path, \
             patch("app.services.edf_parser.EDFParser") as mock_parser_cls:
            mock_get_path.return_value = "/some/path/demo.edf"
            mock_parser = MagicMock()
            mock_parser.get_metadata.return_value = mock_metadata
            mock_parser_cls.return_value = mock_parser

            client.get("/api/upload/dev/demo-metadata")

        mock_get_path.assert_called_once_with("dev-demo")


class TestDemoEdfPathResolution:
    """Tests for DEMO_EDF_PATH path resolution correctness"""

    def test_demo_edf_path_points_to_project_root_edf_dir(self):
        """DEMO_EDF_PATH should resolve to <project_root>/edf/demo.edf, not backend/edf/demo.edf"""
        from app.services.file_manager import DEMO_EDF_PATH

        # Path must end with edf/demo.edf
        assert DEMO_EDF_PATH.name == "demo.edf"
        assert DEMO_EDF_PATH.parent.name == "edf"

        # The parent of edf/ should NOT be "backend" — it should be the project root
        project_root = DEMO_EDF_PATH.parent.parent
        assert project_root.name != "backend", (
            f"DEMO_EDF_PATH resolves to {DEMO_EDF_PATH}, which is under backend/. "
            f"Should be under project root."
        )

    def test_demo_edf_path_resolution_from_services_dir(self):
        """Verify the parent chain: file_manager.py → services → app → backend → project_root"""
        from app.services.file_manager import DEMO_EDF_PATH
        import app.services.file_manager as fm

        # __file__ of file_manager.py
        fm_file = Path(fm.__file__).resolve()
        # 4 parents up from file_manager.py should reach project root
        project_root = fm_file.parent.parent.parent.parent
        expected = project_root / "edf" / "demo.edf"

        assert DEMO_EDF_PATH == expected


class TestFileManagerDevDemo:
    """Tests for file_manager.get_file_path dev-demo mapping"""

    def test_get_file_path_dev_demo(self):
        """Should return demo EDF path for 'dev-demo' file_id"""
        from app.services.file_manager import get_file_path, DEMO_EDF_PATH

        # Only test if the demo file actually exists
        if DEMO_EDF_PATH.exists():
            result = get_file_path("dev-demo")
            assert result == str(DEMO_EDF_PATH)
        else:
            with pytest.raises(FileNotFoundError):
                get_file_path("dev-demo")

    def test_get_file_path_dev_demo_not_found(self):
        """Should raise FileNotFoundError when demo file missing"""
        from app.services.file_manager import get_file_path

        with patch("app.services.file_manager.DEMO_EDF_PATH") as mock_path:
            mock_path.exists.return_value = False
            mock_path.__str__ = lambda self: "/fake/demo.edf"

            with pytest.raises(FileNotFoundError, match="Demo EDF file not found"):
                get_file_path("dev-demo")

    def test_get_file_path_normal_id(self):
        """Should return normal upload path for regular file_ids"""
        from app.services.file_manager import get_file_path, UPLOAD_DIR

        result = get_file_path("some-uuid-123")
        assert result == str(UPLOAD_DIR / "some-uuid-123.edf")
