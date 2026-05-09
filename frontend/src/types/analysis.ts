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

// ============================================
// 异常检测类型定义
// ============================================

/**
 * 异常波形类型
 */
export type AnomalyType =
  | 'spike'           // 棘波
  | 'sharp_wave'      // 尖波
  | 'spike_and_slow'  // 棘慢复合波
  | 'slow_wave'       // 慢波异常
  | 'rhythmic';       // 节律异常

/**
 * 异常类型中文标签映射
 */
export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  spike: '棘波',
  sharp_wave: '尖波',
  spike_and_slow: '棘慢复合波',
  slow_wave: '慢波异常',
  rhythmic: '节律异常',
};

/**
 * 异常类型颜色映射
 */
export const ANOMALY_COLORS: Record<AnomalyType, string> = {
  spike: '#ff4444',
  sharp_wave: '#ff8844',
  spike_and_slow: '#ffcc44',
  slow_wave: '#44aaff',
  rhythmic: '#aa44ff',
};

/**
 * 单个异常事件
 */
export interface AnomalyEvent {
  onset: number;          // 开始时间 (秒)
  duration: number;       // 持续时间 (秒)
  type: AnomalyType;
  confidence: number;     // 置信度 0-1
  channels: string[];     // 相关通道
  description: string;    // 中文描述
}

/**
 * 通道异常检测结果
 */
export interface ChannelAnomalyResult {
  channel: string;
  anomalies: AnomalyEvent[];
  total_events: number;   // 后端使用 snake_case
  anomaly_rate: number;   // 异常占比
}

/**
 * 异常检测 API 响应
 */
export interface AnomalyDetectionResponse {
  file_id: string;
  channels: ChannelAnomalyResult[];
  total_anomalies: number;
  processing_time: number;
  sensitivity: number;
}

/**
 * 异常检测 API 请求
 */
export interface AnomalyDetectionRequest {
  start: number;
  duration: number;
  channels?: string[];
  sensitivity?: number;  // 0.5=低, 1.0=中, 1.5=高
  run_preprocess?: boolean;
}

// ============================================
// 自动预处理类型定义
// ============================================

/**
 * 重参考类型
 */
export type ReferenceType = 'average' | 'linked-mastoid';

/**
 * 自动预处理配置
 */
export interface AutoPreprocessConfig {
  reference: ReferenceType;
  notch_filter: boolean;
  notch_freq: number;
  notch_harmonics: boolean;
  bandpass_enabled: boolean;
  bandpass_low: number;
  bandpass_high: number;
  artifact_detection: boolean;
  eog_threshold: number;
  emg_threshold: number;
  flat_threshold: number;
  drift_threshold: number;
  jump_threshold: number;
  run_band_analysis: boolean;
  run_anomaly_detection: boolean;
  anomaly_sensitivity: number;
}

/**
 * 默认自动预处理配置
 */
export const DEFAULT_AUTO_PREPROCESS_CONFIG: AutoPreprocessConfig = {
  reference: 'average',
  notch_filter: true,
  notch_freq: 50.0,
  notch_harmonics: true,
  bandpass_enabled: true,
  bandpass_low: 0.5,
  bandpass_high: 50.0,
  artifact_detection: true,
  eog_threshold: 75.0,
  emg_threshold: 50.0,
  flat_threshold: 0.5,
  drift_threshold: 100.0,
  jump_threshold: 200.0,
  run_band_analysis: false,
  run_anomaly_detection: false,
  anomaly_sensitivity: 1.0,
};

/**
 * 伪迹类型
 */
export type ArtifactType = 'eog' | 'emg' | 'flat' | 'drift' | 'jump';

/**
 * 伪迹类型中文标签
 */
export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  eog: '眼电伪迹',
  emg: '肌电伪迹',
  flat: '平坦信号',
  drift: '信号漂移',
  jump: '瞬时跳变',
};

/**
 * 伪迹类型颜色
 */
export const ARTIFACT_COLORS: Record<ArtifactType, string> = {
  eog: '#f59e0b',
  emg: '#ef4444',
  flat: '#6b7280',
  drift: '#8b5cf6',
  jump: '#ec4899',
};

/**
 * 伪迹事件
 */
export interface ArtifactEvent {
  start_time: number;
  end_time: number;
  artifact_type: ArtifactType;
  channel: string | null;
  severity: number;
  description: string;
}

/**
 * 自动预处理响应
 */
export interface AutoPreprocessResponse {
  file_id: string;
  processing_time: number;
  channel_types: Record<string, string>;
  preprocess_log: Record<string, unknown>;
  artifacts: ArtifactEvent[];
  artifact_summary: Record<string, number>;
}
