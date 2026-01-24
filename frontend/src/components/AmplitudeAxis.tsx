import React from 'react';

interface AmplitudeAxisProps {
  channelHeight: number;      // Pixels per channel
  amplitudeScale: number;     // Current voltage scaling factor
  unit?: string;              // "µV" or "mV"
}

export const AmplitudeAxis: React.FC<AmplitudeAxisProps> = ({
  channelHeight,
  amplitudeScale,
  unit = 'µV',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const calculateAmplitudeRange = (scale: number): { min: number; max: number } => {
    const baseRange = 100; // 100µV default
    return {
      min: -baseRange * scale,
      max: baseRange * scale,
    };
  };

  const formatAmplitude = (microvolts: number): string => {
    return `${Math.round(microvolts)} ${unit}`;
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 50;
    canvas.height = channelHeight;

    // Clear canvas
    ctx.clearRect(0, 0, 50, channelHeight);

    const { min, max } = calculateAmplitudeRange(amplitudeScale);
    const range = max - min;
    const tickInterval = range / 4; // 5 ticks total (0, ±25%, ±50%)

    ctx.fillStyle = '#6C757D';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i++) {
      const value = min + (i * tickInterval);
      const y = channelHeight - ((value - min) / range) * channelHeight;

      // Draw tick mark
      ctx.strokeStyle = '#ADB5BD';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(45, y);
      ctx.lineTo(50, y);
      ctx.stroke();

      // Draw amplitude label
      ctx.fillText(formatAmplitude(value), 42, y);

      // Draw horizontal grid line
      ctx.strokeStyle = '#E9ECEF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(50, y); // Will extend when integrated with main canvas
      ctx.stroke();
    }
  }, [channelHeight, amplitudeScale, unit]);

  return <canvas ref={canvasRef} className="amplitude-axis" />;
};
