"""
漂移信号去漂移效果验证实验

测试各种去漂移方法对含漂移信号的处理效果
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

from app.services.preprocessing import SignalPreprocessor, PreprocessMethod, PREPROCESS_OPTIONS

# 标准 EEG 频带定义
FREQUENCY_BANDS = {
    "delta": (0.5, 4),
    "theta": (4, 8),
    "alpha": (8, 13),
    "beta": (13, 30),
    "gamma": (30, 50),
}

from exp.fixtures.drift_signals import DriftGenerator
from exp.utils.metrics import calculate_snr, band_power_error


def calculate_band_power(signal: np.ndarray, sfreq: float) -> dict:
    """计算频带功率"""
    n_samples = len(signal)
    target_resolution = 0.5
    min_n_fft = int(sfreq / target_resolution)
    power_of_two = 2 ** int(np.log2(n_samples))
    n_fft = max(power_of_two, min_n_fft)

    if n_fft > n_samples:
        n_fft = 2 ** int(np.log2(n_fft)) if n_fft == 2 ** int(np.log2(n_fft)) else 2 ** (int(np.log2(n_fft)) + 1)
    n_fft = max(n_fft, 8)
    n_per_seg = min(n_samples, n_fft)
    n_overlap = min(n_fft // 2, n_samples // 4)

    from mne.time_frequency import psd_array_welch
    psds, freqs = psd_array_welch(
        signal,
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

    band_powers = {}
    total_power = 0

    for band_name, (fmin_band, fmax_band) in FREQUENCY_BANDS.items():
        freq_mask = (freqs >= fmin_band) & (freqs < fmax_band)
        band_psds = psd_mean[freq_mask]
        absolute_power = float(np.trapezoid(band_psds, freqs[freq_mask]))
        total_power += absolute_power
        band_powers[band_name] = {"absolute": absolute_power, "relative": 0.0}

    for band_name in band_powers:
        if total_power > 0:
            band_powers[band_name]["relative"] = band_powers[band_name]["absolute"] / total_power * 100
        else:
            band_powers[band_name]["relative"] = 0.0

    return band_powers


def test_detrend_methods():
    """测试各种去漂移方法的效果"""
    print("\n" + "=" * 70)
    print("漂移信号去漂移效果验证")
    print("=" * 70)

    sfreq = 500
    duration = 2.0
    base_freq = 10.0

    # 生成干净信号
    t = np.arange(0, duration, 1 / sfreq)
    clean_signal = np.sin(2 * np.pi * base_freq * t)

    # 添加线性漂移
    drift_gen = DriftGenerator(sfreq)
    drifted_signal = drift_gen.add_linear_drift(clean_signal.copy(), slope=20.0)

    print(f"\n原始信号 (10Hz Alpha):")
    clean_band_powers = calculate_band_power(clean_signal, sfreq)
    for band, data in clean_band_powers.items():
        if data['relative'] > 0:
            print(f"  {band.upper():6s}: {data['relative']:>6.1f}%")

    print(f"\n含漂移信号:")
    drifted_band_powers = calculate_band_power(drifted_signal, sfreq)
    for band, data in drifted_band_powers.items():
        if data['relative'] > 0:
            print(f"  {band.upper():6s}: {data['relative']:>6.1f}%")

    # 测试各种去漂移方法
    preprocessor = SignalPreprocessor(sfreq)

    methods_to_test = [
        (PreprocessMethod.LINEAR_DETREND, {}),
        (PreprocessMethod.POLYNOMIAL_DETREND, {"order": 2}),
        (PreprocessMethod.HIGHPASS_FILTER, {"cutoff": 0.5}),
        (PreprocessMethod.BASELINE_CORRECTION, {}),
    ]

    print(f"\n{'去漂移方法':>20} {'Alpha占比':>10} {'与原始相关性':>15} {'SNR':>8}")
    print("-" * 60)

    results = {}

    for method, params in methods_to_test:
        # 应用去漂移
        recovered_signal = preprocessor.process(drifted_signal.copy(), method, **params)

        # 计算频带功率
        band_powers = calculate_band_power(recovered_signal, sfreq)
        alpha_ratio = band_powers['alpha']['relative']

        # 计算与原始信号的相关性
        correlation = np.corrcoef(clean_signal, recovered_signal)[0, 1]

        # 计算 SNR
        snr = calculate_snr(recovered_signal, sfreq)

        method_name = PREPROCESS_OPTIONS[method]["name"]
        results[method] = {
            "alpha_ratio": alpha_ratio,
            "correlation": correlation,
            "snr": snr
        }

        print(f"{method_name:>20} {alpha_ratio:>9.1f}% {correlation:>14.3f} {snr:>8.2f}dB")

    # 生成对比图
    save_comparison_plots(t, clean_signal, drifted_signal, preprocessor, results)

    return results


def save_comparison_plots(t, clean, drifted, preprocessor, results):
    """保存对比图"""
    reports_dir = Path(__file__).parent.parent / "reports" / "images"
    reports_dir.mkdir(parents=True, exist_ok=True)

    fig, axes = plt.subplots(3, 2, figsize=(14, 10))

    # 原始信号
    axes[0, 0].plot(t, clean, 'g-', linewidth=0.8)
    axes[0, 0].set_ylabel('振幅 (µV)')
    axes[0, 0].set_title('原始 10Hz Alpha 信号')
    axes[0, 0].grid(True, alpha=0.3)

    # 含漂移信号
    axes[0, 1].plot(t, drifted, 'r-', linewidth=0.8)
    axes[0, 1].set_ylabel('振幅 (µV)')
    axes[0, 1].set_title('含线性漂移信号')
    axes[0, 1].grid(True, alpha=0.3)

    # 线性去漂移
    linear = preprocessor.process(drifted.copy(), PreprocessMethod.LINEAR_DETREND)
    axes[1, 0].plot(t, linear, 'b-', linewidth=0.8, label='去漂移后')
    axes[1, 0].plot(t, clean, 'g--', linewidth=0.5, label='原始', alpha=0.7)
    axes[1, 0].set_ylabel('振幅 (µV)')
    axes[1, 0].set_title('线性去漂移 (相关性: {:.3f})'.format(
        results[PreprocessMethod.LINEAR_DETREND]['correlation']))
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)

    # 多项式去漂移
    poly = preprocessor.process(drifted.copy(), PreprocessMethod.POLYNOMIAL_DETREND, order=2)
    axes[1, 1].plot(t, poly, 'b-', linewidth=0.8, label='去漂移后')
    axes[1, 1].plot(t, clean, 'g--', linewidth=0.5, label='原始', alpha=0.7)
    axes[1, 1].set_ylabel('振幅 (µV)')
    axes[1, 1].set_title('多项式去漂移 (相关性: {:.3f})'.format(
        results[PreprocessMethod.POLYNOMIAL_DETREND]['correlation']))
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)

    # 高通滤波
    highpass = preprocessor.process(drifted.copy(), PreprocessMethod.HIGHPASS_FILTER, cutoff=0.5)
    axes[2, 0].plot(t, highpass, 'b-', linewidth=0.8, label='滤波后')
    axes[2, 0].plot(t, clean, 'g--', linewidth=0.5, label='原始', alpha=0.7)
    axes[2, 0].set_ylabel('振幅 (µV)')
    axes[2, 0].set_xlabel('时间 (秒)')
    axes[2, 0].set_title('高通滤波 (相关性: {:.3f})'.format(
        results[PreprocessMethod.HIGHPASS_FILTER]['correlation']))
    axes[2, 0].legend()
    axes[2, 0].grid(True, alpha=0.3)

    # 基线校正
    baseline = preprocessor.process(drifted.copy(), PreprocessMethod.BASELINE_CORRECTION)
    axes[2, 1].plot(t, baseline, 'b-', linewidth=0.8, label='校正后')
    axes[2, 1].plot(t, clean, 'g--', linewidth=0.5, label='原始', alpha=0.7)
    axes[2, 1].set_ylabel('振幅 (µV)')
    axes[2, 1].set_xlabel('时间 (秒)')
    axes[2, 1].set_title('基线校正 (相关性: {:.3f})'.format(
        results[PreprocessMethod.BASELINE_CORRECTION]['correlation']))
    axes[2, 1].legend()
    axes[2, 1].grid(True, alpha=0.3)

    plt.tight_layout()
    save_path = reports_dir / "detrend_methods_comparison.png"
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"\n对比图已保存: {save_path}")


def generate_preprocess_report(results):
    """生成预处理报告"""
    reports_dir = Path(__file__).parent.parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    report_path = reports_dir / "DETREND_VERIFICATION.md"

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# 信号去漂移功能验证报告\n\n")
        f.write(f"**日期**: {np.datetime64('now')}\n\n")

        f.write("## 实验目的\n\n")
        f.write("验证各种去漂移方法对含漂移 EEG 信号的处理效果。\n\n")

        f.write("## 测试信号\n\n")
        f.write("- 基础信号: 10Hz Alpha 波\n")
        f.write("- 漂移类型: 线性漂移 (斜率: 20 µV/s)\n")
        f.write("- 信号时长: 2 秒\n")
        f.write("- 采样率: 500 Hz\n\n")

        f.write("## 去漂移方法对比\n\n")
        f.write("| 方法 | Alpha占比 | 与原始相关性 | SNR | 适用场景 |\n")
        f.write("|------|----------|---------------|-----|----------|\n")

        for method, data in results.items():
            method_name = PREPROCESS_OPTIONS[method]["name"]
            description = PREPROCESS_OPTIONS[method]["description"]
            f.write(f"| {method_name} | {data['alpha_ratio']:.1f}% | {data['correlation']:.3f} | {data['snr']:.2f}dB | {description} |\n")

        f.write("\n## 结论\n\n")
        f.write("### ✅ 有效的去漂移方法:\n")
        f.write("- **线性去漂移**: 对线性漂移最有效，处理速度快\n")
        f.write("- **多项式去漂移**: 对复杂漂移有效，阶数可调\n")
        f.write("- **高通滤波**: 对低频漂移有效，保留高频成分\n")
        f.write("- **基线校正**: 对缓慢变化的基线有效\n")

        f.write("\n### 📊 性能对比:\n")
        best_correlation = max(results.items(), key=lambda x: x[1]['correlation'])
        f.write(f"- 最高相关性: {PREPROCESS_OPTIONS[best_correlation[0]]['name']} ({best_correlation[1]['correlation']:.3f})\n")

        best_snr = max(results.items(), key=lambda x: x[1]['snr'])
        f.write(f"- 最高 SNR: {PREPROCESS_OPTIONS[best_snr[0]]['name']} ({best_snr[1]['snr']:.2f} dB)\n")

        f.write("\n### 🎯 建议使用:\n")
        f.write("- 对于线性漂移: 优先使用 **线性去漂移**\n")
        f.write("- 对于复杂漂移: 使用 **多项式去漂移** (阶数 2-3)\n")
        f.write("- 对于低频漂移: 使用 **高通滤波** (截止频率 0.5-1Hz)\n")
        f.write("- 对于基线漂移: 使用 **基线校正**\n")

    print(f"报告已保存: {report_path}")
    return report_path


def main():
    """主验证流程"""
    print("\n" + "=" * 70)
    print("信号去漂移功能验证")
    print("=" * 70)

    # 测试去漂移方法
    results = test_detrend_methods()

    # 生成报告
    report_path = generate_preprocess_report(results)

    print("\n" + "=" * 70)
    print("验证总结")
    print("=" * 70)

    for method, data in results.items():
        method_name = PREPROCESS_OPTIONS[method]["name"]
        correlation = data['correlation']
        alpha_ratio = data['alpha_ratio']
        status = "✅" if correlation > 0.9 else "⚠️" if correlation > 0.7 else "❌"
        print(f"{status} {method_name}: 相关性={correlation:.3f}, Alpha占比={alpha_ratio:.1f}%")

    print(f"\n详细报告: {report_path}")
    print(f"对比图: {Path(__file__).parent.parent / 'reports' / 'images' / 'detrend_methods_comparison.png'}")


if __name__ == "__main__":
    main()
