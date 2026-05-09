import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PipelineStep,
  ProcessedWaveformData,
  StepLog,
  PipelineAnnotation,
} from '../types/pipeline';
import { runPipeline as apiRunPipeline } from '../api/pipeline';
import { DEFAULT_STEPS } from '../types/pipeline';
import type { Annotation } from '../types/annotation';

interface PipelineStore {
  steps: PipelineStep[];
  processedWaveform: ProcessedWaveformData | null;
  pipelineAnnotations: PipelineAnnotation[];
  stepLogs: StepLog[];
  isProcessing: boolean;
  error: string | null;
  isVisible: boolean;
  showProcessedOverlay: boolean;

  addStep: (category: 'preprocess' | 'analysis', method: string) => void;
  removeStep: (id: string) => void;
  updateStep: (id: string, updates: Partial<PipelineStep>) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  toggleStep: (id: string) => void;
  clearPipeline: () => void;
  runPipeline: (
    fileId: string,
    start: number,
    duration: number,
    channels?: string[] | null,
  ) => Promise<PipelineAnnotation[]>;
  toggleVisibility: () => void;
  toggleOverlay: () => void;
  resetToDefault: () => void;
}

const STORAGE_KEY = 'edf-pipeline-steps';

const generateId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set, get) => ({
      steps: DEFAULT_STEPS,
      processedWaveform: null,
      pipelineAnnotations: [],
      stepLogs: [],
      isProcessing: false,
      error: null,
      isVisible: false,
      showProcessedOverlay: true,

      addStep: (category, method) => {
        const newStep: PipelineStep = {
          id: generateId(),
          category,
          method: method as PipelineStep['method'],
          parameters: {},
          enabled: true,
          order: get().steps.length,
        };
        set((state) => ({
          steps: [...state.steps, newStep],
        }));
      },

      removeStep: (id) => {
        set((state) => ({
          steps: state.steps.filter((s) => s.id !== id),
        }));
      },

      updateStep: (id, updates) => {
        set((state) => ({
          steps: state.steps.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      reorderSteps: (fromIndex, toIndex) => {
        set((state) => {
          const newSteps = [...state.steps];
          const [removed] = newSteps.splice(fromIndex, 1);
          newSteps.splice(toIndex, 0, removed);
          return {
            steps: newSteps.map((s, i) => ({ ...s, order: i })),
          };
        });
      },

      toggleStep: (id) => {
        set((state) => ({
          steps: state.steps.map((s) =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
          ),
        }));
      },

      clearPipeline: () => {
        set({
          processedWaveform: null,
          pipelineAnnotations: [],
          stepLogs: [],
          error: null,
        });
      },

      runPipeline: async (fileId, start, duration, channels) => {
        set({ isProcessing: true, error: null });

        try {
          const { steps } = get();
          const response = await apiRunPipeline(fileId, {
            steps,
            start,
            duration,
            channels,
          });

          set({
            processedWaveform: response.processed_waveform,
            pipelineAnnotations: response.annotations,
            stepLogs: response.step_logs,
            isProcessing: false,
          });

          return response.annotations;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          set({ error: errorMsg, isProcessing: false });
          throw err;
        }
      },

      toggleVisibility: () => {
        set((state) => ({ isVisible: !state.isVisible }));
      },

      toggleOverlay: () => {
        set((state) => ({ showProcessedOverlay: !state.showProcessedOverlay }));
      },

      resetToDefault: () => {
        set({
          steps: DEFAULT_STEPS,
          processedWaveform: null,
          pipelineAnnotations: [],
          stepLogs: [],
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ steps: state.steps }),
    }
  )
);

/**
 * 将流水线标注转换为通用 Annotation 格式
 */
export function pipelineAnnotationToAnnotation(pa: PipelineAnnotation): Annotation {
  return {
    id: `pipeline-${pa.annotation_type}-${pa.start_time}-${pa.channel || 'all'}`,
    annotation_type: pa.annotation_type,
    source: 'pipeline',
    channel: pa.channel,
    start_time: pa.start_time,
    end_time: pa.end_time,
    label: pa.label,
    color: pa.color,
    severity: pa.severity,
    confidence: pa.confidence,
    metadata: pa.metadata,
    is_user_created: false,
    created_at: new Date().toISOString(),
  };
}
