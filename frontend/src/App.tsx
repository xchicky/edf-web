import { useDropzone } from 'react-dropzone';
import React, { useEffect, useCallback, useState } from 'react';
import debounce from 'lodash.debounce';
import { uploadEDF, getWaveform } from './api/edf';
import { useEDFStore } from './store/edfStore';
import { ChannelSelector } from './components/ChannelSelector';
import { TimeToolbar } from './components/TimeToolbar';
import { WaveformCanvas } from './components/WaveformCanvas';

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
  } = useEDFStore();

  // Track actual canvas width to match WaveformCanvas and TimeAxis
  const waveformContainerRef = React.useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = React.useState(800);

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

  // Calculate layout parameters for axes
  const pixelsPerSecond = (canvasWidth - 50) / windowDuration;
  const channelHeight = waveform ? 600 / waveform.channels.length : 100;

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
  const channelColors = [
    '#2196F3', '#4CAF50', '#F44336', '#FF9800', '#9C27B0',
    '#00BCD4', '#8BC34A', '#FF5722', '#673AB7', '#E91E63',
    '#009688', '#CDDC39', '#FFC107', '#03A9F4', '#3F51B5',
  ];

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
        <section className="left-sidebar">
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
              <div className="waveform-info-overlay">
                <div className="info-item">
                  <span className="label">Resolution:</span>
                  <span className="value">{metadata?.sfreq || 0} Hz</span>
                </div>
                <div className="info-item">
                  <span className="label">Duration:</span>
                  <span className="value">{windowDuration}s</span>
                </div>
                <div className="info-item">
                  <span className="label">Window:</span>
                  <span className="value">{formatTime(currentTime)} - {formatTime(currentTime + windowDuration)}</span>
                </div>
              </div>

              <div className="waveform-display-container" ref={waveformContainerRef}>
                <div className="amplitude-axis-wrapper">
                  <AmplitudeAxis
                    channelHeight={channelHeight}
                    amplitudeScale={amplitudeScale}
                    unit="µV"
                  />
                </div>
                <WaveformCanvas
                  waveformData={waveform}
                  channelColors={channelColors}
                  currentTime={currentTime}
                  windowDuration={windowDuration}
                  amplitudeScale={amplitudeScale}
                  onTimeChange={setCurrentTime}
                  onAmplitudeChange={setAmplitudeScale}
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

        <section className="right-sidebar">
          {metadata && (
            <>
              <ChannelSelector
                channels={metadata.channel_names}
                selectedChannels={selectedChannels}
                onChannelToggle={toggleChannel}
                onSelectAll={selectAllChannels}
                onDeselectAll={deselectAllChannels}
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
    </div>
  );
}

export default App;
