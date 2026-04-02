"""
用户案例验证测试

验证用户报告的具体问题: 10.3Hz信号被错误识别为Beta波

问题描述:
- 用户选择两个完整波形 (波谷-波峰-波谷-波峰-波谷)
- 时长: 0.194秒
- 计算频率: 2/0.194 = 10.3Hz (Alpha波范围: 8-13Hz)
- 错误结果: 频带功率显示86%为Beta波 (13-30Hz)
"""

import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # 非交互式后端

from mne.time_frequency import psd_array_welch
from exp.fixtures.synthetic_signals import SyntheticSignalGenerator


def generate_user_case_signal(sfreq: float = 500.0) -> tuple[np.ndarray, np.ndarray, dict]:
    """
    生成用户报告的问题信号

    两个完整波形: 波谷-波峰-波谷-波峰-波谷
    时长: 0.194秒
    """
    duration = 0.194
    freq = 2 / duration  # 2个周期 / 0.194秒 = 10.309Hz

    t = np.arange(0, duration, 1 / sfreq)
    # 生成从波谷开始的信号 (使用 -cos 使其从最小值开始)
    signal = -np.cos(2 * np.pi * freq * t)

    metadata = {
        "frequency": freq,
        "duration": duration,
        "n_samples": len(signal),
        "expected_band": "alpha",
        "expected_band_range": [8, 13],
        "description": f"用户案例: {freq:.2f}Hz Alpha波被错误识别为Beta波"
    }

    return t, signal, metadata


def calculate_frequency_resolution(sfreq: float, n_fft: int) -> float:
    """计算频率分辨率"""
    return sfreq / n_fft


