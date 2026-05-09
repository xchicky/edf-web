import React from 'react';

interface TimeToolbarProps {
  currentTime: number;
  duration: number;
  totalDuration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onTimeChange: (time: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const TimeToolbar: React.FC<TimeToolbarProps> = ({
  currentTime,
  duration,
  totalDuration,
  isPlaying,
  onPlayPause,
  onStop,
  onTimeChange,
  onZoomIn,
  onZoomOut,
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
    </div>
  );
};
