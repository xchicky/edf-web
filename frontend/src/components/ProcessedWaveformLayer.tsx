import { useRef, useEffect } from 'react';
import type { ProcessedWaveformData } from '../types/pipeline';
import { usePipelineStore } from '../store/pipelineStore';

interface Props {
  width: number;
  height: number;
  waveformData: ProcessedWaveformData | null;
  currentTime: number;
  windowDuration: number;
  channelHeight: number;
  leftMargin?: number;
}

export function ProcessedWaveformLayer({
  width,
  height,
  waveformData,
  currentTime,
  windowDuration,
  channelHeight,
  leftMargin = 50,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const showOverlay = usePipelineStore((s) => s.showProcessedOverlay);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || !showOverlay) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const plotWidth = width - leftMargin;
    const nChannels = waveformData.channels.length;

    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);

    for (let i = 0; i < nChannels; i++) {
      const data = waveformData.data[i];
      if (!data || data.length === 0) continue;

      const times = waveformData.times;
      const yBase = i * channelHeight + channelHeight / 2;

      ctx.beginPath();

      let started = false;
      for (let j = 0; j < data.length; j++) {
        const t = times[j];
        if (t < currentTime || t > currentTime + windowDuration) continue;

        const x = leftMargin + ((t - currentTime) / windowDuration) * plotWidth;
        const y = yBase - (data[j] * channelHeight) / (200 * 1.0);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
  }, [width, height, waveformData, currentTime, windowDuration, channelHeight, leftMargin, showOverlay]);

  if (!waveformData || !showOverlay) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  );
}
