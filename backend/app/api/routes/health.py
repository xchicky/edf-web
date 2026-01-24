"""Health check endpoint for monitoring and load balancers"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import config


class HealthResponse(BaseModel):
    """Health check response model"""

    status: str
    version: str
    storage_path: str


router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring

    Returns:
        HealthResponse: Service health status
    """
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        storage_path=str(config.STORAGE_PATH.absolute()),
    )
