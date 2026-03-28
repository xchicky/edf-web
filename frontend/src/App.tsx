// edf-web v1.0
import { useDropzone } from 'react-dropzone';
import React, { useEffect, useCallback, useState } from 'react';
import debounce from 'lodash.debounce';
import { uploadEDF, getWaveform, calculateSignals } from './api/edf';
import { useEDFStore } from './store/edfStore';
import { useAnnotationStore } from './store/annotationStore';
import { ChannelSelector } from './components/ChannelSelector';
import { ModeSelector } from './components/ModeSelector';
import { ModeEditor } from './components/ModeEditor';
import { CompatibilityWarning } from './components/CompatibilityWarning';
import { TimeToolbar } from './components/TimeToolbar';
import { WaveformCanvas } from './components/WaveformCanvas';
import { SignalEditor } from './components/SignalEditor';
import { SignalList } from './components/SignalList';
import { StatsView } from './components/StatsView';
import { FrequencyView } from './components/FrequencyView';

import { OverviewStrip } from './components/OverviewStrip';
import { TimeAxis } from './components/TimeAxis';
import { TimeScrubber } from './components/TimeScrubber';
import { AmplitudeAxis } from './components/AmplitudeAxis';
import { ResolutionIndicator } from './components/ResolutionIndicator';
import { InteractionHint } from './components/InteractionHint';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import './App.css';

