import React, { useRef, useEffect, useState } from 'react';

interface TimeScrubberProps {
  currentTime: number;
  totalDuration: number;
  windowDuration: number;
  onTimeChange: (time: number) => void;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  currentTime,
  totalDuration,
  windowDuration,
  onTimeChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleScrub = (clientX: number) => {
    if (!scrubberRef.current || totalDuration <= 0) return;

    const rect = scrubberRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const maxTime = Math.max(0, totalDuration - windowDuration);
    const newTime = ratio * maxTime;
    onTimeChange(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleScrub(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleScrub(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const maxTime = Math.max(0, totalDuration - windowDuration);
  const position = maxTime > 0 ? (currentTime / maxTime) * 100 : 0;
  const windowWidth = totalDuration > 0 ? (windowDuration / totalDuration) * 100 : 0;

  return (
    <div
      className="time-scrubber"
      ref={scrubberRef}
      onMouseDown={handleMouseDown}
      title="Drag to navigate timeline"
    >
      <div className="scrubber-track">
        <div
          className="scrubber-window"
          style={{
            left: `${position}%`,
            width: `${windowWidth}%`,
          }}
        />
      </div>
    </div>
  );
};
