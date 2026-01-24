import React from 'react';

interface TimeAxisProps {
  duration: number;           // Visible window duration (seconds)
  startTime: number;          // Start time in file (seconds)
  width: number;              // Canvas width in pixels
  pixelsPerSecond: number;    // Zoom level
}

export const TimeAxis: React.FC<TimeAxisProps> = ({
  duration,
  startTime,
  width,
  pixelsPerSecond,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Calculate adaptive tick interval
  const calculateTickInterval = (duration: number): number => {
    const intervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const targetTickCount = 10;
    const idealInterval = duration / targetTickCount;
    return intervals.find((i) => i >= idealInterval) || 60;
  };

  // Format time as MM:SS or MM:SS.mmm
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (duration < 1) {
      // Show milliseconds for sub-second windows
      const millis = Math.round((secs % 1) * 1000);
      return `${mins.toString().padStart(2, '0')}:${Math.floor(secs).toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
    
    return `${mins.toString().padStart(2, '0')}:${Math.floor(secs).toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = 30;

    // Clear canvas
    ctx.clearRect(0, 0, width, 30);

    // Draw tick marks and labels
    const tickInterval = calculateTickInterval(duration);
    const numTicks = Math.ceil(duration / tickInterval) + 1;

    ctx.fillStyle = '#6C757D';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i < numTicks; i++) {
      const time = startTime + i * tickInterval;
      if (time > startTime + duration) break;

      const x = (i * tickInterval * pixelsPerSecond);

      // Draw tick mark
      ctx.strokeStyle = '#ADB5BD';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 5);
      ctx.stroke();

      // Draw time label
      ctx.fillText(formatTime(time), x, 18);
    }

    // Draw bottom border
    ctx.strokeStyle = '#DEE2E6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 29);
    ctx.lineTo(width, 29);
    ctx.stroke();
  }, [duration, startTime, width, pixelsPerSecond]);

  return <canvas ref={canvasRef} className="time-axis" />;
};
