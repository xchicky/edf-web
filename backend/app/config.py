"""Application configuration with environment variable support"""

import os
from pathlib import Path
from typing import List


class Config:
    """Application configuration"""

    # Server
    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    APP_DEBUG: bool = os.getenv("APP_DEBUG", "false").lower() == "true"

    # Storage
    STORAGE_PATH: Path = Path(os.getenv("STORAGE_PATH", "./storage"))
    MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", "104857600"))  # 100MB
    ALLOWED_EXTENSIONS: List[str] = os.getenv(
        "ALLOWED_EXTENSIONS", ".edf,.edf++"
    ).split(",")

    # CORS
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    def __init__(self):
        """Validate configuration on initialization"""
        self.STORAGE_PATH.mkdir(parents=True, exist_ok=True)


config = Config()
