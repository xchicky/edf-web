// edf-web v1.0
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
import { AmplitudeAxis } from './components/AmplitudeAxis';
import { ResolutionIndicator } from './components/ResolutionIndicator';
import { InteractionHint } from './components/InteractionHint';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { AnnotationPanel } from './components/AnnotationPanel';
import { PipelinePanel } from './components/PipelinePanel';
import { AnomalyDetectionPanel } from './components/AnomalyDetectionPanel';
import { AutoPreprocessPanel } from './components/AutoPreprocessPanel';
import { TopToolbar } from './components/TopToolbar';
import { CollapsibleSection } from './components/CollapsibleSection';
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
    tcValue,
    hfValue,
    isPlaying,
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
    setTcValue,
    setHfValue,
    setIsPlaying,
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
    clearSelection,
    setSelectionChannel,
    setSelectedAnalysisType,
    // 模式管理方法
    loadModes,
    applyMode,
    clearMode,
    updateModeRecommendations,
    getCurrentMode,
  } = useEDFStore();

  const generateAnnotations = useAnnotationStore((s) => s.generateAnnotations);

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

  // Use useLayoutEffect to calculate width BEFORE initial render
  // This ensures TimeAxis and WaveformCanvas have matching widths from the start
  // Subtract 50px for the amplitude axis wrapper width
  React.useLayoutEffect(() => {
    const updateWidth = () => {
      if (waveformContainerRef.current) {
        const width = waveformContainerRef.current.clientWidth - 50;
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
        const width = waveformContainerRef.current.clientWidth - 50;
        setCanvasWidth(width);
      }
    }
  }, [waveform]);

  // Recalculate canvas width when sidebars collapse/expand
  // Wait for CSS transition (300ms) to complete before measuring
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (waveformContainerRef.current) {
        const width = waveformContainerRef.current.clientWidth - 50;
        setCanvasWidth(width);
      }
    }, 350); // Wait slightly longer than the 300ms transition

    return () => clearTimeout(timer);
  }, [isLeftSidebarCollapsed, isRightSidebarCollapsed]);

  // File input ref for toolbar upload button
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    reset();
    setLoading(true);
    setError(null);

    try {
      const result = await uploadEDF(file);
      setMetadata(result as any);

      generateAnnotations(result.file_id).catch(() => {});
      loadModes();
      loadSignalsFromStorage(result.file_id);

      const initialChannels = Array.from({ length: Math.min(10, result.n_channels) }, (_, i) => i);
      const waveformData = await getWaveform(result.file_id, 0, windowDuration, initialChannels);
      setWaveform(waveformData);
    } catch (err: any) {
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
  };

  const handleLoadWaveform = async () => {
    if (!metadata) return;

    setLoading(true);
    try {
      const filter: { highpass?: number; lowpass?: number } = {};
      if (tcValue !== null) filter.highpass = 1 / (2 * Math.PI * tcValue);
      if (hfValue !== null) filter.lowpass = hfValue;

      const waveformData = await getWaveform(
        metadata.file_id, currentTime, windowDuration, selectedChannels,
        Object.keys(filter).length > 0 ? filter : undefined,
      );
      setWaveform(waveformData);
    } catch (err: any) {
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
    [metadata, currentTime, windowDuration, selectedChannels, tcValue, hfValue]
  );

  // Auto-load waveform when relevant state changes
  useEffect(() => {
    if (metadata) {
      debouncedLoadWaveform();
    }

    return () => {
      debouncedLoadWaveform.cancel();
    };
  }, [currentTime, windowDuration, selectedChannels, metadata, tcValue, hfValue, debouncedLoadWaveform]);

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

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleZoomIn = () => {
    setWindowDuration(Math.max(1, windowDuration - 5));
  };

  const handleZoomOut = () => {
    setWindowDuration(Math.min(60, windowDuration + 5));
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
        <TopToolbar
          metadata={metadata}
          isLoading={isLoading}
          error={error}
          amplitudeScale={amplitudeScale}
          tcValue={tcValue}
          hfValue={hfValue}
          onAmplitudeChange={setAmplitudeScale}
          onTcChange={setTcValue}
          onHfChange={setHfValue}
          onUploadClick={() => fileInputRef.current?.click()}
          onToggleHelp={() => {
            const helpTooltip = document.querySelector('.keyboard-help-tooltip');
            if (helpTooltip) {
              helpTooltip.classList.toggle('visible');
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".edf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            handleFileUpload(file).finally(() => {
              e.target.value = '';
            });
          }}
        />
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
        {/* Left Sidebar: ModeSelector, ChannelSelector, SignalList, then Time/Navigation */}
        <section className={`left-sidebar ${isLeftSidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={toggleLeftSidebar}
            title={isLeftSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            aria-label={isLeftSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {isLeftSidebarCollapsed ? '→' : '←'}
          </button>

          {error && (
            <div className="error">{error}</div>
          )}

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

        {/* Center: waveform display */}
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
                  onSelectionChannelChange={setSelectionChannel}
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

        {/* Right Sidebar: AnnotationPanel, PipelinePanel, inline analysis, detection panels */}
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
              <AnnotationPanel
                fileId={metadata?.file_id || null}
                channels={metadata?.channel_names || []}
                onJumpToTime={(time) => setCurrentTime(time)}
              />

              <PipelinePanel />

              {(hasSelection || isAnalysisLoading || analysisError) && (
                <div className="analysis-section">
                  <div className="analysis-section-header">
                    <h3>选区分析</h3>
                    <button onClick={clearSelection} className="analysis-section-close">✕</button>
                  </div>
                  <div className="analysis-type-tabs">
                    <button
                      className={selectedAnalysisType === 'stats' ? 'active' : ''}
                      onClick={() => setSelectedAnalysisType('stats')}
                    >
                      时域统计
                    </button>
                    <button
                      className={selectedAnalysisType === 'frequency' ? 'active' : ''}
                      onClick={() => setSelectedAnalysisType('frequency')}
                    >
                      频带功率
                    </button>
                  </div>
                  {selectedAnalysisType === 'stats' ? (
                    <StatsView
                      results={analysisResults}
                      isLoading={isAnalysisLoading}
                      error={analysisError}
                      onClose={clearSelection}
                    />
                  ) : (
                    <FrequencyView
                      results={analysisResults}
                      isLoading={isAnalysisLoading}
                      error={analysisError}
                      onClose={clearSelection}
                    />
                  )}
                </div>
              )}

              <CollapsibleSection title="异常检测">
                <AnomalyDetectionPanel
                  fileId={metadata?.file_id || null}
                  channels={metadata?.channel_names || []}
                  duration={metadata?.duration_seconds || 0}
                  onJumpToTime={(time) => setCurrentTime(time)}
                />
              </CollapsibleSection>
              <CollapsibleSection title="自动预处理">
                <AutoPreprocessPanel
                  fileId={metadata?.file_id || null}
                  channelNames={metadata?.channel_names || []}
                />
              </CollapsibleSection>
            </>
          )}
        </section>
      </main>

      {metadata && (
        <TimeToolbar
          currentTime={currentTime}
          duration={windowDuration}
          totalDuration={metadata.duration_seconds}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onStop={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onTimeChange={setCurrentTime}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
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
    </div>
  );
}

export default App;
