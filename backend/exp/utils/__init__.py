"""
实验工具模块

提供实验框架使用的各种工具函数和类。
"""

from exp.utils.visualization import (
    plot_time_domain,
    plot_frequency_domain,
    plot_spectrogram,
    plot_comparison,
    plot_raster
)

from exp.utils.metrics import (
    calculate_snr,
    calculate_sar,
    mse,
    rmse,
    band_power_error,
    spectral_centroid,
    spectral_flatness
)

from exp.utils.analysis_validator import (
    AnalysisValidator,
    ValidationResult
)

__all__ = [
    # 可视化工具
    'plot_time_domain',
    'plot_frequency_domain',
    'plot_spectrogram',
    'plot_comparison',
    'plot_raster',

    # 指标工具
    'calculate_snr',
    'calculate_sar',
    'mse',
    'rmse',
    'band_power_error',
    'spectral_centroid',
    'spectral_flatness',

    # 验证工具
    'AnalysisValidator',
    'ValidationResult',
]
