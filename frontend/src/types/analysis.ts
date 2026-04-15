/**
 * Analysis type definitions
 */

export type AnalysisType = 'stats' | 'frequency' | 'comprehensive';

/**
 * 时域统计结果
 */
export interface TimeDomainStats {
  mean: number;       // 平均值
  std: number;        // 标准差
  min: number;        // 最小值
  max: number;        // 最大值
  rms: number;        // 均方根
  peakToPeak: number; // 峰峰值
  kurtosis: number;   // 峰度
  skewness: number;   // 偏度
  nSamples: number;   // 样本数
}

/**
 * 频带功率结果
 */
export interface BandPowerResult {
  absolute: number;           // 绝对功率
  relative: number;           // 相对功率
  range: [number, number];    // 频率范围 [fmin, fmax]
}

/**
 * 频率分析结果
 */
export interface FrequencyAnalysis {
  channels: string[];
  bandPowers: Record<string, Record<string, BandPowerResult>>;
}

/**
 * PSD 分析结果
 */
export interface PSDAnalysis {
  channels: string[];
  psdData: Record<string, {
    frequencies: number[];
    psd: number[];
    sfreq: number;
  }>;
}

/**
 * 完整分析结果
 */
export interface AnalysisResult {
  fileId: string;
  type: AnalysisType;
  selectionStart: number;
  selectionEnd: number;
  duration: number;
  timeDomain?: Record<string, TimeDomainStats>;
  frequency?: FrequencyAnalysis;
  psd?: PSDAnalysis;
  timestamp: number;
}

/**
 * 时域分析 API 请求
 */
export interface TimeDomainRequest {
  channels?: string[] | null;
  start: number;
  duration: number;
  preprocess?: PreprocessConfig | null;
}

/**
 * 时域分析 API 响应
 */
export interface TimeDomainResponse {
  file_id: string;
  channels: string[];
  statistics: Record<string, {
    mean: number;
    std: number;
    min: number;
    max: number;
    rms: number;
    peak_to_peak: number;
    kurtosis: number;
    skewness: number;
    n_samples: number;
  }>;
}

/**
 * 频带功率分析 API 请求
 */
export interface BandPowerRequest {
  channels?: string[] | null;
  start: number;
  duration: number;
  bands?: Record<string, [number, number]> | null;
  preprocess?: PreprocessConfig | null;
}

/**
 * 频带功率分析 API 响应
 */
export interface BandPowerResponse {
  file_id: string;
  channels: string[];
  band_powers: Record<string, Record<string, {
    absolute: number;
    relative: number;
    range: [number, number];
  }>>;
}

/**
 * PSD 分析 API 请求
 */
export interface PSDRequest {
  channels?: string[] | null;
  start: number;
  duration: number;
  fmin?: number;
  fmax?: number;
  preprocess?: PreprocessConfig | null;
}

/**
 * PSD 分析 API 响应
 */
export interface PSDResponse {
  file_id: string;
  channels: string[];
  psd_data: Record<string, {
    frequencies: number[];
    psd: number[];
    sfreq: number;
  }>;
}

/**
 * 综合分析 API 请求
 */
export interface ComprehensiveRequest {
  channels?: string[] | null;
  start: number;
  duration: number;
  fmin?: number;
  fmax?: number;
  bands?: Record<string, [number, number]> | null;
  preprocess?: PreprocessConfig | null;
}

/**
 * 综合分析 API 响应
 */
export interface ComprehensiveResponse {
  file_id: string;
  channels: string[];
  time_domain?: Record<string, {
    mean: number;
    std: number;
    min: number;
    max: number;
    rms: number;
    peak_to_peak: number;
    kurtosis: number;
    skewness: number;
    n_samples: number;
  }>;
  band_power?: Record<string, Record<string, {
    absolute: number;
    relative: number;
    range: [number, number];
  }>>;
  psd?: Record<string, {
    frequencies: number[];
    psd: number[];
    sfreq: number;
  }>;
}

/**
 * EEG 标准频带定义
 */
export const EEG_BANDS = {
  delta: { range: [0.5, 4] as [number, number], label: 'Delta', color: '#6366f1' },
  theta: { range: [4, 8] as [number, number], label: 'Theta', color: '#8b5cf6' },
  alpha: { range: [8, 13] as [number, number], label: 'Alpha', color: '#ec4899' },
  beta: { range: [13, 30] as [number, number], label: 'Beta', color: '#f59e0b' },
  gamma: { range: [30, 50] as [number, number], label: 'Gamma', color: '#10b981' },
} as const;

export type EEGBandName = keyof typeof EEG_BANDS;

/**
 * 预处理方法类型
 */
export type PreprocessMethod =
  | 'none'
  | 'linear_detrend'
  | 'polynomial_detrend'
  | 'highpass_filter'
  | 'bandpass_filter'
  | 'baseline_correction';

/**
 * 预处理配置
 */
export interface PreprocessConfig {
  method: PreprocessMethod;
  parameters?: Record<string, number> | null;
}

/**
 * 预处理方法定义 (对照后端 PREPROCESS_OPTIONS)
 */
export const PREPROCESS_METHODS: Record<PreprocessMethod, {
  name: string;
  description: string;
  parameters?: Record<string, {
    default: number;
    min: number;
    max: number;
    description: string;
  }>;
}> = {
  none: {
    name: '无预处理',
    description: '保持原始信号',
  },
  linear_detrend: {
    name: '线性去漂移',
    description: '适用于线性漂移',
  },
  polynomial_detrend: {
    name: '多项式去漂移',
    description: '适用于复杂漂移',
    parameters: {
      order: { default: 2, min: 1, max: 5, description: '多项式阶数' },
    },
  },
  highpass_filter: {
    name: '高通滤波',
    description: '适用于低频漂移',
    parameters: {
      cutoff: { default: 0.5, min: 0.1, max: 2.0, description: '截止频率 (Hz)' },
    },
  },
  bandpass_filter: {
    name: '带通滤波',
    description: '保留特定频率范围',
    parameters: {
      lowcut: { default: 0.5, min: 0.1, max: 10.0, description: '低截止频率 (Hz)' },
      highcut: { default: 50.0, min: 10.0, max: 100.0, description: '高截止频率 (Hz)' },
    },
  },
  baseline_correction: {
    name: '基线校正',
    description: '使用移动平均去除基线',
  },
};
