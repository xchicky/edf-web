/**
 * Pipeline type definitions
 */

/**
 * 步骤分类
 */
export type StepCategory = 'preprocess' | 'analysis';

/**
 * 预处理方法
 */
export type PreprocessMethod =
  | 'none'
  | 'linear_detrend'
  | 'polynomial_detrend'
  | 'highpass_filter'
  | 'bandpass_filter'
  | 'lowpass_filter'
  | 'notch_filter'
  | 'baseline_correction';

/**
 * 分析方法
 */
export type AnalysisMethod = 'anomaly_detection' | 'artifact_detection' | 'band_power';

/**
 * 流水线步骤
 */
export interface PipelineStep {
  id: string;
  category: StepCategory;
  method: PreprocessMethod | AnalysisMethod;
  parameters: Record<string, number>;
  enabled: boolean;
  order: number;
}

/**
 * 步骤执行日志
 */
export interface StepLog {
  step_id: string;
  status: 'success' | 'error' | 'skipped';
  duration_ms: number;
  message: string;
}

/**
 * 处理后波形数据
 */
export interface ProcessedWaveformData {
  data: number[][];
  times: number[];
  channels: string[];
  sfreq: number;
  n_samples: number;
  start_time: number;
  duration: number;
}

/**
 * 流水线 API 请求
 */
export interface PipelineRequest {
  steps: PipelineStep[];
  start: number;
  duration: number;
  channels?: string[] | null;
}

/**
 * 流水线 API 响应
 */
export interface PipelineResponse {
  processed_waveform: ProcessedWaveformData | null;
  annotations: PipelineAnnotation[];
  step_logs: StepLog[];
  total_processing_time_ms: number;
}

/**
 * 流水线产生的标注
 */
export interface PipelineAnnotation {
  annotation_type: string;
  source: 'pipeline';
  channel: string | null;
  start_time: number;
  end_time: number;
  label: string;
  color: string;
  severity: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

/**
 * 步骤定义（用于 UI 展示）
 */
export interface StepDefinition {
  name: string;
  description: string;
  category: StepCategory;
  parameters?: Record<string, {
    type: 'int' | 'float';
    default: number;
    min: number;
    max: number;
    description: string;
  }>;
}

/**
 * 预处理步骤定义
 */
export const PREPROCESS_STEP_DEFINITIONS: Record<PreprocessMethod, StepDefinition> = {
  none: {
    name: '无预处理',
    description: '保持原始信号',
    category: 'preprocess',
  },
  linear_detrend: {
    name: '线性去漂移',
    description: '去除线性趋势，适用于线性漂移',
    category: 'preprocess',
  },
  polynomial_detrend: {
    name: '多项式去漂移',
    description: '去除多项式趋势，适用于复杂漂移',
    category: 'preprocess',
    parameters: {
      order: { type: 'int', default: 2, min: 1, max: 5, description: '多项式阶数' },
    },
  },
  highpass_filter: {
    name: '高通滤波',
    description: '去除低频成分，适用于低频漂移',
    category: 'preprocess',
    parameters: {
      cutoff: { type: 'float', default: 0.5, min: 0.1, max: 2.0, description: '截止频率 (Hz)' },
    },
  },
  bandpass_filter: {
    name: '带通滤波',
    description: '保留特定频率范围',
    category: 'preprocess',
    parameters: {
      lowcut: { type: 'float', default: 0.5, min: 0.1, max: 10.0, description: '低截止频率 (Hz)' },
      highcut: { type: 'float', default: 50.0, min: 10.0, max: 100.0, description: '高截止频率 (Hz)' },
    },
  },
  lowpass_filter: {
    name: '低通滤波',
    description: '去除高频噪声',
    category: 'preprocess',
    parameters: {
      cutoff: { type: 'float', default: 50.0, min: 10.0, max: 100.0, description: '截止频率 (Hz)' },
    },
  },
  notch_filter: {
    name: '陷波滤波',
    description: '去除工频干扰 (50Hz/60Hz)',
    category: 'preprocess',
    parameters: {
      freq: { type: 'float', default: 50.0, min: 49.0, max: 61.0, description: '陷波频率 (Hz)' },
      quality: { type: 'float', default: 30.0, min: 10.0, max: 50.0, description: '品质因数' },
    },
  },
  baseline_correction: {
    name: '基线校正',
    description: '使用移动平均去除基线',
    category: 'preprocess',
  },
};

/**
 * 分析步骤定义
 */
export const ANALYSIS_STEP_DEFINITIONS: Record<AnalysisMethod, StepDefinition> = {
  anomaly_detection: {
    name: '异常检测',
    description: '检测棘波、尖波等异常波形',
    category: 'analysis',
    parameters: {
      sensitivity: { type: 'float', default: 1.0, min: 0.5, max: 1.5, description: '检测灵敏度' },
    },
  },
  artifact_detection: {
    name: '伪迹检测',
    description: '检测眼电、肌电等伪迹',
    category: 'analysis',
  },
  band_power: {
    name: '频带功率分析',
    description: '分析各频带功率分布',
    category: 'analysis',
  },
};

/**
 * 默认步骤（用于初始化）
 */
export const DEFAULT_STEPS: PipelineStep[] = [
  {
    id: 'step-1',
    category: 'preprocess',
    method: 'bandpass_filter',
    parameters: { lowcut: 0.5, highcut: 50.0 },
    enabled: true,
    order: 0,
  },
  {
    id: 'step-2',
    category: 'analysis',
    method: 'anomaly_detection',
    parameters: { sensitivity: 1.0 },
    enabled: true,
    order: 1,
  },
];
