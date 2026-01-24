"""
Waveform endpoint - Get waveform data for specific time window
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from app.services.edf_parser import EDFParser
from app.services.file_manager import get_file_path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class WaveformRequest(BaseModel):
    """Waveform data request model"""

    channels: Optional[List[int]] = Field(
        default=None, description="Channel indices to retrieve (None = all channels)"
    )
    start: float = Field(default=0.0, ge=0.0, description="Start time in seconds")
    duration: float = Field(default=10.0, gt=0.0, description="Duration in seconds")

    @validator("channels")
    def validate_channels(cls, v):
        if v is not None and len(v) == 0:
            raise ValueError("channels list cannot be empty")
        return v


@router.post("/{file_id}")
async def get_waveform(file_id: str, request: WaveformRequest):
    """
    Get waveform data for specific time window

    Args:
        file_id: Unique file identifier
        request: Waveform request with channels, start, duration

    Returns:
        JSON response with waveform data
    """
    try:
        # Get file path
        file_path = get_file_path(file_id)

        # Parse EDF file
        parser = EDFParser(file_path)
        parser.load()

        # Extract waveform chunk
        waveform_data = parser.get_waveform_chunk(
            start_time=request.start,
            duration=request.duration,
            channels=request.channels,
        )

        # Add file_id to response
        waveform_data["file_id"] = file_id

        logger.info(
            f"Waveform data retrieved: {len(waveform_data['channels'])} channels, {waveform_data['n_samples']} samples"
        )

        return waveform_data

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")
    except ValueError as e:
        logger.error(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting waveform: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get waveform data: {str(e)}"
        )


@router.get("/{file_id}")
async def get_waveform_get(
    file_id: str,
    start: float = Query(0.0, ge=0.0, description="Start time in seconds"),
    duration: float = Query(10.0, gt=0.0, description="Duration in seconds"),
    channels: Optional[str] = Query(
        None, description="Comma-separated channel indices"
    ),
):
    """
    Get waveform data (GET method for simpler testing)

    Args:
        file_id: Unique file identifier
        start: Start time in seconds
        duration: Duration in seconds
        channels: Comma-separated channel indices (e.g., "0,1,2,3,4")

    Returns:
        JSON response with waveform data
    """
    try:
        # Parse channels parameter
        channel_indices = None
        if channels:
            channel_indices = [int(c.strip()) for c in channels.split(",")]

        # Get file path
        file_path = get_file_path(file_id)

        # Parse EDF file
        parser = EDFParser(file_path)
        parser.load()

        # Extract waveform chunk
        waveform_data = parser.get_waveform_chunk(
            start_time=start, duration=duration, channels=channel_indices
        )

        # Add file_id to response
        waveform_data["file_id"] = file_id

        logger.info(
            f"Waveform data retrieved (GET): {len(waveform_data['channels'])} channels"
        )

        return waveform_data

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting waveform: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get waveform data: {str(e)}"
        )
