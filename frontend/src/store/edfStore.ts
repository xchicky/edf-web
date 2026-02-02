import { create } from 'zustand';
import type { Signal, SignalComputationResult } from '../types/signal';
import type { AnalysisResult, AnalysisType, TimeDomainStats, BandPowerResult } from '../types/analysis';
import { loadSignals, saveSignals } from '../utils/signalStorage';
import { analyzeTimeDomain, analyzeBandPower } from '../api/edf';
import { computeTimeDomainStats, findClosestIndex, computeBandPowers } from '../utils/statsCalculator';

export interface EDFMetadata {
  file_id: string;
  filename: string;
  file_size_mb: number;
  n_channels: number;
  channel_names: string[];
  sfreq: number;
  n_samples: number;
  duration_seconds: number;
  duration_minutes: number;
  meas_date: string | null;
  patient_info: {
    patient_id: string;
    sex: string;
    age: number | null;
  };
  n_annotations: number;
}

export interface WaveformData {
  file_id: string;
  data: number[][];
  times: number[];
  channels: string[];
  sfreq: number;
  n_samples: number;
  start_time: number;
  duration: number;
}

export interface Bookmark {
  id: string;
  label: string;
  time: number;
  createdAt: number;
}

interface EDFStore {
  metadata: EDFMetadata | null;
  waveform: WaveformData | null;
  currentTime: number;
  selectedChannels: number[];
  isLoading: boolean;
  error: string | null;
  windowDuration: number;
  amplitudeScale: number;
  isPlaying: boolean;
  bookmarks: Bookmark[];
  signals: Signal[];
  signalData: Map<string, SignalComputationResult>;
  isLoadingSignals: boolean;
  // 选择状态
  selectionStart: number | null;
  selectionEnd: number | null;
  isSelecting: boolean;
  hasSelection: boolean;  // 是否有已确认的选择

  // 分析状态
  analysisResults: AnalysisResult | null;
  isAnalysisLoading: boolean;
  analysisError: string | null;
  selectedAnalysisType: AnalysisType;

  // 侧边栏状态
  isLeftSidebarCollapsed: boolean;
  isRightSidebarCollapsed: boolean;

