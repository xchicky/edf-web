"""
Upload endpoint - Handle EDF file uploads
"""

import asyncio

from fastapi import APIRouter, UploadFile, HTTPException, File
from app.services.edf_parser import EDFParser
from app.services.file_manager import save_upload_file, get_file_path
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_edf_metadata(file_path: str, file_id: str):
    """Synchronous EDF parsing (runs in thread pool)."""
    parser = EDFParser(file_path)
    parser.load()
    metadata = parser.get_metadata()
    metadata["file_id"] = file_id
    return metadata


@router.post("/")
async def upload_edf(file: UploadFile = File(...)):
    """
    Upload EDF file and extract metadata

    Args:
        file: EDF file (multipart/form-data)

    Returns:
        JSON response with file_id and metadata
    """
    if not file.filename.lower().endswith(".edf"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file format. Only .edf files are supported. Got: {file.filename}",
        )

    file_id = str(uuid.uuid4())

    try:
        file_path = await save_upload_file(file, file_id)
        logger.info(f"File uploaded: {file.filename} -> {file_path}")

        metadata = await asyncio.to_thread(_parse_edf_metadata, file_path, file_id)

        logger.info(
            f"EDF parsed successfully: {metadata['n_channels']} channels, {metadata['duration_seconds']}s"
        )

        return metadata

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process EDF file: {str(e)}"
        )


# Dev-only: fixed demo metadata endpoint
# TODO: Remove before production deployment
@router.get("/dev/demo-metadata")
async def get_demo_metadata():
    """
    Return metadata for the demo EDF file with a fixed file_id.
    Dev-only endpoint for development testing convenience.
    """
    from app.services.file_manager import get_file_path
    from app.services.edf_parser import EDFParser

    try:
        file_path = get_file_path("dev-demo")

        def _load_demo():
            parser = EDFParser(file_path)
            parser.load()
            metadata = parser.get_metadata()
            metadata["file_id"] = "dev-demo"
            return metadata

        return await asyncio.to_thread(_load_demo)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Demo EDF file not found")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to parse demo EDF: {str(e)}"
        )
