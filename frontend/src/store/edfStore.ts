import { create } from 'zustand';

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
  reset: () => set({ metadata: null, waveform: null, currentTime: 0, error: null, windowDuration: 5, amplitudeScale: 1.0, isPlaying: false, bookmarks: [] }),
}));
