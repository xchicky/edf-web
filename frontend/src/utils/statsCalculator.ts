/**
 * 统计量计算工具
 * 用于在前端计算信号的统计量
 */

export interface BandPowerResult {
  absolute: number;
  relative: number;
  range: [number, number];
}

export interface TimeDomainStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  rms: number;
  peakToPeak: number;
  kurtosis: number;
  skewness: number;
  nSamples: number;
}

/**
 * 计算时域统计量
 */
export function computeTimeDomainStats(data: number[]): TimeDomainStats {
  const n = data.length;

  if (n === 0) {
    return {
      mean: 0,
      std: 0,
      min: 0,
      max: 0,
      rms: 0,
      peakToPeak: 0,
      kurtosis: 0,
      skewness: 0,
      nSamples: 0,
    };
  }

  // 基本统计量
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const min = Math.min(...data);
  const max = Math.max(...data);

  // 方差和标准差
  const variance = data.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // RMS
  const rms = Math.sqrt(data.reduce((a, b) => a + b ** 2, 0) / n);

  // 峰峰值
  const peakToPeak = max - min;

  // 峰度和偏度
  let skewness = 0;
  let kurtosis = 0;

  if (std > 0) {
    skewness = data.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / n;
    kurtosis = data.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / n - 3;
  }

  return {
    mean,
    std,
    min,
    max,
    rms,
    peakToPeak,
    kurtosis,
    skewness,
    nSamples: n,
  };
}

/**
 * 在信号数据中找到最接近目标时间的索引
 */
export function findClosestIndex(times: number[], targetTime: number): number {
  let left = 0;
  let right = times.length - 1;

  // 二分查找
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (times[mid] < targetTime) {
      left = mid + 1;
    } else if (times[mid] > targetTime) {
      right = mid - 1;
    } else {
      return mid;
    }
  }

  // 返回最接近的索引
  if (left === 0) return 0;
  if (left === times.length) return times.length - 1;
  return Math.abs(times[left] - targetTime) < Math.abs(times[left - 1] - targetTime)
    ? left
    : left - 1;
}

/**
 * 标准 EEG 频带定义
 */
export const EEG_FREQUENCY_BANDS = {
  delta: [0.5, 4] as [number, number],
  theta: [4, 8] as [number, number],
  alpha: [8, 13] as [number, number],
  beta: [13, 30] as [number, number],
  gamma: [30, 50] as [number, number],
};

/**
 * 简化的频带功率计算
 * 注意：这是简化实现，使用方差作为功率近似
 * 对于精确的频带功率分析，应该使用后端 API 的 FFT 实现
 */
export function computeBandPowers(
  data: number[],
  sfreq: number,
  bands: Record<string, [number, number]> = EEG_FREQUENCY_BANDS
): Record<string, BandPowerResult> {
  const n = data.length;

  // 处理空数据
  if (n === 0) {
    const results: Record<string, BandPowerResult> = {};
    for (const [bandName, [fmin, fmax]] of Object.entries(bands)) {
      results[bandName] = {
        absolute: 0,
        relative: 0,
        range: [fmin, fmax],
      };
    }
    return results;
  }

  // 计算总体功率（方差）
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const totalPower = data.reduce((a, b) => a + (b - mean) ** 2, 0) / n;

  const results: Record<string, BandPowerResult> = {};
  let totalBandPower = 0;

  // 使用简化的频带功率估计
  // 由于前端 FFT 实现较复杂，这里使用基于方差的简化方法
  // 实际应用中，建议使用后端 API 进行精确的频带功率分析
  for (const [bandName, [fmin, fmax]] of Object.entries(bands)) {
    // 简化：假设功率在各频带均匀分布
    // 使用归一化频率范围作为权重
    const bandwidth = fmax - fmin;
    const weight = bandwidth / 50; // 50 Hz 是最大频率

    // 近似绝对功率
    const absolute = totalPower * weight;

    results[bandName] = {
      absolute,
      relative: 0, // 稍后计算
      range: [fmin, fmax],
    };

    totalBandPower += absolute;
  }

  // 计算相对功率
  for (const bandName of Object.keys(results)) {
    if (totalBandPower > 0) {
      results[bandName].relative = results[bandName].absolute / totalBandPower;
    }
  }

  return results;
}
