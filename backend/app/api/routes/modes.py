"""
Modes API endpoint - Manage EEG viewing modes
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from typing import List, Optional, Dict, Any
import logging

from app.models.mode import (
    Mode,
    ModeCreateRequest,
    ModeUpdateRequest,
    ModeListResponse,
    CompatibilityCheckRequest,
    CompatibilityCheckResponse,
    ModeUsageStats,
    RecommendModesRequest,
    RecommendModesResponse,
    ApplyModeRequest,
    ApplyModeResponse,
    DuplicateModeRequest,
)
from app.services.mode_service import get_mode_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Valid categories
VALID_CATEGORIES = ["clinical", "research", "education", "custom"]


@router.get("/", response_model=ModeListResponse)
async def get_all_modes(
    category: Optional[str] = Query(None, description="Filter by category"),
    include_built_in: bool = Query(True, description="Include built-in modes"),
    include_custom: bool = Query(True, description="Include custom modes"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """
    Get all modes with optional filtering

    - **category**: Filter by mode category (clinical, research, education, custom)
    - **include_built_in**: Whether to include built-in modes
    - **include_custom**: Whether to include custom user-created modes
    - **limit**: Maximum number of modes to return
    - **offset**: Number of modes to skip for pagination
    """
    try:
        # Validate category if provided
        if category and category not in VALID_CATEGORIES:
            return ModeListResponse(modes=[], total=0, categories=VALID_CATEGORIES)

        service = get_mode_service()
        modes, total = service.get_all_modes(
            category=category,
            include_built_in=include_built_in,
            include_custom=include_custom,
            limit=limit,
            offset=offset,
        )

        return ModeListResponse(
            modes=modes,
            total=total,
            categories=VALID_CATEGORIES,
        )

    except Exception as e:
        logger.error(f"Error getting modes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get modes: {str(e)}")


@router.get("/categories")
async def get_mode_categories():
    """
    Get all available mode categories

    Returns a dictionary with the key 'categories' containing all valid categories
    """
    return {"categories": VALID_CATEGORIES}


@router.post("/check-compatibility", response_model=CompatibilityCheckResponse)
async def check_compatibility(request: CompatibilityCheckRequest):
    """
    Check if a mode is compatible with the given EEG file parameters

    - **mode_id**: ID of the mode to check
    - **channel_names**: List of available channel names
    - **sampling_rate**: Sampling rate in Hz
    - **duration**: Optional duration in seconds
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(request.mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {request.mode_id}")

    try:
        result = service.check_compatibility(
            request.mode_id,
            request.channel_names,
            request.sampling_rate,
            request.duration,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error checking compatibility: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check compatibility: {str(e)}")


@router.post("/batch-check-compatibility")
async def batch_check_compatibility(request: Dict[str, Any]):
    """
    Check compatibility for multiple modes at once

    - **requests**: List of compatibility check requests
    """
    service = get_mode_service()

    results = []
    for req in request.get("requests", []):
        try:
            result = service.check_compatibility(
                req["mode_id"],
                req["channel_names"],
                req["sampling_rate"],
                req.get("duration"),
            )
            results.append({
                "mode_id": req["mode_id"],
                **result.model_dump(),
            })
        except ValueError:
            results.append({
                "mode_id": req["mode_id"],
                "is_compatible": False,
                "issues": [],
                "warnings": ["Mode not found"],
                "can_apply_with_fixes": False,
            })

    return {"results": results}


@router.post("/recommend", response_model=RecommendModesResponse)
async def recommend_modes(request: RecommendModesRequest):
    """
    Get recommended modes based on available channels and context

    - **channel_names**: List of available channel names
    - **sampling_rate**: Sampling rate in Hz
    - **context**: Optional context (purpose, user_level, etc.)
    """
    try:
        service = get_mode_service()
        modes = service.recommend_modes(
            request.channel_names,
            request.sampling_rate,
            request.context,
        )
        return RecommendModesResponse(modes=modes)

    except Exception as e:
        logger.error(f"Error recommending modes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to recommend modes: {str(e)}")


@router.post("/import", response_model=Mode, status_code=201)
async def import_mode(mode_data: Dict[str, Any]):
    """
    Import a mode from JSON

    - **mode_data**: Dictionary containing mode data
    """
    try:
        # Remove fields that should be regenerated or aren't part of ModeCreateRequest
        data = mode_data.copy()
        # Remove Mode-specific fields
        data.pop("id", None)
        data.pop("createdAt", None)
        data.pop("modifiedAt", None)
        data.pop("createdBy", None)
        data.pop("isBuiltIn", None)
        data.pop("isFavorite", None)
        data.pop("usageCount", None)
        data.pop("lastUsedAt", None)
        data.pop("requiredChannels", None)
        data.pop("minSamplingRate", None)

        # Create as new mode - ModeCreateRequest will validate the structure
        request = ModeCreateRequest(**data)
        service = get_mode_service()
        mode = service.create_mode(request)

        logger.info(f"Imported mode: {mode['id']}")
        return mode

    except Exception as e:
        logger.error(f"Error importing mode: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to import mode: {str(e)}")


@router.post("/", response_model=Mode, status_code=201)
async def create_mode(request: ModeCreateRequest):
    """
    Create a new custom mode

    - **name**: Mode name (1-100 characters)
    - **category**: Mode category (clinical, research, education, custom)
    - **description**: Optional description
    - **config**: Mode configuration
    - **tags**: Optional list of tags
    """
    try:
        service = get_mode_service()
        mode = service.create_mode(request)
        logger.info(f"Created new mode: {mode['id']}")
        return mode

    except Exception as e:
        logger.error(f"Error creating mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create mode: {str(e)}")


@router.get("/{mode_id}", response_model=Mode)
async def get_mode_by_id(mode_id: str):
    """
    Get a specific mode by ID

    - **mode_id**: Unique identifier of the mode
    """
    service = get_mode_service()
    mode = service.get_mode_by_id(mode_id)

    if mode is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    return mode


@router.put("/{mode_id}", response_model=Mode)
async def update_mode(mode_id: str, updates: ModeUpdateRequest):
    """
    Update an existing custom mode

    - **mode_id**: ID of the mode to update
    - **updates**: Fields to update (all optional)

    Note: Built-in modes cannot be modified
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    # Check if built-in
    if service.is_built_in(mode_id):
        raise HTTPException(
            status_code=403,
            detail="Cannot modify built-in modes",
        )

    try:
        updated_mode = service.update_mode(mode_id, updates)
        if updated_mode is None:
            raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

        logger.info(f"Updated mode: {mode_id}")
        return updated_mode

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update mode: {str(e)}")


@router.delete("/{mode_id}")
async def delete_mode(mode_id: str):
    """
    Delete a custom mode

    - **mode_id**: ID of the mode to delete

    Note: Built-in modes cannot be deleted
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    # Check if built-in
    if service.is_built_in(mode_id):
        raise HTTPException(
            status_code=403,
            detail="Cannot delete built-in modes",
        )

    try:
        success = service.delete_mode(mode_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

        logger.info(f"Deleted mode: {mode_id}")
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete mode: {str(e)}")


@router.post("/{mode_id}/use", status_code=200)
async def record_mode_usage(mode_id: str):
    """
    Record usage of a mode (analytics)

    - **mode_id**: ID of the mode being used
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    try:
        service.record_usage(mode_id)
        return {"success": True}

    except Exception as e:
        logger.error(f"Error recording usage: {e}")
        # Don't fail the request, just log the error
        return {"success": False}


@router.get("/{mode_id}/stats", response_model=ModeUsageStats)
async def get_mode_stats(mode_id: str):
    """
    Get usage statistics for a mode

    - **mode_id**: ID of the mode
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    try:
        stats = service.get_stats(mode_id)
        if stats is None:
            raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

        return stats

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.post("/{mode_id}/favorite", response_model=Mode)
async def toggle_mode_favorite(mode_id: str):
    """
    Toggle the favorite status of a mode

    - **mode_id**: ID of the mode

    Note: Only custom modes can be favorited
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    # Check if built-in
    if service.is_built_in(mode_id):
        raise HTTPException(
            status_code=403,
            detail="Cannot modify built-in modes",
        )

    try:
        updated_mode = service.toggle_favorite(mode_id)
        if updated_mode is None:
            raise HTTPException(status_code=404, detail=f"Mode not found")

        return updated_mode

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")


@router.post("/{mode_id}/duplicate", response_model=Mode, status_code=201)
async def duplicate_mode(mode_id: str, request: DuplicateModeRequest):
    """
    Duplicate a mode

    - **mode_id**: ID of the mode to duplicate
    - **new_name**: Optional name for the duplicate
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    try:
        new_mode = service.duplicate_mode(mode_id, request.new_name)
        if new_mode is None:
            raise HTTPException(status_code=404, detail=f"Mode not found")

        logger.info(f"Duplicated mode: {mode_id} -> {new_mode['id']}")
        return new_mode

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error duplicating mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to duplicate mode: {str(e)}")


@router.get("/{mode_id}/export")
async def export_mode(mode_id: str):
    """
    Export a mode as JSON

    - **mode_id**: ID of the mode to export
    """
    service = get_mode_service()

    # Check if mode exists
    mode = service.get_mode_by_id(mode_id)
    if mode is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    try:
        import json
        json_str = json.dumps(mode, ensure_ascii=False, indent=2)
        return Response(content=json_str, media_type="application/json")

    except Exception as e:
        logger.error(f"Error exporting mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export mode: {str(e)}")


@router.post("/{mode_id}/reset", response_model=Mode)
async def reset_mode(mode_id: str):
    """
    Reset a mode to its default configuration

    - **mode_id**: ID of the mode to reset

    Note: Only applies to custom modes
    """
    service = get_mode_service()

    # Check if mode exists
    if service.get_mode_by_id(mode_id) is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    # Check if built-in
    if service.is_built_in(mode_id):
        raise HTTPException(
            status_code=400,
            detail="Built-in modes cannot be reset",
        )

    try:
        reset_mode_data = service.reset_mode(mode_id)
        if reset_mode_data is None:
            raise HTTPException(status_code=404, detail=f"Mode not found")

        return reset_mode_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset mode: {str(e)}")


@router.post("/{mode_id}/apply", response_model=ApplyModeResponse)
async def apply_mode(mode_id: str, request: ApplyModeRequest):
    """
    Apply a mode to a file

    - **mode_id**: ID of the mode to apply
    - **file_id**: ID of the file to apply the mode to
    - **auto_load_data**: Whether to automatically load data
    - **preserve_bookmarks**: Whether to preserve existing bookmarks
    """
    service = get_mode_service()

    # Check if mode exists
    mode = service.get_mode_by_id(mode_id)
    if mode is None:
        raise HTTPException(status_code=404, detail=f"Mode not found: {mode_id}")

    try:
        # Check compatibility
        # For now, we'll return a basic response
        # In a real implementation, you would:
        # 1. Get file metadata to check channel names and sampling rate
        # 2. Run compatibility check
        # 3. Apply the mode configuration

        from app.models.mode import CompatibilityIssue

        return ApplyModeResponse(
            success=True,
            mode=mode,
            appliedConfig=mode.get("config", {}),
            issues=[],
        )

    except Exception as e:
        logger.error(f"Error applying mode: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to apply mode: {str(e)}")
