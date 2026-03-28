import { create } from 'zustand';
import type {
  Annotation,
  AnnotationSet,
  AnnotationVisibilityFilter,
  AnnotationType,
  AnnotationSource,
  GetAnnotationsParams,
} from '../types/annotation';
import {
  generateAnnotations as apiGenerate,
  getAnnotations as apiGetAnnotations,
  addUserAnnotation as apiAddUserAnnotation,
  deleteUserAnnotation as apiDeleteUserAnnotation,
} from '../api/annotations';
import { isAnnotationInTimeRange } from '../types/annotation';

interface AnnotationStore {
  // 数据状态
  annotationSet: AnnotationSet | null;
  isLoading: boolean;
  error: string | null;

  // 可见性过滤
  visibilityFilter: AnnotationVisibilityFilter;

  // 操作方法
  generateAnnotations: (fileId: string) => Promise<void>;
  fetchAnnotations: (
    fileId: string,
    params?: GetAnnotationsParams
  ) => Promise<void>;
  addUserAnnotation: (
    fileId: string,
    channel: string,
    startTime: number,
    endTime: number,
    label: string,
    note?: string
  ) => Promise<void>;
  removeUserAnnotation: (fileId: string, annotationId: string) => Promise<void>;

  // 过滤方法
  setVisibilityFilter: (filter: Partial<AnnotationVisibilityFilter>) => void;
  toggleTypeVisibility: (type: AnnotationType) => void;
  toggleSourceVisibility: (source: AnnotationSource) => void;
  setVisibleTypes: (types: AnnotationType[]) => void;
  setVisibleSources: (sources: AnnotationSource[]) => void;
  setVisibleChannels: (channels: string[]) => void;

  // 获取过滤后的标注
  getFilteredAnnotations: () => Annotation[];
  getAnnotationsForTimeWindow: (
    startTime: number,
    endTime: number
  ) => Annotation[];

  // 清理
  clearAnnotations: () => void;
  reset: () => void;
}

const DEFAULT_VISIBILITY_FILTER: AnnotationVisibilityFilter = {
  types: [],
  channels: [],
  source: [],
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotationSet: null,
  isLoading: false,
  error: null,
  visibilityFilter: { ...DEFAULT_VISIBILITY_FILTER },

  generateAnnotations: async (fileId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiGenerate(fileId);
      set({ annotationSet: result, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '生成标注失败';
      set({ error: message, isLoading: false });
    }
  },

  fetchAnnotations: async (fileId, params) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiGetAnnotations(fileId, params);
      set({ annotationSet: result, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '获取标注失败';
      set({ error: message, isLoading: false });
    }
  },

  addUserAnnotation: async (fileId, channel, startTime, endTime, label, note) => {
    try {
      const newAnnotation = await apiAddUserAnnotation(fileId, {
        channel,
        start_time: startTime,
        end_time: endTime,
        label,
        note,
      });

      const { annotationSet } = get();
      if (annotationSet) {
        const updatedAnnotations = [
          ...annotationSet.annotations,
          newAnnotation,
        ];
        const updatedSummary = { ...annotationSet.summary };
        const typeKey = newAnnotation.annotation_type;
        updatedSummary[typeKey] = (updatedSummary[typeKey] ?? 0) + 1;

        set({
          annotationSet: {
            ...annotationSet,
            annotations: updatedAnnotations,
            summary: updatedSummary,
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '添加标注失败';
      set({ error: message });
    }
  },

  removeUserAnnotation: async (fileId, annotationId) => {
    try {
      await apiDeleteUserAnnotation(fileId, annotationId);

      const { annotationSet } = get();
      if (annotationSet) {
        const removed = annotationSet.annotations.find(
          (a) => a.id === annotationId
        );
        const updatedAnnotations = annotationSet.annotations.filter(
          (a) => a.id !== annotationId
        );
        const updatedSummary = { ...annotationSet.summary };
        if (removed) {
          const typeKey = removed.annotation_type;
          updatedSummary[typeKey] = Math.max(
            0,
            (updatedSummary[typeKey] ?? 0) - 1
          );
        }

        set({
          annotationSet: {
            ...annotationSet,
            annotations: updatedAnnotations,
            summary: updatedSummary,
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '删除标注失败';
      set({ error: message });
    }
  },

  setVisibilityFilter: (filter) => {
    const { visibilityFilter } = get();
    set({
      visibilityFilter: { ...visibilityFilter, ...filter },
    });
  },

  toggleTypeVisibility: (type) => {
    const { visibilityFilter } = get();
    const types = visibilityFilter.types.includes(type)
      ? visibilityFilter.types.filter((t) => t !== type)
      : [...visibilityFilter.types, type];
    set({
      visibilityFilter: { ...visibilityFilter, types },
    });
  },

  toggleSourceVisibility: (source) => {
    const { visibilityFilter } = get();
    const sources = visibilityFilter.source.includes(source)
      ? visibilityFilter.source.filter((s) => s !== source)
      : [...visibilityFilter.source, source];
    set({
      visibilityFilter: { ...visibilityFilter, source: sources },
    });
  },

  setVisibleTypes: (types) => {
    const { visibilityFilter } = get();
    set({ visibilityFilter: { ...visibilityFilter, types } });
  },

  setVisibleSources: (sources) => {
    const { visibilityFilter } = get();
    set({ visibilityFilter: { ...visibilityFilter, source: sources } });
  },

  setVisibleChannels: (channels) => {
    const { visibilityFilter } = get();
    set({ visibilityFilter: { ...visibilityFilter, channels } });
  },

  getFilteredAnnotations: () => {
    const { annotationSet, visibilityFilter } = get();
    if (!annotationSet) return [];

    return annotationSet.annotations.filter((annotation) => {
      // 按类型过滤（空数组表示不过滤）
      if (
        visibilityFilter.types.length > 0 &&
        !visibilityFilter.types.includes(annotation.annotation_type)
      ) {
        return false;
      }

      // 按来源过滤
      if (
        visibilityFilter.source.length > 0 &&
        !visibilityFilter.source.includes(annotation.source)
      ) {
        return false;
      }

      // 按通道过滤
      if (
        visibilityFilter.channels.length > 0 &&
        annotation.channel !== null &&
        !visibilityFilter.channels.includes(annotation.channel)
      ) {
        return false;
      }

      return true;
    });
  },

  getAnnotationsForTimeWindow: (startTime, endTime) => {
    const filtered = get().getFilteredAnnotations();
    return filtered.filter((annotation) =>
      isAnnotationInTimeRange(annotation, startTime, endTime)
    );
  },

  clearAnnotations: () => {
    set({ annotationSet: null, error: null });
  },

  reset: () => {
    set({
      annotationSet: null,
      isLoading: false,
      error: null,
      visibilityFilter: { ...DEFAULT_VISIBILITY_FILTER },
    });
  },
}));
