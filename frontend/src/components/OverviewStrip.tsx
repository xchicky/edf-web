import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getWaveformOverview } from '../api/edf';

interface OverviewStripProps {
  fileId: string;
  currentTime: number;
  windowDuration: number;
  totalDuration: number;
  channels?: number[];
  onTimeChange?: (time: number) => void;
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
  channels,
  onTimeChange,
}) => {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, width, height);

    const channelHeight = height / data.length;

    data.forEach((channelData, channelIndex) => {
      const minVal = Math.min(...channelData);
      const maxVal = Math.max(...channelData);
      const range = maxVal - minVal || 1;

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

    const windowStartX = (currentTime / totalDuration) * width;
    const windowWidth = (windowDuration / totalDuration) * width;

    ctx.fillStyle = 'rgba(255, 200, 0, 0.2)';
    ctx.fillRect(windowStartX, 0, windowWidth, height);

    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 2;
    ctx.strokeRect(windowStartX, 0, windowWidth, height);
  }, [overviewData, currentTime, windowDuration, totalDuration]);

  const getTimeFromCanvasX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || totalDuration <= 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = x / rect.width;
    const time = ratio * totalDuration;
    return Math.max(0, Math.min(totalDuration - windowDuration, time));
  }, [totalDuration, windowDuration]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onTimeChange) return;
    setIsDragging(true);
    const newTime = getTimeFromCanvasX(e.clientX);
    onTimeChange(newTime);
  }, [onTimeChange, getTimeFromCanvasX]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !onTimeChange) return;
    const newTime = getTimeFromCanvasX(e.clientX);
    onTimeChange(newTime);
  }, [isDragging, onTimeChange, getTimeFromCanvasX]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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

  if (!overviewData) return null;

  const canvasHeight = Math.max(80, overviewData.data.length * 8);

  return (
    <div className="overview-strip">
      <canvas
        ref={canvasRef}
        width={800}
        height={canvasHeight}
        style={{ cursor: onTimeChange ? 'pointer' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};