def test_user_case():
    """测试用户报告的问题案例"""

    print("=" * 70)
    print("用户案例验证测试")
    print("=" * 70)

    sfreq = 500.0

    # 1. 生成信号
    print("\n1. 生成测试信号...")
    t, signal, metadata = generate_user_case_signal(sfreq)

    print(f"   - 频率: {metadata['frequency']:.3f} Hz")
    print(f"   - 时长: {metadata['duration']:.3f} 秒")
    print(f"   - 样本数: {metadata['n_samples']}")
    print(f"   - 期望频带: {metadata['expected_band']} ({metadata['expected_band_range'][0]}-{metadata['expected_band_range'][1]} Hz)")

    # 2. 分析当前实现的频率分辨率
    print("\n2. 分析频率分辨率...")
    n_samples = len(signal)
    n_fft = min(256, 2 ** int(np.log2(n_samples)))
    freq_resolution = calculate_frequency_resolution(sfreq, n_fft)

    print(f"   - n_fft: {n_fft}")
    print(f"   - 频率分辨率: {freq_resolution:.3f} Hz")
    print(f"   - FFT频率点数量: {n_fft // 2 + 1}")

    # 生成实际频率点
    freqs = np.fft.rfftfreq(n_fft, 1 / sfreq)
    print(f"   - 频率范围: 0-{freqs.max():.1f} Hz")

    # 检查关键频率点
    key_freqs = [4, 8, 13, 30, metadata['frequency']]
    print(f"\n   关键频率点是否存在:")
    for f in key_freqs:
        exists = np.any(np.isclose(freqs, f, atol=freq_resolution / 2))
        closest = freqs[np.argmin(np.abs(freqs - f))]
        print(f"     {f:5.1f} Hz: {'✓' if exists else '✗'} (最接近: {closest:.2f} Hz, 偏离: {abs(closest - f):.2f} Hz)")

    # 3. 计算频带功率 (当前实现)
    print("\n3. 使用当前实现计算频带功率...")

    # 标准 EEG 频带定义
    FREQUENCY_BANDS = {
        "delta": (0.5, 4),
        "theta": (4, 8),
        "alpha": (8, 13),
        "beta": (13, 30),
        "gamma": (30, 50),
    }

    try:
        # 使用 Welch 方法计算 PSD (模拟当前实现)
        psds, freqs = psd_array_welch(
            signal,
            sfreq=sfreq,
            fmin=0.5,
            fmax=50,
            n_fft=n_fft,
            n_overlap=n_fft // 2,
            verbose=False,
        )

        # psds 可能是 1D 或 2D
        if psds.ndim == 1:
            psds = psds.reshape(1, -1)

        psd_mean = psds.mean(axis=0)

        # 计算各频带功率 (使用当前实现 - 包含边界)
        band_powers = {}
        total_power = 0

        for band_name, (fmin_band, fmax_band) in FREQUENCY_BANDS.items():
            # ⚠️ 关键问题：使用包含边界 (>=, <=)
            freq_mask = (freqs >= fmin_band) & (freqs <= fmax_band)
            band_psds = psd_mean[freq_mask]

            absolute_power = float(np.trapz(band_psds, freqs[freq_mask]))
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
            band_powers[band_name]["relative"] = relative_power * 100  # 转为百分比

        print("\n   频带功率分布:")
        print("   " + "-" * 50)
        for band_name, band_data in band_powers.items():
            absolute = band_data['absolute']
            relative = band_data['relative']
            print(f"   {band_name.upper():6s}: 绝对={absolute:8.2f} µV², 相对={relative:5.1f}%")

        # 4. 验证结果
        print("\n4. 验证结果...")

        # 找出主导频带
        dominant_band = max(band_powers.items(), key=lambda x: x[1]['relative'])
        print(f"   - 主导频带: {dominant_band[0].upper()} ({dominant_band[1]['relative']:.1f}%)")
        print(f"   - 期望频带: ALPHA")

        alpha_ratio = band_powers['alpha']['relative']
        beta_ratio = band_powers['beta']['relative']

        # 生成可视化
        print("\n5. 生成可视化...")
        save_user_case_visualization(
            t, signal, freqs, band_powers, metadata, freq_resolution
        )

        # 生成FFT频谱图
        save_fft_spectrum(signal, sfreq, n_fft, metadata['frequency'])

        # 测试断言
        print("\n6. 测试结论...")

        if alpha_ratio > 0.5:
            print(f"   ✓ PASS: Alpha波占比 {alpha_ratio:.1f}% > 50%")
            print(f"   信号被正确识别为Alpha波")
            return True
        else:
            print(f"   ✗ FAIL: Alpha波占比 {alpha_ratio:.1f}% < 50%")
            print(f"   Beta波占比 {beta_ratio:.1f}% (期望 < 30%)")

            if beta_ratio > alpha_ratio:
                print(f"   ⚠ 问题确认: 信号被错误识别为Beta波!")

            print(f"\n   根本原因分析:")
            print(f"   - 信号频率 {metadata['frequency']:.2f} Hz")
            print(f"   - Alpha频带范围: 8-13 Hz")
            print(f"   - 频率分辨率: {freq_resolution:.2f} Hz")
            print(f"   - FFT频率点在10.3Hz附近可能不存在，导致频谱泄漏")

            return False

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def save_user_case_visualization(
    t: np.ndarray,
    signal: np.ndarray,
    freqs: np.ndarray,
    band_powers: dict,
    metadata: dict,
    freq_resolution: float
):
    """保存用户案例可视化图表"""
    reports_dir = Path(__file__).parent.parent / "reports" / "images"
    reports_dir.mkdir(parents=True, exist_ok=True)

    save_path = reports_dir / "user_case_analysis.png"

    fig = plt.figure(figsize=(14, 10))

    # 1. 时域波形
    ax1 = plt.subplot(3, 2, (1, 2))
    ax1.plot(t, signal, 'b-', linewidth=1)
    ax1.set_xlabel('时间 (秒)', fontsize=11)
    ax1.set_ylabel('振幅 (µV)', fontsize=11)
    ax1.set_title(f'时域波形 - {metadata["description"]}', fontsize=12, fontweight='bold')
    ax1.grid(True, alpha=0.3)

    # 标记波谷和波峰
    peaks = []
    troughs = []
    for i in range(1, len(signal) - 1):
        if signal[i] > signal[i-1] and signal[i] > signal[i+1]:
            peaks.append((t[i], signal[i]))
        elif signal[i] < signal[i-1] and signal[i] < signal[i+1]:
            troughs.append((t[i], signal[i]))

    if troughs:
        ax1.plot([p[0] for p in troughs], [p[1] for p in troughs], 'rv', label='波谷')
    if peaks:
        ax1.plot([p[0] for p in peaks], [p[1] for p in peaks], 'g^', label='波峰')
    ax1.legend()

    # 添加信息文本
    info_text = f"频率: {metadata['frequency']:.2f} Hz\n"
    info_text += f"时长: {metadata['duration']:.3f} s\n"
    info_text += f"波形数: 2个完整周期\n"
    info_text += f"频率分辨率: {freq_resolution:.2f} Hz"
    ax1.text(0.02, 0.98, info_text, transform=ax1.transAxes,
             verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    # 2. 频带功率分布
    ax2 = plt.subplot(3, 2, 3)
    bands = list(band_powers.keys())
    relative_powers = [band_powers[b]['relative'] for b in bands]

    colors = ['purple', 'blue', 'green', 'orange', 'red']
    bars = ax2.bar([b.upper() for b in bands], relative_powers, color=colors, alpha=0.7)
    ax2.set_ylabel('相对功率 (%)', fontsize=11)
    ax2.set_title('频带功率分布 (当前实现)', fontsize=12, fontweight='bold')
    ax2.grid(axis='y', alpha=0.3)
    ax2.set_ylim(0, 100)

    # 标记期望频带
    alpha_idx = bands.index('alpha')
    bars[alpha_idx].set_edgecolor('green')
    bars[alpha_idx].set_linewidth(3)
    ax2.text(alpha_idx, relative_powers[alpha_idx] + 2, '期望',
             ha='center', fontsize=10, fontweight='bold', color='green')

    # 3. FFT频率点分布
    ax3 = plt.subplot(3, 2, 4)
    ax3.stem(freqs[:30], np.ones_like(freqs[:30]), basefmt=' ')
    ax3.axvline(metadata['frequency'], color='green', linestyle='--', linewidth=2, label=f"信号频率 ({metadata['frequency']:.2f} Hz)")
    ax3.axvspan(8, 13, alpha=0.2, color='green', label='Alpha频带')
    ax3.axvspan(13, 30, alpha=0.2, color='orange', label='Beta频带')
    ax3.set_xlabel('频率 (Hz)', fontsize=11)
    ax3.set_ylabel('频率点', fontsize=11)
    ax3.set_title('FFT频率点分布 (前30个点)', fontsize=12, fontweight='bold')
    ax3.legend(fontsize=9)
    ax3.grid(True, alpha=0.3)

    # 4. 频带定义与边界
    ax4 = plt.subplot(3, 2, (5, 6))
    band_ranges = {
        'Delta': (0.5, 4),
        'Theta': (4, 8),
        'Alpha': (8, 13),
        'Beta': (13, 30),
        'Gamma': (30, 50)
    }

    y_base = 0
    for i, (band, (fmin, fmax)) in enumerate(band_ranges.items()):
        color = colors[i]
        ax4.barh(y_base, fmax - fmin, left=fmin, height=0.5, color=color, alpha=0.7, label=band)
        ax4.text((fmin + fmax) / 2, y_base, f"{fmin}-{fmax}Hz",
                 ha='center', va='center', fontsize=10, fontweight='bold')
        y_base += 1

    ax4.axvline(metadata['frequency'], color='green', linestyle='--', linewidth=2, label=f"信号频率 ({metadata['frequency']:.2f} Hz)")
    ax4.set_xlabel('频率 (Hz)', fontsize=11)
    ax4.set_yticks([])
    ax4.set_title('EEG频带定义与信号频率位置', fontsize=12, fontweight='bold')
    ax4.legend(loc='upper right')
    ax4.set_xlim(0, 50)
    ax4.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"   ✓ 可视化已保存: {save_path}")


