"""
File Manager - Handle EDF file uploads and storage
"""

from fastapi import UploadFile
from pathlib import Path
import aiofiles
import shutil
import uuid
import logging

logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = Path(__name__).resolve().parent.parent / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Maximum file size: 500MB
MAX_UPLOAD_SIZE = 500 * 1024 * 1024


async def save_upload_file(file: UploadFile, file_id: str) -> str:
    """
    Save uploaded EDF file to disk

    Args:
        file: FastAPI UploadFile object
        file_id: Unique file identifier

    Returns:
        Full path to saved file
    """
    # Generate filename
    file_extension = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"

    logger.info(f"Saving file: {file.filename} -> {file_path}")

    # Validate file size
    if file.size and file.size > MAX_UPLOAD_SIZE:
        raise ValueError(f"File too large: {file.size} bytes (max {MAX_UPLOAD_SIZE})")

    # Stream file to disk in chunks (memory efficient)
    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(64 * 1024):  # 64KB chunks
                await f.write(chunk)

        logger.info(f"File saved successfully: {file_path}")
        return str(file_path)

    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        # Cleanup if failed
        if file_path.exists():
            file_path.unlink()
        raise


async def delete_file(file_path: str) -> bool:
    """Delete uploaded file"""
    try:
        Path(file_path).unlink()
        logger.info(f"File deleted: {file_path}")
        return True
    except FileNotFoundError:
        logger.warning(f"File not found: {file_path}")
        return False
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        return False


def get_file_path(file_id: str, extension: str = ".edf") -> str:
    """Get file path from file ID"""
    return str(UPLOAD_DIR / f"{file_id}{extension}")
