"""
FastAPI application for EDF file processing
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="EDF Viewer API",
    description="Backend API for EDF/EEG file viewing and analysis",
    version="1.0.0",
)

# CORS middleware - Critical for frontend-backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:3000",  # React default
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "EDF Viewer API", "docs": "/docs", "health": "/health"}


from app.api.routes import upload, metadata, waveform, waveform_overview

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(metadata.router, prefix="/api/metadata", tags=["metadata"])
app.include_router(waveform.router, prefix="/api/waveform", tags=["waveform"])
app.include_router(
    waveform_overview.router,
    prefix="/api/waveform_overview",
    tags=["waveform_overview"],
)
