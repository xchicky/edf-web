"""
Mode data models for EEG viewing mode management
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime
import time


class OperandDefinition(BaseModel):
    """操作数定义 - 派生信号表达式中引用的通道"""
    id: str
    channelName: str
    channelIndex: int
    coefficient: Optional[float] = 1.0


class ModeSignalConfig(BaseModel):
    """模式中的派生信号配置"""
    id: str
    name: str
    expression: str
    operands: List[OperandDefinition]
    color: Optional[str] = None
    enabled: bool


class DisplayChannel(BaseModel):
    """显示通道配置"""
    channelName: str
    channelIndex: int
    color: Optional[str] = None
    scale: Optional[float] = None
    visible: bool


class BandConfig(BaseModel):
    """频带配置"""
    name: str
    range: List[float]  # [min, max]
    enabled: bool
    color: Optional[str] = None

    @field_validator("range")
    @classmethod
    def validate_range(cls, v):
        if len(v) != 2:
            raise ValueError("Range must have exactly 2 values")
        if v[0] >= v[1]:
            raise ValueError("Range min must be less than max")
        if v[0] < 0 or v[1] < 0:
            raise ValueError("Range values must be non-negative")
        return v


class AnalysisParams(BaseModel):
    """分析参数"""
    enabled: bool
    type: Literal["stats", "frequency", "comprehensive"]
    autoUpdate: bool
    updateInterval: Optional[int] = None

    @field_validator("updateInterval")
    @classmethod
    def validate_update_interval(cls, v, info):
        if info.data.get("autoUpdate") and v is None:
            raise ValueError("updateInterval is required when autoUpdate is true")
        if v is not None and v < 100:
            raise ValueError("updateInterval must be at least 100ms")
        return v


class ModeConfig(BaseModel):
    """模式配置"""
    viewMode: Literal["waveform", "frequency", "topography", "3d"]
    timeWindow: float = Field(gt=0, description="Time window in seconds")
    amplitudeScale: float = Field(gt=0, description="Amplitude scale factor")
    showGrid: bool
    showAnnotations: bool
    displayChannels: List[DisplayChannel]
    enableFilter: bool
    filterHighPass: Optional[float] = Field(None, ge=0, description="High-pass filter frequency in Hz")
    filterLowPass: Optional[float] = Field(None, ge=0, description="Low-pass filter frequency in Hz")
    bands: List[BandConfig]
    signals: Optional[List[ModeSignalConfig]] = None
    analysis: AnalysisParams
    autoSave: bool
    maxBookmarks: int = Field(ge=0, description="Maximum number of bookmarks")


class ModeBase(BaseModel):
    """Mode base fields"""
    name: str = Field(min_length=1, max_length=100)
    category: Literal["clinical", "research", "education", "custom"]
    description: Optional[str] = None
    config: ModeConfig
    tags: List[str] = Field(default_factory=list)


class ModeCreateRequest(ModeBase):
    """Request to create a new mode"""
    pass


class ModeUpdateRequest(BaseModel):
    """Request to update a mode"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[Literal["clinical", "research", "education", "custom"]] = None
    description: Optional[str] = None
    config: Optional[ModeConfig] = None
    tags: Optional[List[str]] = None
    isFavorite: Optional[bool] = None


class Mode(ModeBase):
    """完整的模式定义"""
    id: str
    createdAt: float
    modifiedAt: float
    createdBy: Optional[str] = None
    isBuiltIn: bool
    isFavorite: bool = False
    usageCount: int = 0
    lastUsedAt: Optional[float] = None
    requiredChannels: Optional[List[str]] = None
    minSamplingRate: Optional[float] = None


class ModeListResponse(BaseModel):
    """模式列表响应"""
    modes: List[Mode]
    total: int
    categories: List[Literal["clinical", "research", "education", "custom"]]


class CompatibilityIssue(BaseModel):
    """兼容性问题"""
    type: Literal["missing_channel", "low_sampling_rate", "config_conflict", "other"]
    severity: Literal["error", "warning"]
    message: str
    suggestion: Optional[str] = None


class CompatibilityCheckRequest(BaseModel):
    """兼容性检查请求"""
    mode_id: str
    channel_names: List[str]
    sampling_rate: float = Field(gt=0)
    duration: Optional[float] = Field(None, gt=0)


class CompatibilityCheckResponse(BaseModel):
    """兼容性检查响应"""
    is_compatible: bool
    issues: List[CompatibilityIssue]
    warnings: List[str]
    can_apply_with_fixes: bool


class ModeUsageStats(BaseModel):
    """模式使用统计"""
    mode_id: str
    mode_name: str
    total_uses: int
    last_used_at: Optional[float]
    first_used_at: Optional[float]
    avg_session_duration: Optional[float] = None


class RecommendModesRequest(BaseModel):
    """推荐模式请求"""
    channel_names: List[str]
    sampling_rate: float = Field(gt=0)
    context: Optional[Dict[str, Any]] = None


class RecommendModesResponse(BaseModel):
    """推荐模式响应"""
    modes: List[Mode]


class ApplyModeRequest(BaseModel):
    """应用模式请求"""
    file_id: str
    auto_load_data: bool = True
    preserve_bookmarks: bool = True


class ApplyModeResponse(BaseModel):
    """应用模式响应"""
    success: bool
    mode: Mode
    appliedConfig: Dict[str, Any]
    issues: List[CompatibilityIssue]


class DuplicateModeRequest(BaseModel):
    """复制模式请求"""
    new_name: Optional[str] = None
