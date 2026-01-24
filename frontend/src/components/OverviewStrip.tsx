import React, { useEffect, useState, useRef } from 'react';
import { getWaveformOverview } from '../api/edf';

interface OverviewStripProps {
  fileId: string;
  currentTime: number;
  windowDuration: number;
  totalDuration: number;
  onTimeChange: (time: number) => void;
  channels?: number[];
}

interface OverviewData {
  data: number[][];
  times: number[];
  channels: string[];
  sfreq: number;
  n_samples: number;
  start_time: number;
  duration: number;
}

export const OverviewStrip: React.FC<OverviewStripProps> = ({
  fileId,
  currentTime,
  windowDuration,
  totalDuration,
  onTimeChange,
  channels,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);

  // Load overview data
  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getWaveformOverview(fileId, 1.0, channels);
        setOverviewData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load overview');
      } finally {
        setIsLoading(false);
      }
    };

    loadOverview();
  }, [fileId, channels]);

  // Render overview
  useEffect(() => {
    if (!overviewData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { data } = overviewData;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, width, height);

    // Calculate channel height
    const channelHeight = height / data.length;

    // Draw waveform data
    data.forEach((channelData, channelIndex) => {
      // Find min/max for scaling
      const minVal = Math.min(...channelData);
      const maxVal = Math.max(...channelData);
      const range = maxVal - minVal || 1;

      // Draw waveform
      ctx.strokeStyle = '#0066CC';
      ctx.lineWidth = 1;
      ctx.beginPath();

      channelData.forEach((value, sampleIndex) => {
        const x = (sampleIndex / (channelData.length - 1)) * width;
        const normalizedValue = (value - minVal) / range;
        const y = channelIndex * channelHeight + (1 - normalizedValue) * channelHeight;

        if (sampleIndex === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });

    // Draw current window overlay
    const windowStartX = (currentTime / totalDuration) * width;
    const windowWidth = (windowDuration / totalDuration) * width;

    ctx.fillStyle = 'rgba(255, 200, 0, 0.2)';
    ctx.fillRect(windowStartX, 0, windowWidth, height);

    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 2;
    ctx.strokeRect(windowStartX, 0, windowWidth, height);
  }, [overviewData, currentTime, windowDuration, totalDuration]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Convert x position to time
    const clickedTime = (x / canvas.width) * totalDuration;

    // Center the window on clicked position
    const newTime = Math.max(0, Math.min(clickedTime - windowDuration / 2, totalDuration - windowDuration));
    onTimeChange(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    setIsDragging(true);
    setDragStartX(x);
    setDragStartTime(currentTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate drag delta
    const dxPixels = x - dragStartX;
    const dxTime = (dxPixels / canvas.width) * totalDuration;

    // Update time
    const newTime = Math.max(0, Math.min(dragStartTime - dxTime, totalDuration - windowDuration));
    onTimeChange(newTime);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  if (isLoading) {
    return (
      <div className="overview-strip loading">
        <p>Loading overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-strip error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="overview-strip">
      <canvas
        ref={canvasRef}
        width={800}
        height={150}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
      />
    </div>
  );
};
