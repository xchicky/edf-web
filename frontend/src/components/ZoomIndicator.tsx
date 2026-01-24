import React from 'react';

interface ZoomIndicatorProps {
  timeZoom: number;        // Current window duration
  amplitudeZoom: number;   // Current amplitude scale
  maxTimeZoom: number;
  maxAmplitudeZoom: number;
}

export const ZoomIndicator: React.FC<ZoomIndicatorProps> = ({
  timeZoom,
  amplitudeZoom,
  maxTimeZoom,
  maxAmplitudeZoom,
}) => {
  const timePercent = (timeZoom / maxTimeZoom) * 100;
  const amplitudePercent = (amplitudeZoom / maxAmplitudeZoom) * 100;

  return (
    <div className="zoom-indicator">
      <div className="zoom-label">Zoom</div>
      <div className="zoom-bar-container">
        <div className="zoom-bar-time" style={{ width: `${timePercent}%`}}>
          <span className="zoom-label">T: {timeZoom}s</span>
        </div>
        <div className="zoom-bar-amplitude" style={{ width: `${amplitudePercent}%`}}>
          <span className="zoom-label">A: {amplitudeZoom}x</span>
        </div>
      </div>
    </div>
  );
};
