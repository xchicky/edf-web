"""
Waveform overview endpoint - Get downsampled waveform data for overview strip
"""

import asyncio

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.services.edf_parser import EDFParser
from app.services.file_manager import get_file_path
import logging
import numpy as np

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_overview_data(file_path: str, samples_per_second: float, channel_indices):
    """Synchronous overview data retrieval (runs in thread pool)."""
    parser = EDFParser(file_path)
    parser.load()

    metadata = parser.get_metadata()
    original_sfreq = metadata["sfreq"]
    duration_seconds = metadata["duration_seconds"]

    downsampling_factor = max(1, int(original_sfreq / samples_per_second))

    logger.info(
        f"Generating overview: {duration_seconds}s at {samples_per_second} Hz, "
        f"downsampling factor: {downsampling_factor}"
    )

    raw_cropped = parser.raw.copy()
    raw_cropped.load_data()

    if channel_indices is not None:
        channel_names = [raw_cropped.ch_names[i] for i in channel_indices]
        raw_cropped.pick_channels(channel_names)
    else:
        channel_indices = list(range(len(raw_cropped.ch_names)))

    data = raw_cropped.get_data(units="µV")
    downsampled_data = data[:, ::downsampling_factor]

    n_samples = downsampled_data.shape[1]
    times = np.linspace(0, duration_seconds, n_samples)

    return {
        "data": downsampled_data.tolist(),
        "times": times.tolist(),
        "channels": [raw_cropped.ch_names[i] for i in channel_indices],
        "sfreq": float(samples_per_second),
        "n_samples": int(n_samples),
        "start_time": 0.0,
        "duration": float(duration_seconds),
        "original_sfreq": float(original_sfreq),
        "downsampling_factor": int(downsampling_factor),
    }


@router.get("/{file_id}")
async def get_waveform_overview(
    file_id: str,
    samples_per_second: float = Query(1.0, gt=0.0, description="Samples per second (default: 1)"),
    channels: Optional[str] = Query(
        None, description="Comma-separated channel indices"
    ),
):
    """
    Get downsampled waveform data for overview strip

    Args:
        file_id: Unique file identifier
        samples_per_second: Target sampling rate (default: 1 sample per second)
        channels: Comma-separated channel indices (e.g., "0,1,2,3,4")

    Returns:
        JSON response with downsampled waveform data
    """
    try:
        channel_indices = None
        if channels:
            channel_indices = [int(c.strip()) for c in channels.split(",")]

        file_path = get_file_path(file_id)

        return await asyncio.to_thread(
            _get_overview_data, file_path, samples_per_second, channel_indices,
        )

    except FileNotFoundError:
        logger.error(f"File not found: {file_id}")
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")
    except ValueError as e:
        logger.error(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting waveform overview: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get waveform overview: {str(e)}"
        )
