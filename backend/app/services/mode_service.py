"""
Mode service - Business logic for mode management
"""

import json
import uuid
import time
import os
from typing import List, Optional, Dict, Any
from pathlib import Path

from app.models.mode import (
    Mode,
    ModeCreateRequest,
    ModeUpdateRequest,
    CompatibilityCheckResponse,
    CompatibilityIssue,
    ModeUsageStats,
)


# Storage paths
MODES_DIR = Path(__file__).parent.parent.parent / "storage" / "modes"
MODES_FILE = MODES_DIR / "custom_modes.json"
STATS_FILE = MODES_DIR / "usage_stats.json"


# Built-in modes (hardcoded)
BUILT_IN_MODES = [
    {
        "id": "mode-clinical-standard",
        "name": "临床标准模式",
        "category": "clinical",
        "description": "标准临床 EEG 分析视图，包含常用通道和基本分析",
        "config": {
            "viewMode": "waveform",
            "timeWindow": 10,
            "amplitudeScale": 1.0,
            "showGrid": True,
            "showAnnotations": True,
            "displayChannels": [
                {"channelName": "Fp1", "channelIndex": 0, "visible": True},
                {"channelName": "Fp2", "channelIndex": 1, "visible": True},
                {"channelName": "F3", "channelIndex": 2, "visible": True},
                {"channelName": "F4", "channelIndex": 3, "visible": True},
                {"channelName": "C3", "channelIndex": 4, "visible": True},
                {"channelName": "C4", "channelIndex": 5, "visible": True},
                {"channelName": "O1", "channelIndex": 6, "visible": True},
                {"channelName": "O2", "channelIndex": 7, "visible": True},
            ],
            "enableFilter": True,
            "filterHighPass": 0.5,
            "filterLowPass": 70,
            "bands": [
                {"name": "delta", "range": [0.5, 4], "enabled": True, "color": "#6366f1"},
                {"name": "theta", "range": [4, 8], "enabled": True, "color": "#8b5cf6"},
                {"name": "alpha", "range": [8, 13], "enabled": True, "color": "#ec4899"},
                {"name": "beta", "range": [13, 30], "enabled": True, "color": "#f59e0b"},
            ],
            "signals": [
                {
                    "id": "sig-fp1-f3-diff",
                    "name": "Fp1-F3 差值",
                    "expression": "Fp1 - F3",
                    "operands": [
                        {"id": "op-fp1", "channelName": "Fp1", "channelIndex": 0},
                        {"id": "op-f3", "channelName": "F3", "channelIndex": 2},
                    ],
                    "color": "#ef4444",
                    "enabled": True,
                },
                {
                    "id": "sig-fp2-f4-diff",
                    "name": "Fp2-F4 差值",
                    "expression": "Fp2 - F4",
                    "operands": [
                        {"id": "op-fp2", "channelName": "Fp2", "channelIndex": 1},
                        {"id": "op-f4", "channelName": "F4", "channelIndex": 3},
                    ],
                    "color": "#f59e0b",
                    "enabled": True,
                },
            ],
            "analysis": {
                "enabled": True,
                "type": "comprehensive",
                "autoUpdate": False,
            },
            "autoSave": True,
            "maxBookmarks": 50,
        },
        "createdAt": time.time(),
        "modifiedAt": time.time(),
        "isBuiltIn": True,
        "isFavorite": False,
        "usageCount": 0,
        "tags": ["临床", "标准", "诊断"],
        "requiredChannels": None,
        "minSamplingRate": None,
    },
    {
        "id": "mode-research-spectral",
        "name": "频谱研究模式",
        "category": "research",
        "description": "专注于频域分析的科研模式，包含完整频带和高级分析",
        "config": {
            "viewMode": "frequency",
            "timeWindow": 5,
            "amplitudeScale": 1.0,
            "showGrid": True,
            "showAnnotations": False,
            "displayChannels": [
                {"channelName": "Fz", "channelIndex": 0, "visible": True},
                {"channelName": "Cz", "channelIndex": 1, "visible": True},
                {"channelName": "Pz", "channelIndex": 2, "visible": True},
            ],
            "enableFilter": True,
            "filterHighPass": 0.5,
            "filterLowPass": 100,
            "bands": [
                {"name": "delta", "range": [0.5, 4], "enabled": True, "color": "#6366f1"},
                {"name": "theta", "range": [4, 8], "enabled": True, "color": "#8b5cf6"},
                {"name": "alpha", "range": [8, 13], "enabled": True, "color": "#ec4899"},
                {"name": "beta", "range": [13, 30], "enabled": True, "color": "#f59e0b"},
                {"name": "gamma", "range": [30, 50], "enabled": True, "color": "#10b981"},
            ],
            "signals": [
                {
                    "id": "sig-fz-cz-diff",
                    "name": "Fz-Cz 差值",
                    "expression": "Fz - Cz",
                    "operands": [
                        {"id": "op-fz", "channelName": "Fz", "channelIndex": 0},
                        {"id": "op-cz", "channelName": "Cz", "channelIndex": 1},
                    ],
                    "color": "#8b5cf6",
                    "enabled": True,
                },
                {
                    "id": "sig-cz-pz-diff",
                    "name": "Cz-Pz 差值",
                    "expression": "Cz - Pz",
                    "operands": [
                        {"id": "op-cz2", "channelName": "Cz", "channelIndex": 1},
                        {"id": "op-pz", "channelName": "Pz", "channelIndex": 2},
                    ],
                    "color": "#ec4899",
                    "enabled": True,
                },
            ],
            "analysis": {
                "enabled": True,
                "type": "frequency",
                "autoUpdate": True,
                "updateInterval": 1000,
            },
            "autoSave": True,
            "maxBookmarks": 100,
        },
        "createdAt": time.time(),
        "modifiedAt": time.time(),
        "isBuiltIn": True,
        "isFavorite": False,
        "usageCount": 0,
        "requiredChannels": ["Fz", "Cz", "Pz"],
        "minSamplingRate": 100,
        "tags": ["科研", "频谱", "高级"],
    },
    {
        "id": "mode-education-basic",
        "name": "基础教学模式",
        "category": "education",
        "description": "简化视图，适合教学演示和学生练习",
        "config": {
            "viewMode": "waveform",
            "timeWindow": 15,
            "amplitudeScale": 1.5,
            "showGrid": True,
            "showAnnotations": True,
            "displayChannels": [
                {"channelName": "Fp1", "channelIndex": 0, "visible": True},
                {"channelName": "Fp2", "channelIndex": 1, "visible": True},
            ],
            "enableFilter": False,
            "filterHighPass": None,
            "filterLowPass": None,
            "bands": [
                {"name": "alpha", "range": [8, 13], "enabled": True, "color": "#ec4899"},
                {"name": "beta", "range": [13, 30], "enabled": True, "color": "#f59e0b"},
            ],
            "analysis": {
                "enabled": False,
                "type": "stats",
                "autoUpdate": False,
            },
            "autoSave": False,
            "maxBookmarks": 20,
        },
        "createdAt": time.time(),
        "modifiedAt": time.time(),
        "isBuiltIn": True,
        "isFavorite": False,
        "usageCount": 0,
        "tags": ["教学", "基础", "演示"],
        "requiredChannels": None,
        "minSamplingRate": None,
    },
]


