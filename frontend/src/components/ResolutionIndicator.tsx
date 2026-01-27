import React from 'react';

interface ResolutionIndicatorProps {
  samplingRate: number;
  windowDuration: number;
  amplitudeScale: number;
  nChannelsSelected: number;
  nChannelsTotal: number;
  totalDuration: number;
}

export const ResolutionIndicator: React.FC<ResolutionIndicatorProps> = ({
  samplingRate,
  windowDuration,
  amplitudeScale,
  nChannelsSelected,
  nChannelsTotal,
  totalDuration,
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="resolution-bar">
      <div className="resolution-section">
        <span className="resolution-label">SF:</span>
        <span className="resolution-value">{samplingRate} Hz</span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Window:</span>
        <span className="resolution-value">{windowDuration}s</span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Amp:</span>
        <span className="resolution-value">{amplitudeScale.toFixed(1)}x</span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Ch:</span>
        <span className="resolution-value">
          {nChannelsSelected}/{nChannelsTotal}
        </span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Total:</span>
        <span className="resolution-value">{formatDuration(totalDuration)}</span>
      </div>
    </div>
  );
};