  setMetadata: (metadata: EDFMetadata) => void;
  setWaveform: (waveform: WaveformData) => void;
  setCurrentTime: (time: number) => void;
  setSelectedChannels: (channels: number[]) => void;
  toggleChannel: (channelIndex: number) => void;
  selectAllChannels: () => void;
  deselectAllChannels: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWindowDuration: (duration: number) => void;
  setAmplitudeScale: (scale: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  addBookmark: (label: string, time: number) => void;
  removeBookmark: (id: string) => void;
  jumpToBookmark: (time: number) => void;

  // 信号管理方法
  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  updateSignal: (id: string, signal: Partial<Signal>) => void;
  deleteSignal: (id: string) => void;
  toggleSignal: (id: string) => void;
  setSignalData: (signalId: string, data: SignalComputationResult) => void;
  setSignalDataBatch: (results: SignalComputationResult[]) => void;
  clearSignalData: (signalId?: string) => void;
  setIsLoadingSignals: (loading: boolean) => void;
  loadSignalsFromStorage: (fileId: string) => void;
  saveSignalsToStorage: (fileId: string) => void;

  // 选择管理方法
  setSelectionStart: (time: number | null) => void;
  setSelectionEnd: (time: number | null) => void;
  setIsSelecting: (isSelecting: boolean) => void;
  confirmSelection: () => void;  // 确认选择（松开鼠标时调用）
  clearSelection: () => void;

  // 分析方法
  runAnalysis: (
    selectionStart: number,
    selectionEnd: number,
    type: AnalysisType
  ) => Promise<void>;
  clearAnalysisResults: () => void;
  setSelectedAnalysisType: (type: AnalysisType) => void;

  // 侧边栏方法
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;

  reset: () => void;
}

export const useEDFStore = create<EDFStore>((set, get) => ({
  metadata: null,
  waveform: null,
  currentTime: 0,
  selectedChannels: Array.from({ length: 10 }, (_, i) => i),
  isLoading: false,
  error: null,
  windowDuration: 5,
  amplitudeScale: 1.0,
  isPlaying: false,
  bookmarks: [],
  signals: [],
  signalData: new Map(),
  isLoadingSignals: false,
  // 选择状态
  selectionStart: null,
  selectionEnd: null,
  isSelecting: false,
  hasSelection: false,

  // 分析状态
  analysisResults: null,
  isAnalysisLoading: false,
  analysisError: null,
  selectedAnalysisType: 'stats',

  // 侧边栏状态 - 从 localStorage 读取
  isLeftSidebarCollapsed: typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' ? localStorage.getItem('sidebarLeftCollapsed') === 'true' : false,
  isRightSidebarCollapsed: typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' ? localStorage.getItem('sidebarRightCollapsed') === 'true' : false,

  setMetadata: (metadata) => set({ metadata }),
  setWaveform: (waveform) => set({ waveform }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setSelectedChannels: (selectedChannels) => set({ selectedChannels }),
  toggleChannel: (channelIndex) => {
    const { selectedChannels } = get();
    if (selectedChannels.includes(channelIndex)) {
      set({ selectedChannels: selectedChannels.filter((i) => i !== channelIndex) });
    } else {
      set({ selectedChannels: [...selectedChannels, channelIndex].sort((a, b) => a - b) });
    }
  },
  selectAllChannels: () => {
    const { metadata } = get();
    if (metadata) {
      set({ selectedChannels: Array.from({ length: metadata.n_channels }, (_, i) => i) });
    }
  },
  deselectAllChannels: () => set({ selectedChannels: [] }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setWindowDuration: (windowDuration) => set({ windowDuration }),
  setAmplitudeScale: (amplitudeScale) => set({ amplitudeScale }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  addBookmark: (label, time) => {
    const { bookmarks } = get();
    const newBookmark: Bookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label,
      time,
      createdAt: Date.now(),
    };
    set({ bookmarks: [...bookmarks, newBookmark].sort((a, b) => a.time - b.time) });
  },
  removeBookmark: (id) => {
    const { bookmarks } = get();
    set({ bookmarks: bookmarks.filter((b) => b.id !== id) });
  },
  jumpToBookmark: (time) => {
    set({ currentTime: time });
  },

  // 信号管理方法
  setSignals: (signals) => set({ signals }),
  addSignal: (signal) => {
    const { signals } = get();
    set({ signals: [...signals, signal] });
  },
  updateSignal: (id, updates) => {
    const { signals } = get();
    set({
      signals: signals.map((s) =>
        s.id === id
          ? {
              ...s,
              ...updates,
              modifiedAt: Date.now(),
            }
          : s
      ),
    });
  },
  deleteSignal: (id) => {
    const { signals, signalData } = get();
    set({
      signals: signals.filter((s) => s.id !== id),
      signalData: new Map(signalData),
    });
    get().signalData.delete(id);
  },
  toggleSignal: (id) => {
    const { signals } = get();
    set({
      signals: signals.map((s) =>
        s.id === id
          ? {
              ...s,
              enabled: !s.enabled,
              modifiedAt: Date.now(),
            }
          : s
      ),
    });
  },
  setSignalData: (signalId, data) => {
    const { signalData } = get();
    const newMap = new Map(signalData);
    newMap.set(signalId, data);
    set({ signalData: newMap });
  },
  setSignalDataBatch: (results) => {
    const { signalData } = get();
    const newMap = new Map(signalData);
    for (const result of results) {
      newMap.set(result.id, result);
    }
    set({ signalData: newMap });
  },
  clearSignalData: (signalId) => {
    const { signalData } = get();
    const newMap = new Map(signalData);
    if (signalId) {
      newMap.delete(signalId);
    } else {
      newMap.clear();
    }
    set({ signalData: newMap });
  },
  setIsLoadingSignals: (loading) => set({ isLoadingSignals: loading }),
  loadSignalsFromStorage: (fileId) => {
    const signals = loadSignals(fileId);
    set({ signals });
  },
  saveSignalsToStorage: (fileId) => {
    const { signals } = get();
    saveSignals(fileId, signals);
  },

  // 选择管理方法
  setSelectionStart: (time) => set({ selectionStart: time }),
  setSelectionEnd: (time) => set({ selectionEnd: time }),
  setIsSelecting: (isSelecting) => set({ isSelecting }),
  confirmSelection: () => set({ isSelecting: false, hasSelection: true }),  // 确认选择
  clearSelection: () => set({ selectionStart: null, selectionEnd: null, isSelecting: false, hasSelection: false }),

  // 分析方法
  runAnalysis: async (selectionStart, selectionEnd, type) => {
    const { metadata, selectedChannels, signals, signalData } = get();

    if (!metadata?.file_id) {
      set({ analysisError: '没有加载的文件' });
      return;
    }

    set({ isAnalysisLoading: true, analysisError: null, analysisResults: null });

    try {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      const duration = end - start;

      // 获取选中的通道名称
      const channelNames = selectedChannels.length > 0
        ? selectedChannels.map(i => metadata?.channel_names[i] ?? '').filter(Boolean)
        : metadata.channel_names;

      // 根据分析类型调用不同的 API
      if (type === 'stats') {
        // 时域分析
        const response = await analyzeTimeDomain(
          metadata.file_id,
          start,
          duration,
          channelNames.length > 0 ? channelNames : undefined
        );

        // 转换响应数据为前端格式
        const timeDomain: Record<string, TimeDomainStats> = {};
        for (const [ch, stats] of Object.entries(response.statistics)) {
          timeDomain[ch] = {
            mean: stats.mean,
            std: stats.std,
            min: stats.min,
            max: stats.max,
            rms: stats.rms,
            peakToPeak: stats.peak_to_peak,
            kurtosis: stats.kurtosis,
            skewness: stats.skewness,
            nSamples: stats.n_samples,
          };
        }

        // 计算派生信号的统计量
        const enabledSignals = signals.filter(s => s.enabled);
        for (const signal of enabledSignals) {
          const signalResult = signalData.get(signal.id);
          if (signalResult && signalResult.data && signalResult.times) {
            // 找到选区对应的数据点
            const startIndex = findClosestIndex(signalResult.times, start);
            const endIndex = findClosestIndex(signalResult.times, end);
            const selectedData = signalResult.data.slice(startIndex, endIndex + 1);

            if (selectedData.length > 0) {
              timeDomain[signal.name] = computeTimeDomainStats(selectedData);
            }
          }
        }

        set({
          analysisResults: {
            fileId: response.file_id,
            type,
            selectionStart: start,
            selectionEnd: end,
            duration,
            timeDomain,
            timestamp: Date.now(),
          },
          isAnalysisLoading: false,
        });
      } else if (type === 'frequency') {
        // 频域分析
        const response = await analyzeBandPower(
          metadata.file_id,
          start,
          duration,
          channelNames.length > 0 ? channelNames : undefined
        );

        // 转换响应数据为前端格式
        const bandPowers: Record<string, Record<string, BandPowerResult>> = {};
        for (const [ch, bands] of Object.entries(response.band_powers)) {
          bandPowers[ch] = {};
          for (const [band, data] of Object.entries(bands)) {
            bandPowers[ch][band] = {
              absolute: data.absolute,
              relative: data.relative,
              range: data.range as [number, number],
            };
          }
        }

        // 计算派生信号的频带功率
        const enabledSignals = signals.filter(s => s.enabled);
        for (const signal of enabledSignals) {
          const signalResult = signalData.get(signal.id);
          if (signalResult && signalResult.data && signalResult.times) {
            // 找到选区对应的数据点
            const startIndex = findClosestIndex(signalResult.times, start);
            const endIndex = findClosestIndex(signalResult.times, end);
            const selectedData = signalResult.data.slice(startIndex, endIndex + 1);

            if (selectedData.length > 0) {
              // 使用简化的频带功率计算
              bandPowers[signal.name] = computeBandPowers(selectedData, signalResult.sfreq);
            }
          }
        }

        set({
          analysisResults: {
            fileId: response.file_id,
            type,
            selectionStart: start,
            selectionEnd: end,
            duration,
            frequency: {
              channels: [...response.channels, ...enabledSignals.map(s => s.name)],
              bandPowers,
            },
            timestamp: Date.now(),
          },
          isAnalysisLoading: false,
        });
      } else {
        // 综合分析或其他类型（暂未实现）
        set({
          analysisError: `分析类型 '${type}' 暂未实现`,
          isAnalysisLoading: false,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      set({ analysisError: errorMessage, isAnalysisLoading: false });
    }
  },
  clearAnalysisResults: () => set({ analysisResults: null, analysisError: null }),
  setSelectedAnalysisType: (type) => set({ selectedAnalysisType: type }),

  // 侧边栏方法
  toggleLeftSidebar: () => {
    const { isLeftSidebarCollapsed } = get();
    const newState = !isLeftSidebarCollapsed;
    set({ isLeftSidebarCollapsed: newState });
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('sidebarLeftCollapsed', String(newState));
    }
  },
  toggleRightSidebar: () => {
    const { isRightSidebarCollapsed } = get();
    const newState = !isRightSidebarCollapsed;
    set({ isRightSidebarCollapsed: newState });
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('sidebarRightCollapsed', String(newState));
    }
  },

  reset: () =>
    set({
      metadata: null,
      waveform: null,
      currentTime: 0,
      error: null,
      windowDuration: 5,
      amplitudeScale: 1.0,
      isPlaying: false,
      bookmarks: [],
      signals: [],
      signalData: new Map(),
      isLoadingSignals: false,
      selectionStart: null,
      selectionEnd: null,
      isSelecting: false,
      hasSelection: false,
      analysisResults: null,
      isAnalysisLoading: false,
      analysisError: null,
      selectedAnalysisType: 'stats',
    }),
}));