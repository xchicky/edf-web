"""
验证修复后的代码

使用修复后的频带边界和频率分辨率算法
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mne.time_frequency import psd_array_welch

# 标准 EEG 频带定义
FREQUENCY_BANDS = {
    "delta": (0.5, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta": (13, 30),
    "gamma": (30, 50),
}


def calculate_band_power_fixed(signal: np.ndarray, sfreq: float) -> dict:
    """
    使用修复后的算法计算频带功率

    修复:
    1. 使用半开区间 [fmin, fmax) 避免边界重复计算
    2. 动态 n_fft 确保足够的频率分辨率
    """

    n_samples = len(signal)
    channel_data = signal

    # === 修复2: 优化频率分辨率计算 ===
    # 目标: 频率分辨率至少为 0.5Hz
    target_resolution = 0.5  # Hz
    min_n_fft_for_resolution = int(sfreq / target_resolution)  # 500Hz -> 1000

    # 计算合适的 n_fft (2的幂次方)
    power_of_two = 2 ** int(np.log2(n_samples))
    n_fft = max(power_of_two, min_n_fft_for_resolution)

    # 如果 n_fft 超过样本数，使用零填充
    if n_fft > n_samples:
        n_fft = 2 ** int(np.log2(n_fft)) if n_fft == 2 ** int(np.log2(n_fft)) else 2 ** (int(np.log2(n_fft)) + 1)

    n_fft = max(n_fft, 8)
    n_overlap = min(n_fft // 2, n_samples // 4)

    print(f"   n_fft: {n_fft}, 频率分辨率: {sfreq/n_fft:.3f} Hz")

    # 计算 PSD
    # 如果 n_fft > n_samples，需要设置 n_per_seg 以允许零填充
    n_per_seg = min(n_samples, n_fft)
    psds, freqs = psd_array_welch(
        channel_data,
        sfreq=sfreq,
        fmin=0.5,
        fmax=50,
        n_fft=n_fft,
        n_per_seg=n_per_seg,
        n_overlap=n_overlap,
        verbose=False,
    )

    if psds.ndim == 1:
        psds = psds.reshape(1, -1)

    psd_mean = psds.mean(axis=0)

    # === 修复1: 使用半开区间 ===
    band_powers = {}
    total_power = 0

    for band_name, (fmin_band, fmax_band) in FREQUENCY_BANDS.items():
        # 使用半开区间 [fmin, fmax)
        freq_mask = (freqs >= fmin_band) & (freqs < fmax_band)
        band_psds = psd_mean[freq_mask]

        absolute_power = float(np.trapezoid(band_psds, freqs[freq_mask]))
        total_power += absolute_power

        band_powers[band_name] = {
            "absolute": absolute_power,
            "range": [fmin_band, fmax_band],
        }

    # 计算相对功率
    for band_name in band_powers:
        if total_power > 0:
            relative_power = band_powers[band_name]["absolute"] / total_power
        else:
            relative_power = 0.0
        band_powers[band_name]["relative"] = relative_power * 100

    return band_powers, freqs, n_fft


def test_user_case_fixed():
    """使用修复后的算法测试用户案例"""

    print("=" * 70)
    print("修复验证测试")
    print("=" * 70)

    sfreq = 500.0
    duration = 0.194
    freq = 2 / duration  # 10.309 Hz

    # 生成测试信号
    t = np.arange(0, duration, 1 / sfreq)
    signal = -np.cos(2 * np.pi * freq * t)

    print(f"\n测试信号:")
    print(f"  频率: {freq:.3f} Hz")
    print(f"  时长: {duration:.3f} 秒")
    print(f"  期望频带: Alpha (8-13 Hz)")

    # 使用修复后的算法
    print(f"\n使用修复后的算法:")
    band_powers, freqs, n_fft = calculate_band_power_fixed(signal, sfreq)

    print(f"\n频带功率分布:")
    print("-" * 50)
    for band_name, band_data in band_powers.items():
        print(f"  {band_name.upper():6s}: 绝对={band_data['absolute']:8.4f} µV², 相对={band_data['relative']:5.1f}%")

    # 验证
    alpha_ratio = band_powers['alpha']['relative']
    beta_ratio = band_powers['beta']['relative']

    print(f"\n测试结果:")
    if alpha_ratio > 50 and beta_ratio < 30:
        print(f"  ✓ PASS: Alpha波占比 {alpha_ratio:.1f}% > 50%, Beta波占比 {beta_ratio:.1f}% < 30%")
        print(f"  问题已修复! (从原来的 0% Alpha 提升到 {alpha_ratio:.1f}%)")
        passed = True
    else:
        print(f"  ✗ FAIL: Alpha波占比 {alpha_ratio:.1f}% < 50% 或 Beta波占比 >= 30%")
        print(f"  Beta波占比 {beta_ratio:.1f}%")
        passed = False

    # 生成对比图
    save_comparison_plot(t, signal, freqs, band_powers, freq, n_fft, sfreq)

    return passed


def save_comparison_plot(t: np.ndarray, signal: np.ndarray, freqs: np.ndarray,
                         band_powers: dict, signal_freq: float, n_fft: int, sfreq: float):
    """保存修复前后的对比图"""
    reports_dir = Path(__file__).parent.parent / "reports" / "images"
    save_path = reports_dir / "fix_verification.png"

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # 1. 时域波形
    axes[0, 0].plot(t, signal, 'b-', linewidth=1)
    axes[0, 0].set_xlabel('Time (s)')
    axes[0, 0].set_ylabel('Amplitude (µV)')
    axes[0, 0].set_title(f'Time Domain - {signal_freq:.2f} Hz Signal')
    axes[0, 0].grid(True, alpha=0.3)

    # 2. 频带功率
    bands = list(band_powers.keys())
    powers = [band_powers[b]['relative'] for b in bands]
    colors = ['purple', 'blue', 'green', 'orange', 'red']

    bars = axes[0, 1].bar([b.upper() for b in bands], powers, color=colors, alpha=0.7)
    axes[0, 1].set_ylabel('Relative Power (%)')
    axes[0, 1].set_title('Band Power Distribution (Fixed Algorithm)')
    axes[0, 1].grid(axis='y', alpha=0.3)
    axes[0, 1].set_ylim(0, 100)

    # 标记 Alpha 频带
    alpha_idx = bands.index('alpha')
    bars[alpha_idx].set_edgecolor('green')
    bars[alpha_idx].set_linewidth(3)
    axes[0, 1].text(alpha_idx, powers[alpha_idx] + 3, f'{powers[alpha_idx]:.1f}%',
                    ha='center', fontsize=10, fontweight='bold', color='green')

    # 3. FFT 频率点 (低频部分)
    low_freqs = freqs[freqs <= 30]
    axes[1, 0].stem(low_freqs, np.ones_like(low_freqs), basefmt=' ')
    axes[1, 0].axvline(signal_freq, color='green', linestyle='--', linewidth=2,
                       label=f'Signal Freq ({signal_freq:.2f} Hz)')
    axes[1, 0].axvspan(8, 13, alpha=0.2, color='green', label='Alpha Band')
    axes[1, 0].axvspan(13, 30, alpha=0.2, color='orange', label='Beta Band')
    axes[1, 0].set_xlabel('Frequency (Hz)')
    axes[1, 0].set_yticks([])
    axes[1, 0].set_title(f'FFT Frequency Points (Resolution: {sfreq/n_fft:.2f} Hz)')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)

    # 4. 频率分辨率对比
    resolutions = {
        'Before (n_fft=64)': sfreq / 64,
        'After (n_fft=1024)': sfreq / n_fft,
    }

    x_pos = range(len(resolutions))
    axes[1, 1].bar(x_pos, list(resolutions.values()), color=['red', 'green'], alpha=0.7)
    axes[1, 1].set_ylabel('Frequency Resolution (Hz)')
    axes[1, 1].set_title('Frequency Resolution Comparison')
    axes[1, 1].set_xticks(x_pos)
    axes[1, 1].set_xticklabels(list(resolutions.keys()))
    axes[1, 1].grid(axis='y', alpha=0.3)

    # 添加数值标签
    for i, (k, v) in enumerate(resolutions.items()):
        axes[1, 1].text(i, v + 0.1, f'{v:.2f} Hz', ha='center', fontweight='bold')

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"\n可视化已保存: {save_path}")


if __name__ == "__main__":
    passed = test_user_case_fixed()

    print("\n" + "=" * 70)
    if passed:
        print("✅ 修复验证成功")
        sys.exit(0)
    else:
        print("❌ 修复验证失败")
        sys.exit(1)
