"""
Waveform endpoint - Get waveform data for specific time window
"""

import asyncio

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from app.services.edf_parser import EDFParser
from app.services.file_manager import get_file_path
import logging
import numpy as np

logger = logging.getLogger(__name__)

router = APIRouter()


class WaveformRequest(BaseModel):
    """Waveform data request model"""

    channels: Optional[List[int]] = Field(
        default=None, description="Channel indices to retrieve (None = all channels)"
    )
    start: float = Field(default=0.0, ge=0.0, description="Start time in seconds")
    duration: float = Field(default=10.0, gt=0.0, description="Duration in seconds")
    highpass: Optional[float] = Field(
        default=None, ge=0.01, le=100.0,
        description="High-pass filter cutoff frequency (Hz)",
    )
    lowpass: Optional[float] = Field(
        default=None, ge=1.0, le=500.0,
        description="Low-pass filter cutoff frequency (Hz)",
    )

    @validator("channels")
    def validate_channels(cls, v):
        if v is not None and len(v) == 0:
            raise ValueError("channels list cannot be empty")
        return v

    @validator("lowpass")
    def validate_filter_range(cls, v, values):
        hp = values.get("highpass")
        if hp is not None and v is not None and hp >= v:
            raise ValueError("highpass must be less than lowpass")
        return v


def _apply_filter(data: list, sfreq: float, highpass: float | None, lowpass: float | None) -> list:
    """Apply highpass/lowpass filtering to waveform data."""
    from app.services.preprocessing import SignalPreprocessor

    arr = np.array(data, dtype=float)
    preprocessor = SignalPreprocessor(sfreq)

    min_samples = 36  # 3 * order * 3 minimum for filtfilt
    if arr.shape[1] < min_samples:
        logger.warning(f"Signal too short ({arr.shape[1]} samples), skipping filter")
        return data

    for i in range(arr.shape[0]):
        if highpass is not None:
            arr[i] = preprocessor.highpass_filter(arr[i], cutoff=highpass)
        if lowpass is not None:
            arr[i] = preprocessor.lowpass_filter(arr[i], cutoff=lowpass)

    return arr.tolist()


def _get_waveform_data(
    file_path: str, start: float, duration: float, channels,
    highpass: float | None = None, lowpass: float | None = None,
):
    """Synchronous waveform data retrieval with optional filtering."""
    parser = EDFParser(file_path)
    parser.load()
    result = parser.get_waveform_chunk(
        start_time=start, duration=duration, channels=channels,
    )

    if highpass is not None or lowpass is not None:
        result["data"] = _apply_filter(result["data"], result["sfreq"], highpass, lowpass)

    return result


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
        file_path = get_file_path(file_id)

        waveform_data = await asyncio.to_thread(
            _get_waveform_data,
            file_path, request.start, request.duration, request.channels,
            request.highpass, request.lowpass,
        )
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
    highpass: Optional[float] = Query(
        None, ge=0.01, le=100.0,
        description="High-pass filter cutoff frequency (Hz)",
    ),
    lowpass: Optional[float] = Query(
        None, ge=1.0, le=500.0,
        description="Low-pass filter cutoff frequency (Hz)",
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
        channel_indices = None
        if channels:
            channel_indices = [int(c.strip()) for c in channels.split(",")]

        if highpass is not None and lowpass is not None and highpass >= lowpass:
            raise HTTPException(400, "highpass must be less than lowpass")

        file_path = get_file_path(file_id)

        waveform_data = await asyncio.to_thread(
            _get_waveform_data,
            file_path, start, duration, channel_indices,
            highpass, lowpass,
        )
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
