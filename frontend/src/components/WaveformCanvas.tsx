import React from 'react';
import type { WaveformData } from '../store/edfStore';
import { CursorOverlay } from './CursorOverlay';

interface WaveformCanvasProps {
  waveformData: WaveformData;
  channelColors: string[];
  onTimeChange?: (newTime: number) => void;
  onAmplitudeChange?: (newAmplitude: number) => void;
  currentTime?: number;
  windowDuration?: number;
  amplitudeScale?: number;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  waveformData,
  channelColors,
  onTimeChange,
  onAmplitudeChange,
  currentTime = 0,
  windowDuration = 5,
  amplitudeScale = 1.0,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<{x: number; time: number} | null>(null);
  const [cursorInfo, setCursorInfo] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    time: string;
    amplitude: string;
    channel: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    time: '',
    amplitude: '',
    channel: '',
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    if (x > 50) { // Don't drag on amplitude axis
      setIsDragging(true);
      setDragStart({
        x: event.clientX,
        time: currentTime,
      });
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (!isDragging && !dragStart && waveformData) {
      // Show cursor crosshair and tooltip
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      if (x > 50 && x < rect.width && y >= 0 && y < rect.height) {
        const pixelsPerSecond = (rect.width - 50) / windowDuration;
        const time = currentTime + (x - 50) / pixelsPerSecond;
        
        const channelHeight = rect.height / waveformData.channels.length;
        const channelIndex = Math.floor(y / channelHeight);
        
        if (channelIndex >= 0 && channelIndex < waveformData.channels.length) {
          const channel = waveformData.channels[channelIndex];
          const yBase = channelIndex * channelHeight + channelHeight / 2;
          const amplitude = (yBase - y) / amplitudeScale;
          
          setCursorInfo({
            visible: true,
            x,
            y,
            time: formatTime(time),
            amplitude: `${amplitude.toFixed(1)} µV`,
            channel,
          });
        }
      }
    }
    
    if (!isDragging || !dragStart || !onTimeChange) return;
    
    const dx = event.clientX - dragStart.x;
    const pixelsPerSecond = (canvasRef.current?.clientWidth || 800 - 50) / windowDuration;
    const dt = -dx / pixelsPerSecond; // Negative: drag left = move forward
    
    const newTime = Math.max(0, dt);
    onTimeChange(newTime);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDragStart(null);
    setCursorInfo(prev => ({ ...prev, visible: false }));
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    
    // Determine zoom axis based on mouse position
    // Left 50px = amplitude zoom, rest = time zoom
    if (mouseX < 50) {
      // Amplitude zoom
      if (onAmplitudeChange) {
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
        const newScale = amplitudeScale * zoomFactor;
        onAmplitudeChange(Math.max(0.1, Math.min(10, newScale)));
      }
    } else {
      // Time zoom (centered on mouse position)
      if (onTimeChange) {
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
        const mouseTimeRatio = mouseX / (rect.width - 50);
        
        const newDuration = Math.max(1, Math.min(60, windowDuration * zoomFactor));
        const timeAdjustment = (windowDuration - newDuration) * mouseTimeRatio;
        const newTime = Math.max(0, currentTime + timeAdjustment);
        
        onTimeChange(newTime);
      }
    }
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentElement = canvas.parentElement;
    if (!parentElement) return;

    const width = canvas.width = parentElement.clientWidth - 32;
    const height = canvas.height = 600;

    // Pre-render grid to offscreen canvas
    if (!gridCanvasRef.current || gridCanvasRef.current.width !== width || gridCanvasRef.current.height !== height) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = width;
      gridCanvas.height = height;
      gridCanvasRef.current = gridCanvas;

      const gridCtx = gridCanvas.getContext('2d');
      if (!gridCtx) return;

      // Draw grid on offscreen canvas
      gridCtx.strokeStyle = '#E9ECEF';
      gridCtx.lineWidth = 1;

      // Vertical grid lines (time)
      const timeStep = width / waveformData.duration;
      for (let t = 0; t <= waveformData.duration; t += 1) {
        const x = t * timeStep;
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
        gridCtx.stroke();
      }

      // Horizontal grid lines (amplitude)
      const numChannels = waveformData.channels.length;
      const channelHeight = height / numChannels;
      for (let i = 0; i <= numChannels; i++) {
        const y = i * channelHeight;
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(width, y);
        gridCtx.stroke();
      }
    }

    // Render with requestAnimationFrame for smooth updates
    const render = () => {
      if (!canvas || !gridCanvasRef.current) return;

      // Clear and set background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Draw pre-rendered grid
      ctx.drawImage(gridCanvasRef.current, 0, 0);

      // Draw waveforms
      const numChannels = waveformData.channels.length;
      const channelHeight = height / numChannels;

      waveformData.channels.forEach((channelData, i) => {
        const yBase = i * channelHeight + channelHeight / 2;
        const color = channelColors[i % channelColors.length];

        // Draw channel label background
        if (i % 2 === 0) {
          ctx.fillStyle = '#F8F9FA';
          ctx.fillRect(0, i * channelHeight, width, channelHeight);
        }

        // Draw waveform with path simplification at high density
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const data = waveformData.data[i];
        const times = waveformData.times;

        // Simplify path if data points > 2x pixels
        const pixelDensity = data.length / width;
        const step = pixelDensity > 2 ? Math.ceil(pixelDensity / 2) : 1;

        for (let j = 0; j < data.length; j += step) {
          const x = ((times[j] - waveformData.times[0]) / waveformData.duration) * width;
          const y = yBase - (data[j] * 0.5);
          if (j === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();

        // Draw channel label
        ctx.fillStyle = '#212529';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(channelData, 5, yBase + 4);
      });
    };

    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Schedule new render
    animationFrameRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [waveformData, channelColors]);

  return (
    <>
      <canvas 
      ref={canvasRef} 
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'crosshair' }}
    />
    <CursorOverlay
      visible={cursorInfo.visible}
      x={cursorInfo.x}
      y={cursorInfo.y}
      time={cursorInfo.time}
      amplitude={cursorInfo.amplitude}
      channel={cursorInfo.channel}
    />
  </>
  );
};
