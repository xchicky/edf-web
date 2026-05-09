import { create } from "zustand";
import type { Annotation, AnnotationSet } from "../types/annotation";
import { ALL_ANNOTATION_TYPES } from "../types/annotation";
import {
  generateAnnotations as apiGenerate,
  getAnnotations as apiGet,
  addUserAnnotation as apiAddUser,
  deleteUserAnnotation as apiDeleteUser,
  clearAnnotationCache as apiClearCache,
} from "../api/annotations";
import type { GenerateAnnotationsOptions } from "../api/annotations";

interface AnnotationStore {
  annotationSet: AnnotationSet | null;
  isLoading: boolean;
  error: string | null;
  visibilityFilter: Record<string, boolean>;
  selectedAnnotationId: string | null;

  generateAnnotations: (fileId: string, options?: GenerateAnnotationsOptions) => Promise<void>;
  loadAnnotations: (
    fileId: string,
    params?: {
      types?: string[];
      channels?: string[];
      start?: number;
      end?: number;
    }
  ) => Promise<void>;
  addUserAnnotation: (
    fileId: string,
    data: {
      annotation_type: string;
      channel: string;
      start_time: number;
      end_time: number;
      label: string;
      note?: string;
    }
  ) => Promise<void>;
  deleteUserAnnotation: (fileId: string, annotationId: string) => Promise<void>;
  clearCache: (fileId: string) => Promise<void>;
  toggleTypeVisibility: (type: string) => void;
  setAllVisibility: (visible: boolean) => void;
  setSelectedAnnotation: (id: string | null) => void;
  clearAnnotations: () => void;

  addAnnotationsToStore: (annotations: Annotation[]) => void;

  getVisibleAnnotations: () => Annotation[];
  getAnnotationsForChannel: (channel: string) => Annotation[];
  getAnnotationsInTimeRange: (start: number, end: number) => Annotation[];
}

const defaultVisibility = (): Record<string, boolean> => {
  const filter: Record<string, boolean> = {};
  ALL_ANNOTATION_TYPES.forEach((type) => {
    filter[type] = true;
  });
  return filter;
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotationSet: null,
  isLoading: false,
  error: null,
  visibilityFilter: defaultVisibility(),
  selectedAnnotationId: null,

  generateAnnotations: async (fileId, options) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiGenerate(fileId, options);
      set({ annotationSet: result, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadAnnotations: async (fileId, params) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiGet(fileId, params);
      set({ annotationSet: result, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addUserAnnotation: async (fileId, data) => {
    try {
      const newAnnotation = await apiAddUser(fileId, data);
      set((state) => {
        if (!state.annotationSet) return state;
        return {
          annotationSet: {
            ...state.annotationSet,
            annotations: [...state.annotationSet.annotations, newAnnotation],
          },
        };
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  deleteUserAnnotation: async (fileId, annotationId) => {
    try {
      await apiDeleteUser(fileId, annotationId);
      set((state) => {
        if (!state.annotationSet) return state;
        return {
          annotationSet: {
            ...state.annotationSet,
            annotations: state.annotationSet.annotations.filter(
              (a) => a.id !== annotationId
            ),
          },
        };
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  toggleTypeVisibility: (type) => {
    set((state) => ({
      visibilityFilter: {
        ...state.visibilityFilter,
        [type]: !state.visibilityFilter[type],
      },
    }));
  },

  setAllVisibility: (visible) => {
    if (visible) {
      set({ visibilityFilter: defaultVisibility() });
    } else {
      const filter: Record<string, boolean> = {};
      ALL_ANNOTATION_TYPES.forEach((type) => {
        filter[type] = false;
      });
      set({ visibilityFilter: filter });
    }
  },

  setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),

  clearAnnotations: () =>
    set({ annotationSet: null, error: null, selectedAnnotationId: null }),

  addAnnotationsToStore: (annotations) => {
    set((state) => {
      if (state.annotationSet) {
        return {
          annotationSet: {
            ...state.annotationSet,
            annotations: [...state.annotationSet.annotations, ...annotations],
          },
        };
      }
      return {
        annotationSet: {
          file_id: '',
          annotations,
          summary: {},
          generated_at: new Date().toISOString(),
        },
      };
    });
  },

  clearCache: async (fileId) => {
    try {
      await apiClearCache(fileId);
      set({ annotationSet: null });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  getVisibleAnnotations: () => {
    const state = get();
    if (!state.annotationSet) return [];
    return state.annotationSet.annotations.filter(
      (a) => state.visibilityFilter[a.annotation_type] !== false
    );
  },

  getAnnotationsForChannel: (channel) => {
    const state = get();
    if (!state.annotationSet) return [];
    return state.annotationSet.annotations.filter(
      (a) =>
        (a.channel === channel || a.channel === null) &&
        state.visibilityFilter[a.annotation_type] !== false
    );
  },

  getAnnotationsInTimeRange: (start, end) => {
    const state = get();
    if (!state.annotationSet) return [];
    return state.annotationSet.annotations.filter(
      (a) =>
        a.end_time >= start &&
        a.start_time <= end &&
        state.visibilityFilter[a.annotation_type] !== false
    );
  },
}));