function App() {
  const {
    metadata,
    waveform,
    isLoading,
    error,
    selectedChannels,
    currentTime,
    windowDuration,
    amplitudeScale,
    isPlaying,
    bookmarks,
    signals,
    signalData,
    selectionStart,
    selectionEnd,
    isSelecting,
    hasSelection,
    analysisResults,
    isAnalysisLoading,
    analysisError,
    selectedAnalysisType,
    isLeftSidebarCollapsed,
    isRightSidebarCollapsed,
    // 模式管理状态
    modes,
    currentModeId,
    toggleLeftSidebar,
    toggleRightSidebar,
    setMetadata,
    setWaveform,
    setLoading,
    setError,
    reset,
    setCurrentTime,
    toggleChannel,
    selectAllChannels,
    deselectAllChannels,
    setWindowDuration,
    setAmplitudeScale,
    setIsPlaying,
    setBookmarks,
    addBookmark,
    removeBookmark,
    jumpToBookmark,
    addSignal,
    updateSignal,
    deleteSignal,
    toggleSignal,
    setSignalDataBatch,
    clearSignalData,
    loadSignalsFromStorage,
    saveSignalsToStorage,
    runAnalysis,
    clearAnalysisResults,
    setSelectedAnalysisType,
    // 模式管理方法
    loadModes,
    applyMode,
    clearMode,
    updateModeRecommendations,
    getCurrentMode,
  } = useEDFStore();

  const {
    generateAnnotations: generateAnnotationsAction,
  } = useAnnotationStore();

  // Signal management state
  const [isSignalEditorOpen, setIsSignalEditorOpen] = useState(false);
  const [editingSignal, setEditingSignal] = useState<any>(null);

  // 模式管理状态
  const [showCompatibilityWarning, setShowCompatibilityWarning] = useState(false);
  const [pendingModeId, setPendingModeId] = useState<string | null>(null);
  const [pendingCompatibilityIssues, setPendingCompatibilityIssues] = useState<any[]>([]);

  // 模式编辑器状态
  const [isModeEditorOpen, setIsModeEditorOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<any>(null);

  // Track actual canvas width to match WaveformCanvas and TimeAxis
  const waveformContainerRef = React.useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = React.useState(800);
  const [canvasHeight, setCanvasHeight] = React.useState(600);

  // Dev-only: auto-load demo.edf for easier development testing
  // TODO: Remove this block before production deployment
  useEffect(() => {
    // Skip in test environment to avoid fetch errors
    if (import.meta.env.MODE === 'test') {
      return;
    }

    const autoLoadDemo = async () => {
      try {
        const response = await fetch('/edf/demo.edf');
        if (!response.ok) return; // File not available, skip silently

        const blob = await response.blob();
        const file = new File([blob], 'demo.edf', { type: 'application/octet-stream' });

        // Reuse the same logic as dropzone onDrop
        reset();
        setLoading(true);
        setError(null);

        const result = await uploadEDF(file);
        setMetadata(result as any);
        loadModes();
        loadSignalsFromStorage(result.file_id);

        const initialChannels = Array.from(
          { length: Math.min(10, result.n_channels) },
          (_, i) => i
        );
        const waveformData = await getWaveform(result.file_id, 0, windowDuration, initialChannels);
        setWaveform(waveformData);
      } catch (err) {
        // Silently fail - this is a dev convenience feature
        console.warn('Auto-load demo.edf failed:', err);
      } finally {
        setLoading(false);
      }
    };

    autoLoadDemo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use useLayoutEffect to calculate width BEFORE initial render
  // This ensures TimeAxis and WaveformCanvas have matching widths from the start
  React.useLayoutEffect(() => {
    const updateWidth = () => {
      if (waveformContainerRef.current) {
        // Match WaveformCanvas calculation: parentElement.clientWidth - 32
        const width = waveformContainerRef.current.clientWidth - 32;
        setCanvasWidth(width);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Recalculate canvas width when waveform data loads
  // This ensures TimeAxis width matches WaveformCanvas after EDF is loaded
  React.useEffect(() => {
    if (waveform) {
      if (waveformContainerRef.current) {
        const width = waveformContainerRef.current.clientWidth - 32;
        setCanvasWidth(width);
      }
    }
  }, [waveform]);

  // Recalculate canvas width when sidebars collapse/expand
  // Wait for CSS transition (300ms) to complete before measuring
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (waveformContainerRef.current) {
        const width = waveformContainerRef.current.clientWidth - 32;
        setCanvasWidth(width);
      }
    }, 350); // Wait slightly longer than the 300ms transition

    return () => clearTimeout(timer);
  }, [isLeftSidebarCollapsed, isRightSidebarCollapsed]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/octet-stream': ['.edf'] },
    maxFiles: 1,
    onDrop: async (files) => {
      reset();
      setLoading(true);
      setError(null);

      try {
        const result = await uploadEDF(files[0]);
        setMetadata(result as any);

        // Load modes on file load
        loadModes();

        // Load saved signals for this file
        loadSignalsFromStorage(result.file_id);

        // Auto-select first 10 channels
        const initialChannels = Array.from({ length: Math.min(10, result.n_channels) }, (_, i) => i);
        const waveformData = await getWaveform(result.file_id, 0, windowDuration, initialChannels);
        setWaveform(waveformData);
      } catch (err: any) {
        // Normalize error to string (handle FastAPI 422 validation arrays)
        let errorMessage = err.message || 'Upload failed';
        if (err.response?.data?.detail) {
          const detail = err.response.data.detail;
          if (Array.isArray(detail)) {
            errorMessage = detail.map((e: any) => e.msg).join(', ');
          } else if (typeof detail === 'string') {
            errorMessage = detail;
          }
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  });

  const handleLoadWaveform = async () => {
    if (!metadata) return;

    setLoading(true);
    try {
      const waveformData = await getWaveform(metadata.file_id, currentTime, windowDuration, selectedChannels);
      setWaveform(waveformData);
    } catch (err: any) {
      // Normalize error to string (handle FastAPI 422 validation arrays)
      let errorMessage = 'Failed to load waveform';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map((e: any) => e.msg).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load derived signals for the current time window
  const handleLoadDerivedSignals = async () => {
    if (!metadata) return;

    // Get enabled signals only
    const enabledSignals = signals.filter(s => s.enabled);
    if (enabledSignals.length === 0) {
      // Clear signal data if no signals are enabled
      clearSignalData();
      return;
    }

    try {
      // Prepare signal data for API
      const signalsRequest = enabledSignals.map(signal => ({
        id: signal.id,
        expression: signal.expression,
        operands: signal.operands,
      }));

      // Call the calculateSignals API
      const results = await calculateSignals(
        metadata.file_id,
        signalsRequest,
        currentTime,
        windowDuration
      );

      // Store results in Zustand store
      setSignalDataBatch(results);
    } catch (err: any) {
      console.error('Failed to calculate derived signals:', err);
      // Don't show error to user - derived signals are optional
      // Just clear the signal data
      clearSignalData();
    }
  };

  // 处理选择变化
  const handleSelectionChange = (_start: number | null, _end: number | null) => {
    // 选择状态已在WaveformCanvas中处理，这里可以添加额外的逻辑
    // 例如，当用户完成选择时，可以保存到store
  };

  // Debounced version of handleLoadWaveform for rapid pan/zoom operations
  const debouncedLoadWaveform = useCallback(
    debounce(() => {
      if (metadata) {
        handleLoadWaveform();
      }
    }, 300),
    [metadata, currentTime, windowDuration, selectedChannels]
  );

  // Auto-load waveform when relevant state changes
  useEffect(() => {
    if (metadata) {
      debouncedLoadWaveform();
    }

    return () => {
      debouncedLoadWaveform.cancel();
    };
  }, [currentTime, windowDuration, selectedChannels, metadata, debouncedLoadWaveform]);

  // Debounced version of handleLoadDerivedSignals
  const debouncedLoadDerivedSignals = useCallback(
    debounce(() => {
      if (metadata && signals.length > 0) {
        handleLoadDerivedSignals();
      }
    }, 300),
    [metadata, currentTime, windowDuration, signals]
  );

  // Auto-load derived signals when time window or signals change
  useEffect(() => {
    if (metadata && signals.length > 0) {
      debouncedLoadDerivedSignals();
    }

    return () => {
      debouncedLoadDerivedSignals.cancel();
    };
  }, [currentTime, windowDuration, signals, metadata, debouncedLoadDerivedSignals]);

  // Auto-run analysis when selection changes or analysis type changes
  useEffect(() => {
    if (hasSelection && selectionStart !== null && selectionEnd !== null && metadata) {
      runAnalysis(selectionStart, selectionEnd, selectedAnalysisType);
    } else {
      clearAnalysisResults();
    }
  }, [hasSelection, selectionStart, selectionEnd, metadata, selectedAnalysisType]);

  // Load and update mode recommendations when metadata changes
  useEffect(() => {
    if (metadata && metadata.channel_names.length > 0) {
      updateModeRecommendations(metadata.channel_names);
    }
  }, [metadata, updateModeRecommendations]);

  // Generate annotations after EDF file is loaded
  useEffect(() => {
    if (metadata?.file_id && import.meta.env.MODE !== 'test') {
      generateAnnotationsAction(metadata.file_id).catch(() => {
        // Silently fail - annotations are optional
      });
    }
  }, [metadata?.file_id, generateAnnotationsAction]);

  // Merge original waveform data with derived signal data
  const mergedWaveformData = React.useMemo(() => {
    if (!waveform) return null;

    // Start with original waveform data
    const mergedData = {
      ...waveform,
      data: [...waveform.data],
      channels: [...waveform.channels],
    };

    // Add enabled derived signals
    const enabledSignals = signals.filter(s => s.enabled);
    enabledSignals.forEach(signal => {
      const signalResult = signalData.get(signal.id);
      if (signalResult) {
        mergedData.data.push(signalResult.data);
        mergedData.channels.push(signal.name);
      }
    });

    return mergedData;
  }, [waveform, signalData, signals]);

  // Calculate layout parameters for axes
  const pixelsPerSecond = (canvasWidth - 50) / windowDuration;
  // Use merged waveform data for channel count (includes derived signals)
  const actualNumChannels = mergedWaveformData ? mergedWaveformData.channels.length : (waveform ? waveform.channels.length : 10);
  const channelHeight = mergedWaveformData ? canvasHeight / mergedWaveformData.channels.length : (waveform ? canvasHeight / waveform.channels.length : 100);

  // Signal management handlers
  const handleSaveSignal = (signal: any) => {
    if (editingSignal) {
      updateSignal(editingSignal.id, signal);
    } else {
      addSignal(signal);
    }
    if (metadata) {
      saveSignalsToStorage(metadata.file_id);
    }
    setIsSignalEditorOpen(false);
    setEditingSignal(null);
  };

  const handleEditSignal = (signal: any) => {
    setEditingSignal(signal);
    setIsSignalEditorOpen(true);
  };

  const handleDeleteSignal = (id: string) => {
    deleteSignal(id);
    if (metadata) {
      saveSignalsToStorage(metadata.file_id);
    }
  };

  const handleToggleSignal = (id: string) => {
    toggleSignal(id);
    if (metadata) {
      saveSignalsToStorage(metadata.file_id);
    }
  };

  const handleAddNewSignal = () => {
    setEditingSignal(null);
    setIsSignalEditorOpen(true);
  };

  // 模式管理处理函数
  const handleModeChange = async (modeId: string | null) => {
    if (!modeId) {
      clearMode();
      return;
    }

    const mode = modes.find((m) => m.id === modeId);
    if (!mode) return;

    // 检查兼容性 (使用前端兼容性检查工具)
    const { checkModeCompatibility } = await import('./utils/modeCompatibilityChecker');
    const compatibility = checkModeCompatibility(mode, metadata?.channel_names ?? [], metadata?.sfreq ?? 0);

    if (!compatibility.isCompatible) {
      // 显示兼容性警告
      setPendingModeId(modeId);
      setPendingCompatibilityIssues(compatibility.issues);
      setShowCompatibilityWarning(true);
    } else {
      // 直接应用模式
      try {
        await applyMode(modeId);
      } catch (error) {
        console.error('Failed to apply mode:', error);
      }
    }
  };

  const handleConfirmMode = async () => {
    if (pendingModeId) {
      try {
        await applyMode(pendingModeId);
        setShowCompatibilityWarning(false);
        setPendingModeId(null);
        setPendingCompatibilityIssues([]);
      } catch (error) {
        console.error('Failed to apply mode:', error);
      }
    }
  };

  const handleCancelMode = () => {
    setShowCompatibilityWarning(false);
    setPendingModeId(null);
    setPendingCompatibilityIssues([]);
  };

  // 模式编辑器处理函数
  const handleCreateMode = () => {
    setEditingMode(null);
    setIsModeEditorOpen(true);
  };

  const handleEditMode = () => {
    const currentMode = getCurrentMode();
    setEditingMode(currentMode || null);
    setIsModeEditorOpen(true);
  };

  const handleSaveMode = (_savedMode: any) => {
    // 重新加载模式列表
    loadModes();
    setIsModeEditorOpen(false);
    setEditingMode(null);
  };

  const handleDeleteMode = async (modeId: string) => {
    // 如果删除的是当前选中的模式，清除选中状态
    if (currentModeId === modeId) {
      clearMode();
    }
    // 重新加载模式列表
    loadModes();
  };

  const handleCancelModeEdit = () => {
    setIsModeEditorOpen(false);
    setEditingMode(null);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [timeJumpInput, setTimeJumpInput] = useState('');

  const parseTimeJump = (input: string): number => {
    const parts = input.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseFloat(parts[1]);
      if (!isNaN(mins) && !isNaN(secs)) {
        return mins * 60 + secs;
      }
    }
    return -1;
  };

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('edf-bookmarks');
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks));
      } catch (e) {
        console.error('Failed to parse bookmarks from localStorage:', e);
      }
    }
  }, [setBookmarks]);

  // Save bookmarks to localStorage when they change
  useEffect(() => {
    if (bookmarks.length > 0) {
      localStorage.setItem('edf-bookmarks', JSON.stringify(bookmarks));
    } else {
      localStorage.removeItem('edf-bookmarks');
    }
  }, [bookmarks]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleZoomIn = () => {
    setWindowDuration(Math.max(1, windowDuration - 5));
  };

  const handleZoomOut = () => {
    setWindowDuration(Math.min(60, windowDuration + 5));
  };

  const handleAmplitudeIn = () => {
    setAmplitudeScale(Math.min(10, amplitudeScale + 0.5));
  };

  const handleAmplitudeOut = () => {
    setAmplitudeScale(Math.max(0.1, amplitudeScale - 0.5));
  };

  const handleAmplitudeChange = (scale: number) => {
    setAmplitudeScale(scale);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check if metadata exists (file loaded)
      if (!metadata) return;

      const maxTime = metadata.duration_seconds - windowDuration;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime(Math.max(0, currentTime - windowDuration));
          break;

        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime(Math.min(maxTime, currentTime + windowDuration));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setAmplitudeScale(Math.min(10, amplitudeScale + 0.5));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setAmplitudeScale(Math.max(0.1, amplitudeScale - 0.5));
          break;

        case '+':
        case '=':
          e.preventDefault();
          setWindowDuration(Math.max(1, windowDuration - 5));
          break;

        case '-':
        case '_':
          e.preventDefault();
          setWindowDuration(Math.min(60, windowDuration + 5));
          break;

        case 'Home':
          e.preventDefault();
          setCurrentTime(0);
          break;

        case 'End':
          e.preventDefault();
          setCurrentTime(maxTime);
          break;

        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;

        case '?':
          e.preventDefault();
          // Toggle help tooltip visibility
          const helpTooltip = document.querySelector('.keyboard-help-tooltip');
          if (helpTooltip) {
            helpTooltip.classList.toggle('visible');
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [metadata, currentTime, windowDuration, amplitudeScale, isPlaying]);

  // Channel colors for visualization
  const baseChannelColors = [
    '#2196F3', '#4CAF50', '#F44336', '#FF9800', '#9C27B0',
    '#00BCD4', '#8BC34A', '#FF5722', '#673AB7', '#E91E63',
    '#009688', '#CDDC39', '#FFC107', '#03A9F4', '#3F51B5',
  ];

  // Generate colors for all channels (original + derived)
  const channelColors = React.useMemo(() => {
    if (!mergedWaveformData) return baseChannelColors;

    const colors = [...baseChannelColors];

    // Add colors for derived signals
    const enabledSignals = signals.filter(s => s.enabled);
    enabledSignals.forEach((signal, index) => {
      // Use custom color if provided, otherwise generate a color
      if (signal.color) {
        colors.push(signal.color);
      } else {
        // Generate distinct colors for derived signals (starting from index 15)
        const derivedColorIndex = 15 + index;
        colors.push(baseChannelColors[derivedColorIndex % baseChannelColors.length]);
      }
    });

    return colors;
  }, [mergedWaveformData, waveform, signals, baseChannelColors]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>EDF Viewer</h1>
          <span className="subtitle">Professional EEG Data Visualization</span>
        </div>
        <div className="header-right">
          <button
            className="icon-button"
            onClick={() => {
              const helpTooltip = document.querySelector('.keyboard-help-tooltip');
              if (helpTooltip) {
                helpTooltip.classList.toggle('visible');
              }
            }}
            title="Keyboard Shortcuts (?)"
          >
            ⌨️
          </button>
        </div>
      </header>

      <div className="keyboard-help-tooltip">
        <h3>Keyboard Shortcuts</h3>
        <div className="shortcut-list">
          <div className="shortcut-item">
            <kbd>←</kbd> <kbd>→</kbd>
            <span>Pan left/right by window duration</span>
          </div>
          <div className="shortcut-item">
            <kbd>↑</kbd> <kbd>↓</kbd>
            <span>Adjust amplitude scale (±0.5x)</span>
          </div>
          <div className="shortcut-item">
            <kbd>+</kbd> <kbd>-</kbd>
            <span>Zoom time window (±5s)</span>
          </div>
          <div className="shortcut-item">
            <kbd>Home</kbd>
            <span>Jump to file start</span>
          </div>
          <div className="shortcut-item">
            <kbd>End</kbd>
            <span>Jump to file end</span>
          </div>
          <div className="shortcut-item">
            <kbd>Space</kbd>
            <span>Toggle play/pause</span>
          </div>
          <div className="shortcut-item">
            <kbd>?</kbd>
            <span>Show/hide this help</span>
          </div>
        </div>
        <p className="shortcut-note">Press <kbd>?</kbd> or click ⌨️ to toggle</p>
      </div>

      <main className="main-layout">
        <section className={`left-sidebar ${isLeftSidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={toggleLeftSidebar}
            title={isLeftSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            aria-label={isLeftSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {isLeftSidebarCollapsed ? '→' : '←'}
          </button>

          <div {...getRootProps()} className={`dropzone ${isLoading ? 'loading' : ''}`}>
            <input {...getInputProps()} />
            <p>Drag & drop EDF file here<br/>拖放 EDF 文件到此处</p>
          </div>

          {error && (
            <div className="error">{error}</div>
          )}

          {metadata && (
            <div className="metadata">
              <h3>File Info</h3>
              <div className="info-item">
                <span className="label">File:</span>
                <span className="value">{metadata.filename}</span>
              </div>
              <div className="info-item">
                <span className="label">Size:</span>
                <span className="value">{metadata.file_size_mb} MB</span>
              </div>
              <div className="info-item">
                <span className="label">Channels:</span>
                <span className="value">{metadata.n_channels}</span>
              </div>
              <div className="info-item">
                <span className="label">Duration:</span>
                <span className="value">{metadata.duration_minutes.toFixed(1)} min</span>
              </div>
              <div className="info-item">
                <span className="label">Sampling:</span>
                <span className="value">{metadata.sfreq} Hz</span>
              </div>
              <div className="info-item">
                <span className="label">Date:</span>
                <span className="value">{metadata.meas_date?.split('T')[0]}</span>
              </div>
              <div className="info-item">
                <span className="label">Patient ID:</span>
                <span className="value">{metadata.patient_info.patient_id}</span>
              </div>
            </div>
          )}

          {metadata && (
            <div className="controls">
              <h3>Time Window</h3>

              <label>Quick Zoom:</label>
              <div className="window-presets">
                <button
                  onClick={() => setWindowDuration(1)}
                  className={windowDuration === 1 ? 'active' : ''}
                >
                  1s
                </button>
                <button
                  onClick={() => setWindowDuration(5)}
                  className={windowDuration === 5 ? 'active' : ''}
                >
                  5s
                </button>
                <button
                  onClick={() => setWindowDuration(10)}
                  className={windowDuration === 10 ? 'active' : ''}
                >
                  10s
                </button>
                <button
                  onClick={() => setWindowDuration(30)}
                  className={windowDuration === 30 ? 'active' : ''}
                >
                  30s
                </button>
                <button
                  onClick={() => setWindowDuration(60)}
                  className={windowDuration === 60 ? 'active' : ''}
                >
                  1m
                </button>
                <button
                  onClick={() => setWindowDuration(300)}
                  className={windowDuration === 300 ? 'active' : ''}
                >
                  5m
                </button>
              </div>

              <TimeScrubber
                currentTime={currentTime}
                totalDuration={metadata.duration_seconds}
                windowDuration={windowDuration}
                onTimeChange={setCurrentTime}
              />

              <label>
                Start Time (s):
                <div className="input-with-buttons">
                  <button onClick={() => setCurrentTime(Math.max(0, currentTime - 10))} disabled={currentTime === 0}>
                    -10s
                  </button>
                  <input
                    type="number"
                    value={currentTime}
                    onChange={(e) => setCurrentTime(Number(e.target.value))}
                    min={0}
                    max={Math.floor(metadata.duration_seconds - windowDuration)}
                    step={1}
                  />
                  <button onClick={() => setCurrentTime(Math.min(metadata.duration_seconds - windowDuration, currentTime + 10))} disabled={currentTime >= metadata.duration_seconds - windowDuration}>
                    +10s
                  </button>
                </div>
              </label>

              <button onClick={handleLoadWaveform} disabled={isLoading} className="primary-button">
                {isLoading ? 'Loading...' : 'Load Waveform'}
              </button>
            </div>
          )}

          {metadata && (
            <div className="controls">
              <h3>Navigation</h3>

              <label>Time Jump (MM:SS):</label>
              <div className="input-with-buttons">
                <input
                  type="text"
                  value={timeJumpInput}
                  onChange={(e) => setTimeJumpInput(e.target.value)}
                  placeholder="00:00"
                />
                <button onClick={() => {
                  const time = parseTimeJump(timeJumpInput);
                  if (time >= 0 && time <= metadata.duration_seconds) {
                    setCurrentTime(time);
                    setTimeJumpInput('');
                  }
                }}>
                  Jump
                </button>
              </div>

              <label>Quick Jump:</label>
              <div className="button-group">
                <button onClick={() => setCurrentTime(0)}>Start</button>
                <button onClick={() => setCurrentTime(metadata.duration_seconds / 2)}>Middle</button>
                <button onClick={() => setCurrentTime(Math.max(0, metadata.duration_seconds - windowDuration))}>End</button>
              </div>

              <label>Bookmarks:</label>
              <div className="input-with-buttons">
                <input
                  type="text"
                  placeholder="Bookmark label"
                  id="bookmark-label-input"
                />
                <button onClick={() => {
                  const input = document.getElementById('bookmark-label-input') as HTMLInputElement;
                  const label = input?.value || `Bookmark ${bookmarks.length + 1}`;
                  addBookmark(label, currentTime);
                  if (input) input.value = '';
                }}>
                  Add
                </button>
              </div>

              {bookmarks.length > 0 && (
                <div className="bookmarks-list">
                  {bookmarks.map((bookmark) => (
                    <div key={bookmark.id} className="bookmark-item">
                      <span className="bookmark-label">{bookmark.label}</span>
                      <span className="bookmark-time">{formatTime(bookmark.time)}</span>
                      <button onClick={() => jumpToBookmark(bookmark.time)}>Go</button>
                      <button onClick={() => removeBookmark(bookmark.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="waveform-display">
          {waveform && (
            <>
              <div className="waveform-display-container" ref={waveformContainerRef}>
                <div className="amplitude-axis-wrapper">
                <AmplitudeAxis
                  channelHeight={channelHeight}
                  numChannels={actualNumChannels}
                  amplitudeScale={amplitudeScale}
                  unit="µV"
                />
                </div>
                <WaveformCanvas
                  waveformData={mergedWaveformData || waveform}
                  channelColors={channelColors}
                  currentTime={currentTime}
                  windowDuration={windowDuration}
                  amplitudeScale={amplitudeScale}
                  onTimeChange={setCurrentTime}
                  onAmplitudeChange={setAmplitudeScale}
                  onHeightChange={setCanvasHeight}
                  onSelectionChange={handleSelectionChange}
                  selectionStart={selectionStart}
                  selectionEnd={selectionEnd}
                  isSelecting={isSelecting}
                  hasSelection={hasSelection}
                />
              </div>

              <div className="time-axis-wrapper">
                <TimeAxis
                  duration={windowDuration}
                  startTime={currentTime}
                  width={canvasWidth}
                  pixelsPerSecond={pixelsPerSecond}
                />
              </div>

              <OverviewStrip
                fileId={metadata?.file_id || ''}
                currentTime={currentTime}
                windowDuration={windowDuration}
                totalDuration={metadata?.duration_seconds || 0}
                onTimeChange={setCurrentTime}
                channels={selectedChannels}
              />
            </>
          )}
        </section>

        <section className={`right-sidebar ${isRightSidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={toggleRightSidebar}
            title={isRightSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            aria-label={isRightSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {isRightSidebarCollapsed ? '←' : '→'}
          </button>

          {metadata && (
            <>
              <ModeSelector
                onModeChange={handleModeChange}
                onCreateMode={handleCreateMode}
                onEditMode={handleEditMode}
              />

              <ChannelSelector
                channels={metadata.channel_names}
                selectedChannels={selectedChannels}
                onChannelToggle={toggleChannel}
                onSelectAll={selectAllChannels}
                onDeselectAll={deselectAllChannels}
              />

              <SignalList
                signals={signals}
                onEdit={handleEditSignal}
                onDelete={handleDeleteSignal}
                onToggle={handleToggleSignal}
                onAddNew={handleAddNewSignal}
              />
            </>
          )}
        </section>
      </main>

      {metadata && (
        <TimeToolbar
          currentTime={currentTime}
          duration={windowDuration}
          totalDuration={metadata.duration_seconds}
          amplitudeScale={amplitudeScale}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onStop={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onTimeChange={setCurrentTime}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onAmplitudeIn={handleAmplitudeIn}
          onAmplitudeOut={handleAmplitudeOut}
          onAmplitudeChange={handleAmplitudeChange}
        />
      )}

      {metadata && (
        <ResolutionIndicator
          samplingRate={metadata.sfreq}
          windowDuration={windowDuration}
          amplitudeScale={amplitudeScale}
          nChannelsSelected={selectedChannels.length}
          nChannelsTotal={metadata.n_channels}
          totalDuration={metadata.duration_seconds}
        />
      )}

      <InteractionHint />
      <KeyboardShortcuts />

      {metadata && (
        <SignalEditor
          isOpen={isSignalEditorOpen}
          signal={editingSignal}
          channelNames={metadata.channel_names}
          onSave={handleSaveSignal}
          onCancel={() => {
            setIsSignalEditorOpen(false);
            setEditingSignal(null);
          }}
        />
      )}

      {/* 兼容性警告 */}
      <CompatibilityWarning
        isOpen={showCompatibilityWarning}
        issues={pendingCompatibilityIssues}
        availableSignalCount={metadata?.channel_names.length ?? 0}
        modeName={modes.find(m => m.id === pendingModeId)?.name ?? 'Unknown Mode'}
        onConfirm={handleConfirmMode}
        onCancel={handleCancelMode}
      />

      {/* 模式编辑器 */}
      <ModeEditor
        isOpen={isModeEditorOpen}
        mode={editingMode}
        availableChannels={metadata?.channel_names ?? []}
        onSave={handleSaveMode}
        onCancel={handleCancelModeEdit}
        onDelete={handleDeleteMode}
      />

      {/* 分析结果视图 */}
      {(hasSelection || isAnalysisLoading || analysisError) && (
        <>
          {/* 分析类型切换器 */}
          <div className="analysis-type-switcher">
            <button
              className={`analysis-type-btn ${selectedAnalysisType === 'stats' ? 'active' : ''}`}
              onClick={() => setSelectedAnalysisType('stats')}
            >
              时域统计
            </button>
            <button
              className={`analysis-type-btn ${selectedAnalysisType === 'frequency' ? 'active' : ''}`}
              onClick={() => setSelectedAnalysisType('frequency')}
            >
              频带功率
            </button>
          </div>

          {/* 根据类型显示对应的分析视图 */}
          {selectedAnalysisType === 'stats' ? (
            <StatsView
              results={analysisResults}
              isLoading={isAnalysisLoading}
              error={analysisError}
              onClose={clearAnalysisResults}
            />
          ) : (
            <FrequencyView
              results={analysisResults}
              isLoading={isAnalysisLoading}
              error={analysisError}
              onClose={clearAnalysisResults}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