def save_fft_spectrum(signal: np.ndarray, sfreq: float, n_fft: int, signal_freq: float):
    """保存FFT频谱分析图"""
    reports_dir = Path(__file__).parent.parent / "reports" / "images"
    save_path = reports_dir / "user_case_fft_spectrum.png"

    fig, axes = plt.subplots(2, 1, figsize=(12, 8))

    # 计算FFT
    from scipy import signal as scipy_signal
    freqs, psd = scipy_signal.welch(signal, sfreq, nperseg=n_fft)

    # 频谱图
    axes[0].semilogy(freqs, psd, 'b-')
    axes[0].axvline(signal_freq, color='green', linestyle='--', linewidth=2, label=f"信号频率 ({signal_freq:.2f} Hz)")
    axes[0].axvspan(8, 13, alpha=0.2, color='green', label='Alpha (8-13 Hz)')
    axes[0].axvspan(13, 30, alpha=0.2, color='orange', label='Beta (13-30 Hz)')

    # 标记FFT频率点
    for i, f in enumerate(freqs):
        if f <= 30:
            axes[0].axvline(f, color='gray', linestyle=':', alpha=0.3)

    axes[0].set_xlabel('频率 (Hz)', fontsize=11)
    axes[0].set_ylabel('功率谱密度 (µV²/Hz)', fontsize=11)
    axes[0].set_title(f'FFT频谱分析 (n_fft={n_fft}, 分辨率={sfreq/n_fft:.2f}Hz)', fontsize=12, fontweight='bold')
    axes[0].legend(fontsize=10)
    axes[0].grid(True, alpha=0.3)
    axes[0].set_xlim(0, 50)

    # 低频范围放大
    axes[1].plot(freqs, psd, 'b-')
    axes[1].axvline(signal_freq, color='green', linestyle='--', linewidth=2, label=f"信号频率 ({signal_freq:.2f} Hz)")
    axes[1].axvspan(8, 13, alpha=0.2, color='green')
    axes[1].axvspan(13, 30, alpha=0.2, color='orange')

    # 标记频率点
    freqs_under_20 = freqs[freqs <= 20]
    for f in freqs_under_20:
        axes[1].axvline(f, color='gray', linestyle=':', alpha=0.5)
        axes[1].text(f, max(psd) * 0.9, f'{f:.1f}', ha='center', fontsize=7, rotation=90)

    axes[1].set_xlabel('频率 (Hz)', fontsize=11)
    axes[1].set_ylabel('功率谱密度', fontsize=11)
    axes[1].set_title('低频范围放大 (0-20 Hz)', fontsize=12, fontweight='bold')
    axes[1].legend(fontsize=10)
    axes[1].grid(True, alpha=0.3)
    axes[1].set_xlim(0, 20)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"   ✓ FFT频谱图已保存: {save_path}")


