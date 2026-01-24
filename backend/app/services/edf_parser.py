"""
EDF Parser Service - Uses MNE-Python for EDF file processing
"""

import mne
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)


class EDFParser:
    """EDF file parser using MNE-Python"""

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.raw: Optional[mne.io.Raw] = None

    def load(self) -> None:
        """Load EDF file using MNE"""
        try:
            logger.info(f"Loading EDF file: {self.file_path}")
            self.raw = mne.io.read_raw_edf(
                str(self.file_path),
                preload=False,  # Don't load all data into memory (memory optimization)
                encoding="latin1",  # Handle Chinese filenames
                verbose=False,
            )
            logger.info(f"EDF loaded successfully: {len(self.raw.ch_names)} channels")
        except Exception as e:
            logger.error(f"Failed to load EDF file: {e}")
            raise

    def get_metadata(self) -> Dict[str, Any]:
        """Extract EDF header and metadata"""
        if self.raw is None:
            raise ValueError("EDF file not loaded. Call load() first.")

        info = self.raw.info

        # Parse patient info
        patient_info = self._parse_patient_info(info)

        return {
            "filename": self.file_path.name,
            "file_size_mb": round(self.file_path.stat().st_size / (1024 * 1024), 2),
            "n_channels": len(info["ch_names"]),
            "channel_names": info["ch_names"],
            "sfreq": float(info["sfreq"]),
            "n_samples": int(self.raw.n_times),
            "duration_seconds": float(self.raw.times[-1]),
            "duration_minutes": round(float(self.raw.times[-1] / 60), 2),
            "meas_date": info.get("meas_date").isoformat()
            if info.get("meas_date")
            else None,
            "patient_info": patient_info,
            "n_annotations": len(self.raw.annotations),
        }

    def get_waveform_chunk(
        self, start_time: float, duration: float, channels: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Extract waveform data for specific time window

        Args:
            start_time: Start time in seconds
            duration: Duration in seconds
            channels: List of channel indices (None = all channels)
        """
        if self.raw is None:
            raise ValueError("EDF file not loaded. Call load() first.")

        # Calculate sample range
        sfreq = self.raw.info["sfreq"]
        start_sample = int(start_time * sfreq)
        stop_sample = int((start_time + duration) * sfreq)

        # Validate time range
        if start_sample >= self.raw.n_times:
            raise ValueError(
                f"Start time {start_time}s exceeds file duration {self.raw.times[-1]}s"
            )

        stop_sample = min(stop_sample, self.raw.n_times)

        logger.info(
            f"Extracting waveform: {start_time}s - {start_time + duration}s, samples {start_sample}-{stop_sample}"
        )

        # Crop and load data (memory optimization)
        raw_cropped = self.raw.copy().crop(tmin=start_time, tmax=start_time + duration)
        raw_cropped.load_data()

        # Select channels
        if channels is not None:
            channel_names = [self.raw.ch_names[i] for i in channels]
            raw_cropped.pick_channels(channel_names)
        else:
            channels = list(range(len(self.raw.ch_names)))

        # Get data as numpy array (convert to microvolts for proper scaling)
        data = raw_cropped.get_data(units="µV")
        times = raw_cropped.times

        # Convert to list for JSON serialization
        return {
            "data": data.tolist(),  # Shape: (n_channels, n_samples)
            "times": times.tolist(),
            "channels": [self.raw.ch_names[i] for i in channels],
            "sfreq": float(sfreq),
            "n_samples": int(len(times)),
            "start_time": float(start_time),
            "duration": float(duration),
        }

    def _parse_patient_info(self, info: Dict) -> Dict[str, Any]:
        """Parse patient info from MNE info"""
        subject_info = info.get("subject_info", {})

        # Sex mapping
        sex_map = {0: "Unknown", 1: "Male", 2: "Female"}
        sex = subject_info.get("sex", 0)
        sex_str = sex_map.get(sex, "Unknown")

        return {
            "patient_id": subject_info.get("his_id", "X"),
            "sex": sex_str,
            "age": subject_info.get("age", None),
        }

    def __del__(self):
        """Cleanup"""
        if self.raw is not None:
            del self.raw
