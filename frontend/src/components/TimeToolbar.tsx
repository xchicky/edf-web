import React from 'react';

interface TimeToolbarProps {
  currentTime: number;
  duration: number;
  totalDuration: number;
  isPlaying: boolean;
  amplitudeScale: number;
  onPlayPause: () => void;
  onStop: () => void;
  onTimeChange: (time: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAmplitudeIn: () => void;
  onAmplitudeOut: () => void;
  onAmplitudeChange: (scale: number) => void;
}

export const TimeToolbar: React.FC<TimeToolbarProps> = ({
  currentTime,
  duration,
  totalDuration,
  isPlaying,
  amplitudeScale,
  onPlayPause,
  onStop,
  onTimeChange,
  onZoomIn,
  onZoomOut,
  onAmplitudeIn,
  onAmplitudeOut,
  onAmplitudeChange,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const maxTime = Math.max(0, totalDuration - duration);

  return (
    <div className="time-toolbar">
      <div className="time-controls">
        <button onClick={onStop} className="icon-button" title="Stop">
          ◼
        </button>
        <button onClick={onPlayPause} className="icon-button" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      <div className="time-slider-container">
        <span className="time-display">{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={maxTime}
          value={currentTime}
          onChange={(e) => onTimeChange(Number(e.target.value))}
          className="time-slider"
        />
        <span className="time-display">{formatTime(totalDuration)}</span>
      </div>

      <div className="zoom-controls">
        <button onClick={onZoomOut} className="icon-button" title="Zoom Out">
          −
        </button>
        <span className="window-size">{duration}s</span>
        <button onClick={onZoomIn} className="icon-button" title="Zoom In">
          +
        </button>
      </div>

      <div className="amplitude-controls">
        <span className="control-label">Amp:</span>
        <button onClick={onAmplitudeOut} className="icon-button" title="Amplitude Out">
          −
        </button>
        <span className="scale-value">{amplitudeScale.toFixed(1)}x</span>
        <button onClick={onAmplitudeIn} className="icon-button" title="Amplitude In">
          +
        </button>
        <select
          value={amplitudeScale}
          onChange={(e) => onAmplitudeChange(Number(e.target.value))}
          className="scale-select"
          title="Amplitude Scale"
        >
          <option value="0.5">0.5x</option>
          <option value="1.0">1x</option>
          <option value="2.0">2x</option>
          <option value="5.0">5x</option>
          <option value="10.0">10x</option>
        </select>
      </div>
    </div>
  );
};
