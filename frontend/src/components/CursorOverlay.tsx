import React from 'react';

interface CursorOverlayProps {
  visible: boolean;
  x: number;
  y: number;
  time: string;
  amplitude: string;
  channel: string;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  visible,
  x,
  y,
  time,
  amplitude,
  channel,
}) => {
  if (!visible) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    pointerEvents: 'none',
    zIndex: 20,
  };

  return (
    <div style={style}>
      <div
        style={{
          position: 'absolute',
          left: '-1000px',
          top: '50%',
          width: '2000px',
          height: '0',
          borderLeft: '1px dashed #0066CC',
          transform: 'translateY(-50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-1000px',
          left: '50%',
          height: '2000px',
          width: '0',
          borderTop: '1px dashed #0066CC',
          transform: 'translateX(-50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '10px',
          top: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #0066CC',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '11px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: '#212529',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <div><strong>Time:</strong> {time}</div>
        <div><strong>Amp:</strong> {amplitude}</div>
        <div><strong>Ch:</strong> {channel}</div>
      </div>
    </div>
  );
};
