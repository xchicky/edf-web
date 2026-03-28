/**
 * Annotation type definitions
 * 用于 EEG 标注数据（伪迹、频段、异常、用户标注）的数据模型
 */

/**
 * 标注来源类型
 */
export type AnnotationSource =
  | 'preprocess'
  | 'band_analysis'
  | 'anomaly_detection'
  | 'user';

/**
 * 标注类型枚举
 */
export type AnnotationType =
  | 'artifact_eog'
  | 'artifact_emg'
  | 'artifact_flat'
  | 'artifact_drift'
  | 'artifact_jump'
  | 'band_dominant'
  | 'anomaly_spike'
  | 'anomaly_sharp_wave'
  | 'anomaly_spike_and_slow'
  | 'anomaly_slow_wave'
  | 'anomaly_rhythmic'
  | 'user_note';

/**
 * 标注渲染样式 - 不同类型的可视化方式
 */
export type AnnotationRenderStyle = 'highlight' | 'marker' | 'label';

/**
 * 单条标注数据
 */
export interface Annotation {
  id: string;
  annotation_type: AnnotationType;
  source: AnnotationSource;
  channel: string | null;
  start_time: number;
  end_time: number;
  label: string;
  color: string;
  severity: number;
  confidence: number;
  metadata: Record<string, unknown>;
  is_user_created: boolean;
  created_at: string | null;
}

/**
 * 标注集合
 */
export interface AnnotationSet {
  file_id: string;
  annotations: Annotation[];
  summary: Record<string, number>;
  generated_at: string;
}

/**
 * 可见性过滤器状态
 */
export interface AnnotationVisibilityFilter {
  types: AnnotationType[];
  channels: string[];
  source: AnnotationSource[];
}

/**
 * 生成标注请求参数
 */
export interface GenerateAnnotationsRequest {
  run_band_analysis?: boolean;
  run_anomaly_detection?: boolean;
  anomaly_sensitivity?: number;
}

/**
 * 添加用户标注请求
 */
export interface UserAnnotationRequest {
  annotation_type?: string;
  channel: string;
  start_time: number;
  end_time: number;
  label: string;
  note?: string;
}

/**
 * 获取标注查询参数
 */
export interface GetAnnotationsParams {
  start?: number;
  end?: number;
  types?: AnnotationType[];
  channels?: string[];
}

/**
 * 标注点击事件数据
 */
export interface AnnotationClickEvent {
  annotation: Annotation;
  pixelX: number;
  pixelY: number;
}

/**
 * 标注类型样式配置
 */
export const ANNOTATION_STYLES: Record<
  AnnotationType,
  { label: string; color: string; renderStyle: AnnotationRenderStyle }
> = {
  // 伪迹标注 (highlight 样式)
  artifact_eog: { label: 'EOG 眼电伪迹', color: '#FCD34D', renderStyle: 'highlight' },
  artifact_emg: { label: 'EMG 肌电伪迹', color: '#FB923C', renderStyle: 'highlight' },
  artifact_flat: { label: '平坦信号', color: '#9CA3AF', renderStyle: 'highlight' },
  artifact_drift: { label: '信号漂移', color: '#60A5FA', renderStyle: 'highlight' },
  artifact_jump: { label: '信号跳变', color: '#A78BFA', renderStyle: 'highlight' },
  // 频段标注 (label 样式)
  band_dominant: { label: '优势频段', color: '#34D399', renderStyle: 'label' },
  // 异常标注 (marker 样式)
  anomaly_spike: { label: '棘波', color: '#EF4444', renderStyle: 'marker' },
  anomaly_sharp_wave: { label: '尖波', color: '#F97316', renderStyle: 'marker' },
  anomaly_spike_and_slow: { label: '棘慢复合波', color: '#DC2626', renderStyle: 'marker' },
  anomaly_slow_wave: { label: '慢波异常', color: '#FBBF24', renderStyle: 'marker' },
  anomaly_rhythmic: { label: '节律异常', color: '#3B82F6', renderStyle: 'marker' },
  // 用户标注 (highlight 样式)
  user_note: { label: '用户标注', color: '#10B981', renderStyle: 'highlight' },
} as const;

/**
 * 按来源分组的标注类型
 */
export const ANNOTATION_TYPES_BY_SOURCE: Record<AnnotationSource, AnnotationType[]> = {
  preprocess: [
    'artifact_eog',
    'artifact_emg',
    'artifact_flat',
    'artifact_drift',
    'artifact_jump',
  ],
  band_analysis: ['band_dominant'],
  anomaly_detection: [
    'anomaly_spike',
    'anomaly_sharp_wave',
    'anomaly_spike_and_slow',
    'anomaly_slow_wave',
    'anomaly_rhythmic',
  ],
  user: ['user_note'],
};

/**
 * 获取标注类型的渲染样式
 */
export function getAnnotationRenderStyle(
  type: AnnotationType
): AnnotationRenderStyle {
  return ANNOTATION_STYLES[type]?.renderStyle ?? 'highlight';
}

/**
 * 获取标注类型的显示颜色
 */
export function getAnnotationColor(type: AnnotationType): string {
  return ANNOTATION_STYLES[type]?.color ?? '#999999';
}

/**
 * 获取标注类型的显示标签
 */
export function getAnnotationLabel(type: AnnotationType): string {
  return ANNOTATION_STYLES[type]?.label ?? type;
}

/**
 * 判断标注是否在指定时间范围内
 */
export function isAnnotationInTimeRange(
  annotation: Annotation,
  startTime: number,
  endTime: number
): boolean {
  return annotation.start_time < endTime && annotation.end_time > startTime;
}
