/**
 * Annotation 类型定义
 * 用于 EEG 信号标注（伪迹、频段、异常波形、用户标注）的数据模型
 */

/** 标注类型枚举 */
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

/** 标注来源 */
export type AnnotationSource =
  | 'preprocess'
  | 'band_analysis'
  | 'anomaly_detection'
  | 'user';

/** 标注分类 */
export type AnnotationCategory = 'artifact' | 'band' | 'anomaly' | 'user';

/** 标注渲染样式 */
export type AnnotationRenderStyle = 'highlight' | 'marker' | 'label';

/** 标注数据模型 - 与后端 Annotation 对应 */
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

/** 标注集合响应 - 与后端 AnnotationSetResponse 对应 */
export interface AnnotationSetResponse {
  file_id: string;
  annotations: Annotation[];
  summary: Record<string, number>;
  generated_at: string;
}

/** 生成标注请求 */
export interface GenerateAnnotationsRequest {
  run_band_analysis?: boolean;
  run_anomaly_detection?: boolean;
  anomaly_sensitivity?: number;
}

/** 创建用户标注请求 */
export interface UserAnnotationRequest {
  annotation_type?: AnnotationType;
  channel: string;
  start_time: number;
  end_time: number;
  label: string;
  note?: string;
}

/** 标注过滤条件 */
export interface AnnotationFilters {
  types: AnnotationType[];
  channels: string[];
  timeRange: { start: number; end: number } | null;
}

/** 标注可见性配置 */
export interface AnnotationVisibility {
  artifact: boolean;
  band: boolean;
  anomaly: boolean;
  user: boolean;
}

/** 标注点击事件 */
export interface AnnotationClickEvent {
  annotation: Annotation;
  pixelX: number;
  pixelY: number;
}

/** 标注样式映射 */
export const ANNOTATION_STYLES: Record<AnnotationType, {
  color: string;
  label: string;
  category: AnnotationCategory;
  renderStyle: AnnotationRenderStyle;
}> = {
  artifact_eog: { color: '#FCD34D', label: 'EOG 眼动伪迹', category: 'artifact', renderStyle: 'highlight' },
  artifact_emg: { color: '#FB923C', label: 'EMG 肌肉伪迹', category: 'artifact', renderStyle: 'highlight' },
  artifact_flat: { color: '#9CA3AF', label: '平坦信号', category: 'artifact', renderStyle: 'highlight' },
  artifact_drift: { color: '#60A5FA', label: '信号漂移', category: 'artifact', renderStyle: 'highlight' },
  artifact_jump: { color: '#A78BFA', label: '信号跳变', category: 'artifact', renderStyle: 'highlight' },
  band_dominant: { color: '#34D399', label: '主频段', category: 'band', renderStyle: 'label' },
  anomaly_spike: { color: '#EF4444', label: '棘波', category: 'anomaly', renderStyle: 'marker' },
  anomaly_sharp_wave: { color: '#F97316', label: '尖波', category: 'anomaly', renderStyle: 'marker' },
  anomaly_spike_and_slow: { color: '#DC2626', label: '棘慢复合波', category: 'anomaly', renderStyle: 'marker' },
  anomaly_slow_wave: { color: '#FBBF24', label: '慢波异常', category: 'anomaly', renderStyle: 'marker' },
  anomaly_rhythmic: { color: '#3B82F6', label: '节律性异常', category: 'anomaly', renderStyle: 'marker' },
  user_note: { color: '#10B981', label: '用户标注', category: 'user', renderStyle: 'label' },
};

/** 获取标注分类 */
export function getAnnotationCategory(type: AnnotationType): AnnotationCategory {
  return ANNOTATION_STYLES[type].category;
}

/** 判断标注是否属于指定分类 */
export function isAnnotationInCategory(
  annotation: Annotation,
  category: AnnotationCategory
): boolean {
  return getAnnotationCategory(annotation.annotation_type) === category;
}