class ModeService:
    """Service for managing modes"""

    def __init__(self):
        """Initialize the mode service"""
        self._ensure_directories()
        self._custom_modes: Dict[str, Dict[str, Any]] = self._load_custom_modes()
        self._usage_stats: Dict[str, Dict[str, Any]] = self._load_usage_stats()

    def _ensure_directories(self):
        """Ensure storage directories exist"""
        MODES_DIR.mkdir(parents=True, exist_ok=True)

    def _load_custom_modes(self) -> Dict[str, Dict[str, Any]]:
        """Load custom modes from JSON file"""
        if not MODES_FILE.exists():
            return {}
        try:
            with open(MODES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def _save_custom_modes(self):
        """Save custom modes to JSON file"""
        with open(MODES_FILE, "w", encoding="utf-8") as f:
            json.dump(self._custom_modes, f, ensure_ascii=False, indent=2)

    def _load_usage_stats(self) -> Dict[str, Dict[str, Any]]:
        """Load usage stats from JSON file"""
        if not STATS_FILE.exists():
            return {}
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def _save_usage_stats(self):
        """Save usage stats to JSON file"""
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(self._usage_stats, f, ensure_ascii=False, indent=2)

    def get_all_modes(
        self,
        category: Optional[str] = None,
        include_built_in: bool = True,
        include_custom: bool = True,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Get all modes with optional filtering

        Returns:
            Tuple of (modes list, total count)
        """
        modes = []

        # Add built-in modes
        if include_built_in:
            if category is None:
                modes.extend(BUILT_IN_MODES)
            else:
                modes.extend([m for m in BUILT_IN_MODES if m["category"] == category])

        # Add custom modes
        if include_custom:
            custom_modes_list = list(self._custom_modes.values())
            if category is None:
                modes.extend(custom_modes_list)
            else:
                modes.extend([m for m in custom_modes_list if m["category"] == category])

        # Apply pagination
        total = len(modes)
        if offset > 0:
            modes = modes[offset:]
        if limit is not None:
            modes = modes[:limit]

        return modes, total

    def get_mode_by_id(self, mode_id: str) -> Optional[Dict[str, Any]]:
        """Get a mode by ID"""
        # Check built-in modes
        for mode in BUILT_IN_MODES:
            if mode["id"] == mode_id:
                return mode.copy()

        # Check custom modes
        return self._custom_modes.get(mode_id)

    def is_built_in(self, mode_id: str) -> bool:
        """Check if a mode is built-in"""
        return any(mode["id"] == mode_id for mode in BUILT_IN_MODES)

    def create_mode(self, request: ModeCreateRequest) -> Dict[str, Any]:
        """Create a new custom mode"""
        mode_id = f"mode-custom-{uuid.uuid4().hex[:12]}"
        now = time.time()

        mode_data = {
            "id": mode_id,
            "name": request.name,
            "category": request.category,
            "description": request.description,
            "config": request.config.model_dump(),
            "tags": request.tags,
            "createdAt": now,
            "modifiedAt": now,
            "createdBy": None,
            "isBuiltIn": False,
            "isFavorite": False,
            "usageCount": 0,
            "lastUsedAt": None,
            "requiredChannels": None,
            "minSamplingRate": None,
        }

        self._custom_modes[mode_id] = mode_data
        self._save_custom_modes()

        return mode_data

    def update_mode(self, mode_id: str, updates: ModeUpdateRequest) -> Optional[Dict[str, Any]]:
        """Update a custom mode"""
        if self.is_built_in(mode_id):
            return None  # Cannot update built-in modes

        if mode_id not in self._custom_modes:
            return None

        mode = self._custom_modes[mode_id]

        # Update fields
        if updates.name is not None:
            mode["name"] = updates.name
        if updates.category is not None:
            mode["category"] = updates.category
        if updates.description is not None:
            mode["description"] = updates.description
        if updates.config is not None:
            mode["config"] = updates.config.model_dump()
        if updates.tags is not None:
            mode["tags"] = updates.tags
        if updates.isFavorite is not None:
            mode["isFavorite"] = updates.isFavorite

        mode["modifiedAt"] = time.time()
        self._save_custom_modes()

        return mode.copy()

    def delete_mode(self, mode_id: str) -> bool:
        """Delete a custom mode"""
        if self.is_built_in(mode_id):
            return False  # Cannot delete built-in modes

        if mode_id not in self._custom_modes:
            return False

        del self._custom_modes[mode_id]
        self._save_custom_modes()

        # Also delete usage stats
        if mode_id in self._usage_stats:
            del self._usage_stats[mode_id]
            self._save_usage_stats()

        return True

    def check_compatibility(
        self,
        mode_id: str,
        channel_names: List[str],
        sampling_rate: float,
        duration: Optional[float] = None,
    ) -> CompatibilityCheckResponse:
        """Check if a mode is compatible with given parameters"""
        mode = self.get_mode_by_id(mode_id)
        if mode is None:
            raise ValueError(f"Mode not found: {mode_id}")

        issues = []
        warnings = []

        # Check required channels
        required_channels = mode.get("requiredChannels")
        if required_channels:
            missing_channels = [ch for ch in required_channels if ch not in channel_names]
            if missing_channels:
                issues.append(
                    CompatibilityIssue(
                        type="missing_channel",
                        severity="error",
                        message=f"Missing required channels: {', '.join(missing_channels)}",
                        suggestion=f"Ensure the file includes these channels: {', '.join(missing_channels)}",
                    )
                )

        # Check sampling rate
        min_sampling_rate = mode.get("minSamplingRate")
        if min_sampling_rate and sampling_rate < min_sampling_rate:
            issues.append(
                CompatibilityIssue(
                    type="low_sampling_rate",
                    severity="error",
                    message=f"Sampling rate {sampling_rate} Hz is below required {min_sampling_rate} Hz",
                    suggestion=f"Use a file with at least {min_sampling_rate} Hz sampling rate",
                )
            )

        # Check display channels
        display_channels = mode.get("config", {}).get("displayChannels", [])
        missing_display_channels = [
            ch["channelName"]
            for ch in display_channels
            if ch["channelName"] not in channel_names
        ]
        if missing_display_channels:
            warnings.append(
                f"Some display channels are not available: {', '.join(missing_display_channels)}"
            )

        can_apply_with_fixes = all(
            issue.type in ["low_sampling_rate"] for issue in issues
        ) or len(issues) == 0

        return CompatibilityCheckResponse(
            is_compatible=len(issues) == 0,
            issues=issues,
            warnings=warnings,
            can_apply_with_fixes=can_apply_with_fixes,
        )

    def record_usage(self, mode_id: str) -> bool:
        """Record mode usage"""
        mode = self.get_mode_by_id(mode_id)
        if mode is None:
            return False

        now = time.time()

        # Initialize stats if not exists
        if mode_id not in self._usage_stats:
            self._usage_stats[mode_id] = {
                "first_used_at": now,
                "last_used_at": now,
                "total_uses": 0,
                "session_durations": [],
            }

        self._usage_stats[mode_id]["last_used_at"] = now
        self._usage_stats[mode_id]["total_uses"] += 1

        self._save_usage_stats()

        # For built-in modes, we can't update the mode itself
        # But for custom modes, update the mode data
        if not self.is_built_in(mode_id) and mode_id in self._custom_modes:
            self._custom_modes[mode_id]["usageCount"] += 1
            self._custom_modes[mode_id]["lastUsedAt"] = now
            self._save_custom_modes()

        return True

    def get_stats(self, mode_id: str) -> Optional[ModeUsageStats]:
        """Get usage statistics for a mode"""
        mode = self.get_mode_by_id(mode_id)
        if mode is None:
            return None

        stats = self._usage_stats.get(mode_id, {})

        # Calculate average session duration
        session_durations = stats.get("session_durations", [])
        avg_duration = sum(session_durations) / len(session_durations) if session_durations else None

        return ModeUsageStats(
            mode_id=mode_id,
            mode_name=mode["name"],
            total_uses=mode.get("usageCount", stats.get("total_uses", 0)),
            last_used_at=mode.get("lastUsedAt", stats.get("last_used_at")),
            first_used_at=stats.get("first_used_at"),
            avg_session_duration=avg_duration,
        )

    def toggle_favorite(self, mode_id: str) -> Optional[Dict[str, Any]]:
        """Toggle favorite status of a mode"""
        if self.is_built_in(mode_id):
            return None  # Cannot modify built-in modes

        if mode_id not in self._custom_modes:
            return None

        mode = self._custom_modes[mode_id]
        mode["isFavorite"] = not mode.get("isFavorite", False)
        mode["modifiedAt"] = time.time()
        self._save_custom_modes()

        return mode.copy()

    def duplicate_mode(self, mode_id: str, new_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Duplicate a mode"""
        mode = self.get_mode_by_id(mode_id)
        if mode is None:
            return None

        now = time.time()
        new_mode_id = f"mode-custom-{uuid.uuid4().hex[:12]}"

        new_mode = mode.copy()
        new_mode["id"] = new_mode_id
        new_mode["name"] = new_name or f"{mode['name']} (Copy)"
        new_mode["createdAt"] = now
        new_mode["modifiedAt"] = now
        new_mode["isBuiltIn"] = False
        new_mode["isFavorite"] = False
        new_mode["usageCount"] = 0
        new_mode["lastUsedAt"] = None

        self._custom_modes[new_mode_id] = new_mode
        self._save_custom_modes()

        return new_mode.copy()

    def reset_mode(self, mode_id: str) -> Optional[Dict[str, Any]]:
        """Reset a mode to its default configuration"""
        # For custom modes, reset to default config
        if self.is_built_in(mode_id):
            return None  # Built-in modes don't need reset

        if mode_id not in self._custom_modes:
            return None

        # Reset to a sensible default
        mode = self._custom_modes[mode_id]
        mode["config"] = {
            "viewMode": "waveform",
            "timeWindow": 10,
            "amplitudeScale": 1.0,
            "showGrid": True,
            "showAnnotations": True,
            "displayChannels": [],
            "enableFilter": False,
            "bands": [
                {"name": "delta", "range": [0.5, 4], "enabled": True, "color": "#6366f1"},
                {"name": "theta", "range": [4, 8], "enabled": True, "color": "#8b5cf6"},
                {"name": "alpha", "range": [8, 13], "enabled": True, "color": "#ec4899"},
                {"name": "beta", "range": [13, 30], "enabled": True, "color": "#f59e0b"},
            ],
            "analysis": {
                "enabled": False,
                "type": "stats",
                "autoUpdate": False,
            },
            "autoSave": True,
            "maxBookmarks": 50,
        }
        mode["modifiedAt"] = time.time()
        self._save_custom_modes()

        return mode.copy()

    def recommend_modes(
        self,
        channel_names: List[str],
        sampling_rate: float,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Get recommended modes based on context"""
        all_modes, _ = self.get_all_modes()

        scored_modes = []
        for mode in all_modes:
            # Check compatibility
            try:
                compat = self.check_compatibility(mode["id"], channel_names, sampling_rate)
                score = 1.0 if compat.is_compatible else 0.5

                # Boost score based on category and context
                if context:
                    purpose = context.get("purpose", "")
                    if "clinical" in purpose and mode["category"] == "clinical":
                        score += 0.3
                    elif "research" in purpose and mode["category"] == "research":
                        score += 0.3
                    elif "education" in purpose and mode["category"] == "education":
                        score += 0.3

                scored_modes.append((mode, score))
            except ValueError:
                continue

        # Sort by score and return top recommendations
        scored_modes.sort(key=lambda x: x[1], reverse=True)
        return [mode for mode, _ in scored_modes[:5]]


# Global service instance
_mode_service: Optional[ModeService] = None


def get_mode_service() -> ModeService:
    """Get the global mode service instance"""
    global _mode_service
    if _mode_service is None:
        _mode_service = ModeService()
    return _mode_service