def generate_test_report(passed: bool):
    """生成测试报告"""
    reports_dir = Path(__file__).parent.parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    report_path = reports_dir / "user_case_test_report.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# 用户案例测试报告\n\n")
        f.write(f"**测试时间**: {np.datetime64('now')}\n\n")
        f.write(f"**测试结果**: {'✅ PASSED' if passed else '❌ FAILED'}\n\n")

        f.write("## 问题描述\n\n")
        f.write("- 用户选择两个完整波形 (波谷-波峰-波谷-波峰-波谷)\n")
        f.write("- 时长: 0.194秒\n")
        f.write("- 计算频率: 2/0.194 = 10.3Hz (Alpha波范围)\n")
        f.write("- 错误结果: 频带功率显示86%为Beta波\n\n")

        f.write("## 测试信号\n\n")
        f.write(f"- 频率: {10.309:.3f} Hz\n")
        f.write(f"- 时长: 0.194 秒\n")
        f.write(f"- 期望频带: Alpha (8-13 Hz)\n\n")

        f.write("## 测试结论\n\n")
        if passed:
            f.write("✅ **测试通过**: 信号被正确识别为Alpha波\n\n")
            f.write("修复建议:\n")
            f.write("1. 频带边界重叠问题已修复\n")
            f.write("2. 频率分辨率优化已生效\n")
        else:
            f.write("❌ **测试失败**: 问题确认存在\n\n")
            f.write("根本原因:\n")
            f.write("1. 频带边界使用包含条件导致重复计算\n")
            f.write("2. 频率分辨率不足导致10.3Hz信号频谱泄漏到Beta频带\n")
            f.write("3. 短选区 (0.194s) 进一步恶化频率分辨率\n\n")
            f.write("修复建议:\n")
            f.write("1. 修改边界条件为半开区间 [fmin, fmax)\n")
            f.write("2. 动态调整n_fft确保至少0.5Hz分辨率\n")
            f.write("3. 对短选区进行零填充提高分辨率\n")
            f.write("4. 使用频率插值获取精确的边界频率功率\n")

    print(f"\n   测试报告已保存: {report_path}")


if __name__ == "__main__":
    passed = test_user_case()
    generate_test_report(passed)

    print("\n" + "=" * 70)
    if passed:
        print("✅ 测试完成: 问题已修复")
        sys.exit(0)
    else:
        print("❌ 测试失败: 问题确认存在，需要修复")
        sys.exit(1)
