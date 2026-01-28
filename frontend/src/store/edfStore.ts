import { create } from 'zustand';
import type { Signal, SignalComputationResult } from '../types/signal';
import { loadSignals, saveSignals } from '../utils/signalStorage';

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
    }),
}));
