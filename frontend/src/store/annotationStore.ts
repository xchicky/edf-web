import { create } from 'zustand';
import type {
  Annotation,
  AnnotationType,
  AnnotationCategory,
  AnnotationVisibility,
  AnnotationClickEvent,
} from '../types/annotation';
import { getAnnotationCategory } from '../types/annotation';
import {
  generateAnnotations,
  getAnnotations as fetchAnnotations,
  addUserAnnotation as apiAddUserAnnotation,
  deleteUserAnnotation as apiDeleteUserAnnotation,
} from '../api/annotations';

interface AnnotationStore {
  /** 标注数据 */
  annotations: Annotation[];
  /** 摘要信息 */
  summary: Record<string, number>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 标注可见性配置 */
  visibility: AnnotationVisibility;
  /** 上次点击的标注 */
  selectedAnnotation: AnnotationClickEvent | null;
  /** 当前文件 ID */
  fileId: string | null;
  /** 是否已生成 */
  isGenerated: boolean;

  // Actions
  /** 生成标注（触发后端完整分析流水线） */
  generate: (fileId: string, options?: {
    runBandAnalysis?: boolean;
    runAnomalyDetection?: boolean;
    anomalySensitivity?: number;
  }) => Promise<void>;
  /** 加载标注（从缓存或自动生成） */
  loadAnnotations: (fileId: string, filters?: {
    start?: number;
    end?: number;
    types?: AnnotationType[];
    channels?: string[];
  }) => Promise<void>;
  /** 添加用户标注 */
  addUserAnnotation: (fileId: string, request: {
    channel: string;
    startTime: number;
    endTime: number;
    label: string;
    note?: string;
  }) => Promise<void>;
  /** 删除用户标注 */
  deleteUserAnnotation: (fileId: string, annotationId: string) => Promise<void>;
  /** 设置可见性 */
  setVisibility: (visibility: Partial<AnnotationVisibility>) => void;
  /** 切换分类可见性 */
  toggleCategoryVisibility: (category: AnnotationCategory) => void;
  /** 设置选中的标注 */
  setSelectedAnnotation: (event: AnnotationClickEvent | null) => void;
  /** 过滤当前标注数据 */
  getFilteredAnnotations: () => Annotation[];
  /** 重置状态 */
  reset: () => void;
}

const DEFAULT_VISIBILITY: AnnotationVisibility = {
  artifact: true,
  band: true,
  anomaly: true,
  user: true,
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  summary: {},
  isLoading: false,
  error: null,
  visibility: { ...DEFAULT_VISIBILITY },
  selectedAnnotation: null,
  fileId: null,
  isGenerated: false,

  generate: async (fileId, options) => {
    set({ isLoading: true, error: null });
    try {
      const response = await generateAnnotations(fileId, {
        run_band_analysis: options?.runBandAnalysis,
        run_anomaly_detection: options?.runAnomalyDetection,
        anomaly_sensitivity: options?.anomalySensitivity,
      });
      set({
        annotations: response.annotations,
        summary: response.summary,
        fileId: response.file_id,
        isLoading: false,
        isGenerated: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成标注失败';
      set({ error: message, isLoading: false });
    }
  },

  loadAnnotations: async (fileId, filters) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchAnnotations(fileId, filters);
      set({
        annotations: response.annotations,
        summary: response.summary,
        fileId: response.file_id,
        isLoading: false,
        isGenerated: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载标注失败';
      set({ error: message, isLoading: false });
    }
  },

  addUserAnnotation: async (fileId, request) => {
    set({ isLoading: true, error: null });
    try {
      const newAnnotation = await apiAddUserAnnotation(fileId, {
        annotation_type: 'user_note',
        channel: request.channel,
        start_time: request.startTime,
        end_time: request.endTime,
        label: request.label,
        note: request.note,
      });
      set(state => ({
        annotations: [...state.annotations, newAnnotation],
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加标注失败';
      set({ error: message, isLoading: false });
    }
  },

  deleteUserAnnotation: async (fileId, annotationId) => {
    set({ isLoading: true, error: null });
    try {
      await apiDeleteUserAnnotation(fileId, annotationId);
      set(state => ({
        annotations: state.annotations.filter(a => a.id !== annotationId),
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除标注失败';
      set({ error: message, isLoading: false });
    }
  },

  setVisibility: (visibility) => {
    set(state => ({
      visibility: { ...state.visibility, ...visibility },
    }));
  },

  toggleCategoryVisibility: (category) => {
    set(state => ({
      visibility: { ...state.visibility, [category]: !state.visibility[category] },
    }));
  },

  setSelectedAnnotation: (event) => {
    set({ selectedAnnotation: event });
  },

  getFilteredAnnotations: () => {
    const { annotations, visibility } = get();
    return annotations.filter(annotation => {
      const category = getAnnotationCategory(annotation.annotation_type);
      return visibility[category];
    });
  },

  reset: () => {
    set({
      annotations: [],
      summary: {},
      isLoading: false,
      error: null,
      visibility: { ...DEFAULT_VISIBILITY },
      selectedAnnotation: null,
      fileId: null,
      isGenerated: false,
    });
  },
}));
