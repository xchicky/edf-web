"""
Upload endpoint - Handle EDF file uploads
"""

from fastapi import APIRouter, UploadFile, HTTPException, File
from app.services.edf_parser import EDFParser
from app.services.file_manager import save_upload_file, get_file_path
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/")
async def upload_edf(file: UploadFile = File(...)):
    """
    Upload EDF file and extract metadata

    Args:
        file: EDF file (multipart/form-data)

    Returns:
        JSON response with file_id and metadata
    """
    # Validate file extension
    if not file.filename.lower().endswith(".edf"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file format. Only .edf files are supported. Got: {file.filename}",
        )

    # Generate unique file ID
    file_id = str(uuid.uuid4())

    try:
        # Save file to disk
        file_path = await save_upload_file(file, file_id)
        logger.info(f"File uploaded: {file.filename} -> {file_path}")

        # Parse EDF file
        parser = EDFParser(file_path)
        parser.load()
        metadata = parser.get_metadata()

        # Add file_id to response
        metadata["file_id"] = file_id

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
