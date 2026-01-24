"""
Metadata endpoint - Get EDF file metadata
"""

from fastapi import APIRouter, HTTPException
from app.services.edf_parser import EDFParser
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{file_id}")
async def get_metadata(file_id: str):
    """
    Get EDF file metadata by file_id

    Args:
        file_id: Unique file identifier from upload

    Returns:
        JSON response with EDF metadata
    """
    try:
        # Get file path
        file_path = get_file_path(file_id)

        # Parse EDF file
        parser = EDFParser(file_path)
        parser.load()
        metadata = parser.get_metadata()

        # Add file_id to response
        metadata["file_id"] = file_id

        logger.info(
            f"Metadata retrieved for {file_id}: {metadata['n_channels']} channels"
        )

        return metadata

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")
    except Exception as e:
        logger.error(f"Error getting metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get metadata: {str(e)}")
