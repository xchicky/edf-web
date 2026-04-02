"""
可视化工具模块

提供 EEG 信号分析的可视化函数。
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # 非交互式后端
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
import numpy.typing as npt


# EEG 频带颜色定义
BAND_COLORS = {
    "delta": "purple",
    "theta": "blue",
    "alpha": "green",
    "beta": "orange",
    "gamma": "red",
}

BAND_RANGES = {
    "delta": (0.5, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta": (13, 30),
    "gamma": (30, 50),
}


def plot_time_domain(
    t: np.ndarray,
    signal: np.ndarray,
    title: str = "时域波形",
    xlabel: str = "时间 (秒)",
    ylabel: str = "振幅 (µV)",
    figsize: Tuple[int, int] = (12, 4),
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制时域波形图

    Args:
        t: 时间数组
        signal: 信号数组
        title: 图表标题
        xlabel: X轴标签
        ylabel: Y轴标签
        figsize: 图表大小
        save_path: 保存路径 (None 则不保存)

    Returns:
        matplotlib Figure 对象
    """
    fig, ax = plt.subplots(figsize=figsize)
    ax.plot(t, signal, linewidth=0.8)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.grid(True, alpha=0.3)

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig


def plot_frequency_domain(
    freqs: np.ndarray,
    psd: np.ndarray,
    title: str = "频域分析",
    xlabel: str = "频率 (Hz)",
    ylabel: str = "功率谱密度 (µV²/Hz)",
    figsize: Tuple[int, int] = (12, 6),
    freq_max: float = 50,
    show_bands: bool = True,
    log_scale: bool = True,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制频域分析图

    Args:
        freqs: 频率数组
        psd: 功率谱密度数组
        title: 图表标题
        xlabel: X轴标签
        ylabel: Y轴标签
        figsize: 图表大小
        freq_max: 最大显示频率
        show_bands: 是否显示频带区域
        log_scale: 是否使用对数坐标
        save_path: 保存路径

    Returns:
        matplotlib Figure 对象
    """
    fig, ax = plt.subplots(figsize=figsize)

    # 限制频率范围
    mask = freqs <= freq_max
    freqs_display = freqs[mask]
    psd_display = psd[mask]

    if log_scale:
        ax.semilogy(freqs_display, psd_display)
    else:
        ax.plot(freqs_display, psd_display)

    # 添加频带区域
    if show_bands:
        for band_name, (fmin, fmax) in BAND_RANGES.items():
            if fmax <= freq_max:
                ax.axvspan(fmin, fmax, alpha=0.15, color=BAND_COLORS[band_name])

        # 添加频带图例
        from matplotlib.patches import Patch
        legend_elements = [Patch(facecolor=BAND_COLORS[b], edgecolor='none',
                                label=f"{b.upper()} ({BAND_RANGES[b][0]}-{BAND_RANGES[b][1]} Hz)")
                          for b in BAND_COLORS]
        ax.legend(handles=legend_elements, loc='upper right')

    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(0, freq_max)

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig


def plot_spectrogram(
    signal: np.ndarray,
    sfreq: float,
    title: str = "频谱图",
    figsize: Tuple[int, int] = (12, 6),
    freq_max: float = 50,
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制时频谱图

    Args:
        signal: 信号数组
        sfreq: 采样率
        title: 图表标题
        figsize: 图表大小
        freq_max: 最大显示频率
        save_path: 保存路径

    Returns:
        matplotlib Figure 对象
    """
    from scipy import signal as scipy_signal

    fig, ax = plt.subplots(figsize=figsize)

    # 计算频谱图
    f, t, Sxx = scipy_signal.spectrogram(
        signal,
        sfreq,
        nperseg=min(256, len(signal) // 8),
        noverlap=None,
        mode='psd'
    )

    # 限制频率范围
    mask = f <= freq_max
    f_display = f[mask]
    Sxx_display = Sxx[mask, :]

    # 绘制
    im = ax.pcolormesh(t, f_display, 10 * np.log10(Sxx_display + 1e-10), shading='gouraud')
    ax.set_ylabel('频率 (Hz)')
    ax.set_xlabel('时间 (秒)')
    ax.set_title(title)
    ax.set_ylim(0, freq_max)

    # 添加颜色条
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('功率 (dB)')

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig


def plot_comparison(
    t: np.ndarray,
    signal1: np.ndarray,
    signal2: np.ndarray,
    label1: str = "原始信号",
    label2: str = "处理后信号",
    title: str = "信号对比",
    figsize: Tuple[int, int] = (12, 8),
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制信号对比图

    Args:
        t: 时间数组
        signal1: 第一个信号
        signal2: 第二个信号
        label1: 第一个信号标签
        label2: 第二个信号标签
        title: 图表标题
        figsize: 图表大小
        save_path: 保存路径

    Returns:
        matplotlib Figure 对象
    """
    fig, axes = plt.subplots(3, 1, figsize=figsize)

    # 原始信号
    axes[0].plot(t, signal1, 'b-', linewidth=0.8, label=label1)
    axes[0].set_ylabel('振幅 (µV)')
    axes[0].set_title(f'{title} - {label1}')
    axes[0].grid(True, alpha=0.3)
    axes[0].legend()

    # 处理后信号
    axes[1].plot(t, signal2, 'g-', linewidth=0.8, label=label2)
    axes[1].set_ylabel('振幅 (µV)')
    axes[1].set_title(f'{title} - {label2}')
    axes[1].grid(True, alpha=0.3)
    axes[1].legend()

    # 重叠对比
    axes[2].plot(t, signal1, 'b-', linewidth=0.5, label=label1, alpha=0.7)
    axes[2].plot(t, signal2, 'g-', linewidth=0.5, label=label2, alpha=0.7)
    axes[2].set_xlabel('时间 (秒)')
    axes[2].set_ylabel('振幅 (µV)')
    axes[2].set_title('重叠对比')
    axes[2].grid(True, alpha=0.3)
    axes[2].legend()

    plt.tight_layout()

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig


def plot_band_power_distribution(
    band_powers: Dict[str, Dict[str, float]],
    title: str = "频带功率分布",
    figsize: Tuple[int, int] = (10, 6),
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制频带功率分布柱状图

    Args:
        band_powers: 频带功率字典，格式: {band_name: {'relative': float, 'absolute': float}}
        title: 图表标题
        figsize: 图表大小
        save_path: 保存路径

    Returns:
        matplotlib Figure 对象
    """
    fig, ax = plt.subplots(figsize=figsize)

    bands = list(band_powers.keys())
    relative_powers = [band_powers[b]['relative'] for b in bands]
    colors = [BAND_COLORS.get(b, 'gray') for b in bands]

    bars = ax.bar([b.upper() for b in bands], relative_powers, color=colors, alpha=0.7)

    # 添加数值标签
    for bar, power in zip(bars, relative_powers):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2., height + 1,
                f'{power:.1f}%', ha='center', va='bottom', fontsize=10)

    ax.set_ylabel('相对功率 (%)')
    ax.set_title(title)
    ax.grid(axis='y', alpha=0.3)
    ax.set_ylim(0, 100)

    plt.tight_layout()

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig


def plot_multi_signal_comparison(
    signals: List[np.ndarray],
    labels: List[str],
    t: Optional[np.ndarray] = None,
    sfreq: float = 500.0,
    title: str = "多信号对比",
    figsize: Tuple[int, int] = (14, 10),
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制多个信号的对比图

    Args:
        signals: 信号列表
        labels: 信号标签列表
        t: 时间数组 (None 则自动生成)
        sfreq: 采样率
        title: 图表标题
        figsize: 图表大小
        save_path: 保存路径

    Returns:
        matplotlib Figure 对象
    """
    n_signals = len(signals)
    duration = signals[0].shape[0] / sfreq

    if t is None:
        t = np.arange(0, duration, 1 / sfreq)

    fig, axes = plt.subplots(n_signals, 1, figsize=figsize, sharex=True)

    if n_signals == 1:
        axes = [axes]

    for i, (signal, label) in enumerate(zip(signals, labels)):
        axes[i].plot(t, signal, linewidth=0.8, label=label)
        axes[i].set_ylabel('振幅 (µV)')
        axes[i].set_title(label)
        axes[i].grid(True, alpha=0.3)
        axes[i].legend(loc='upper right')

    axes[-1].set_xlabel('时间 (秒)')
    plt.tight_layout()

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig


def plot_raster(
    event_times: List[np.ndarray],
    labels: Optional[List[str]] = None,
    time_range: Tuple[float, float] = (0, 10),
    title: str = "事件光栅图",
    figsize: Tuple[int, int] = (12, 8),
    save_path: Optional[str] = None,
) -> plt.Figure:
    """
    绘制事件光栅图

    用于可视化 EEG 事件（如棘波、纺锤波等）的时间分布。

    Args:
        event_times: 事件时间列表，每个元素是一个通道的事件时间数组
        labels: 通道/类别标签列表
        time_range: 显示时间范围 (开始, 结束)
        title: 图表标题
        figsize: 图表大小
        save_path: 保存路径

    Returns:
        matplotlib Figure 对象
    """
    fig, ax = plt.subplots(figsize=figsize)

    n_channels = len(event_times)

    if labels is None:
        labels = [f"通道 {i+1}" for i in range(n_channels)]

    for i, (events, label) in enumerate(zip(event_times, labels)):
        # 只显示在时间范围内的事件
        mask = (events >= time_range[0]) & (events <= time_range[1])
        filtered_events = events[mask]

        # 绘制事件标记
        ax.scatter(filtered_events, [i] * len(filtered_events),
                   marker='|', s=100, alpha=0.7)

    ax.set_yticks(range(n_channels))
    ax.set_yticklabels(labels)
    ax.set_xlabel('时间 (秒)')
    ax.set_title(title)
    ax.grid(True, alpha=0.3, axis='x')
    ax.set_xlim(time_range)

    plt.tight_layout()

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    return fig
