import React from 'react';
import type { WaveformData } from '../store/edfStore';
import { CursorOverlay } from './CursorOverlay';
import { AnnotationLayer } from './AnnotationLayer';
import { useEDFStore } from '../store/edfStore';

interface WaveformCanvasProps {
  waveformData: WaveformData;
  channelColors: string[];
  onTimeChange?: (newTime: number) => void;
  onAmplitudeChange?: (newAmplitude: number) => void;
  onHeightChange?: (height: number) => void;
  currentTime?: number;
  windowDuration?: number;
  amplitudeScale?: number;
  // 选择相关属性
  onSelectionChange?: (start: number | null, end: number | null) => void;
  // 从store传入的选择状态
  selectionStart?: number | null;
  selectionEnd?: number | null;
  isSelecting?: boolean;
  hasSelection?: boolean;  // 是否有已确认的选择
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  waveformData,
  channelColors,
  onTimeChange,
  onAmplitudeChange,
  onHeightChange,
  currentTime = 0,
  windowDuration = 5,
  amplitudeScale = 1.0,
  onSelectionChange: _onSelectionChange,
  selectionStart = null,
  selectionEnd = null,
  isSelecting = false,
  hasSelection = false,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  // 选择状态直接从 store 获取（通过 props 传入）
  // 本地不再维护选择状态，确保与 store 同步
  // 跟踪鼠标按下位置，用于区分单击和拖拽
  const [mouseDownPos, setMouseDownPos] = React.useState<{x: number; y: number} | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [containerWidth, setContainerWidth] = React.useState(0);
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

    // 记录鼠标按下位置，用于区分单击和拖拽
    setMouseDownPos({ x: event.clientX, y: event.clientY });

    if (x > 50) { // Don't select on amplitude axis
      // 如果已有选择且不是在拖拽中，先清除选择
      if (hasSelection && !isSelecting) {
        const { clearSelection } = useEDFStore.getState();
        clearSelection();
        // 不开始新选择，等待用户确认是否要开始新的选择
        return;
      }

      // 计算点击位置对应的时间
      const canvasWidth = canvas.width;
      const pixelsPerSecond = (canvasWidth - 50) / windowDuration;
      const clickTime = currentTime + (x - 50) / pixelsPerSecond;

      // 直接更新store中的选择状态
      const { setSelectionStart, setSelectionEnd, setIsSelecting } = useEDFStore.getState();
      setSelectionStart(clickTime);
      setSelectionEnd(clickTime); // 初始时开始和结束相同
      setIsSelecting(true);

      // 设置选择光标
      canvas.style.cursor = 'col-resize';
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 从 props 获取选择状态（这些值来自 store）
    const isCurrentlySelecting = isSelecting;

    if (!isCurrentlySelecting && waveformData) {
      // Show cursor crosshair and tooltip
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (x > 50 && x < rect.width && y >= 0 && y < rect.height) {
        // CRITICAL: Use canvas.width (device pixels) for accurate calculation
        // rect.width can differ on high-DPI displays (devicePixelRatio)
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Convert mouse position from CSS pixels to canvas pixels
        const scaleX = canvasWidth / rect.width;
        const scaleY = canvasHeight / rect.height;
        const canvasX = x * scaleX;
        const canvasY = y * scaleY;

        const pixelsPerSecond = (canvasWidth - 50) / windowDuration;
        const time = currentTime + (canvasX - 50) / pixelsPerSecond;

        const channelHeight = canvasHeight / waveformData.channels.length;
        const channelIndex = Math.floor(canvasY / channelHeight);

        if (channelIndex >= 0 && channelIndex < waveformData.channels.length) {
          const channel = waveformData.channels[channelIndex];
          const yBase = channelIndex * channelHeight + channelHeight / 2;
          // Inverse of drawing formula: y = yBase - (data[j] * channelHeight) / (200 * amplitudeScale)
          // Therefore: data[j] = (yBase - y) * (200 * amplitudeScale) / channelHeight
          const amplitude = (yBase - canvasY) * (200 * amplitudeScale) / channelHeight;

          setCursorInfo({
            visible: true,
            x,  // Keep CSS pixels for cursor display position
            y,
            time: formatTime(time),
            amplitude: `${amplitude.toFixed(1)} µV`,
            channel,
          });
        }
      }
    }

    // 如果在选择模式，更新选择的结束时间
    if (isCurrentlySelecting) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;

      // 计算时间
      const canvasWidth = canvas.width;
      const pixelsPerSecond = (canvasWidth - 50) / windowDuration;
      const time = currentTime + (x - 50) / pixelsPerSecond;

      // 保持时间在有效范围内
      const clampedTime = Math.max(0, Math.min(time, currentTime + windowDuration));

      // 直接更新store中的选择状态
      const { setSelectionEnd } = useEDFStore.getState();
      setSelectionEnd(clampedTime);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }

    // 检查是单击还是拖拽
    if (mouseDownPos) {
      const dx = event.clientX - mouseDownPos.x;
      const dy = event.clientY - mouseDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        // 单击：清除选择
        const { clearSelection } = useEDFStore.getState();
        clearSelection();
        setMouseDownPos(null);
        return;
      }
    }

    // 拖拽：确认选择（保持选择显示）
    const { confirmSelection } = useEDFStore.getState();
    confirmSelection();
    setMouseDownPos(null);
  };

  const handleMouseLeave = () => {
    setCursorInfo(prev => ({ ...prev, visible: false }));

    // 如果正在选择，确认选择
    if (isSelecting) {
      const { confirmSelection } = useEDFStore.getState();
      confirmSelection();
    }
    setMouseDownPos(null);
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

  // Track container size with ResizeObserver for responsive canvas sizing
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const updateSize = () => {
      const width = canvas.clientWidth;
      if (width > 0) {
        setContainerWidth(prev => prev !== width ? width : prev);
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use CSS display width (canvas has width: 100% in CSS)
    const width = canvas.clientWidth;
    if (width <= 0) return;

    // Match pixel buffer to CSS display width
    canvas.width = width;

    // Calculate available height dynamically
    const parentElement = canvas.parentElement;
    const waveformDisplay = parentElement?.closest('.waveform-display');
    let height = 600; // Default fallback

    if (waveformDisplay) {
      const displayHeight = waveformDisplay.clientHeight;
      const availableHeight = displayHeight - 32;
      const timeAxisHeight = 30;
      const overviewStripHeight = 120;
      const margins = 8;
      const containerMargin = 32; // waveform-display-container margin: 16px * 2

      height = Math.max(400, availableHeight - timeAxisHeight - overviewStripHeight - margins - containerMargin);
    }

    canvas.height = height;
    setCanvasSize({ width, height });

    // Report actual height to parent for AmplitudeAxis alignment
    onHeightChange?.(height);

    // Pre-render grid to offscreen canvas
    // Invalidate grid cache when width, height, windowDuration, OR channel count changes
    const numChannels = waveformData.channels.length;
    if (!gridCanvasRef.current ||
        gridCanvasRef.current.width !== width ||
        gridCanvasRef.current.height !== height ||
        gridCanvasRef.current.dataset.windowDuration !== windowDuration.toString() ||
        gridCanvasRef.current.dataset.numChannels !== numChannels.toString()) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = width;
      gridCanvas.height = height;
      gridCanvas.dataset.windowDuration = windowDuration.toString(); // Store for cache comparison
      gridCanvas.dataset.numChannels = numChannels.toString(); // Store channel count for cache comparison
      gridCanvasRef.current = gridCanvas;

      const gridCtx = gridCanvas.getContext('2d');
      if (!gridCtx) return;

      // Draw grid on offscreen canvas
      gridCtx.strokeStyle = '#DEE2E6';
      gridCtx.lineWidth = 1;

      // Vertical grid lines (time) - 1 second intervals
      const timeStep = (width - 50) / windowDuration;
      for (let t = 0; t <= windowDuration; t += 1) {
        const x = 50 + t * timeStep;
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
        gridCtx.stroke();
      }

      // Horizontal grid lines (amplitude) - main and minor ticks
      const channelHeight = height / numChannels;

      // Amplitude range: -100 to 100 µV
      const voltageRange = 200; // -100 to 100
      const mainTickInterval = 50; // Main ticks every 50µV (5 ticks per channel)
      const minorTickInterval = 10; // Minor ticks every 10µV (5x finer)

      for (let ch = 0; ch < numChannels; ch++) {
        const channelTop = ch * channelHeight;
        const channelBottom = (ch + 1) * channelHeight;

        // Draw minor grid lines (thinner, lighter)
        gridCtx.strokeStyle = '#F0F0F0';
        gridCtx.lineWidth = 0.5;
        for (let v = -100; v <= 100; v += minorTickInterval) {
          const yInChannel = channelHeight - ((v + 100) / voltageRange) * channelHeight;
          const y = channelTop + yInChannel;
          gridCtx.beginPath();
          gridCtx.moveTo(50, y);
          gridCtx.lineTo(width, y);
          gridCtx.stroke();
        }

        // Draw main grid lines (thicker, darker)
        gridCtx.strokeStyle = '#DEE2E6';
        gridCtx.lineWidth = 1;
        for (let v = -100; v <= 100; v += mainTickInterval) {
          const yInChannel = channelHeight - ((v + 100) / voltageRange) * channelHeight;
          const y = channelTop + yInChannel;
          gridCtx.beginPath();
          gridCtx.moveTo(50, y);
          gridCtx.lineTo(width, y);
          gridCtx.stroke();
        }

        // Draw channel separator line (thick line between channels)
        gridCtx.strokeStyle = '#999999';
        gridCtx.lineWidth = 2;
        gridCtx.beginPath();
        gridCtx.moveTo(0, channelBottom);
        gridCtx.lineTo(width, channelBottom);
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
          const x = 50 + ((times[j] - waveformData.times[0]) / waveformData.duration) * (width - 50);
          // Map voltage to pixel position: voltage range [-100, 100] maps to channel height
          const y = yBase - (data[j] * channelHeight) / (200 * amplitudeScale);
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

      // 绘制选择区域
      // 使用props传入的选择状态
      // 在选择中或有已确认选择时都渲染选择框
      if ((isSelecting || hasSelection) && selectionStart !== null && selectionEnd !== null) {
        // 计算选择区域的像素位置
        const startX = 50 + ((selectionStart - currentTime) / windowDuration) * (width - 50);
        const endX = 50 + ((selectionEnd - currentTime) / windowDuration) * (width - 50);

        // 确保选择区域在有效范围内
        const clampedStartX = Math.max(50, Math.min(startX, width));
        const clampedEndX = Math.max(50, Math.min(endX, width));

        if (clampedStartX < clampedEndX) {
          // 绘制选择区域
          ctx.fillStyle = 'rgba(33, 150, 243, 0.2)'; // 半透明蓝色
          ctx.fillRect(clampedStartX, 0, clampedEndX - clampedStartX, height);

          // 绘制选择边框
          ctx.strokeStyle = '#2196F3'; // 深蓝色边框
          ctx.lineWidth = 1;
          ctx.strokeRect(clampedStartX, 0, clampedEndX - clampedStartX, height);
        }
      }
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
  }, [waveformData, channelColors, amplitudeScale, windowDuration, selectionStart, selectionEnd, isSelecting, currentTime, containerWidth]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'crosshair', width: '100%', display: 'block', boxSizing: 'border-box' }}
    />
    {waveformData && canvasSize.width > 0 && (
      <AnnotationLayer
        width={canvasSize.width}
        height={canvasSize.height}
        currentTime={currentTime}
        windowDuration={windowDuration}
        channels={waveformData.channels}
        channelHeight={canvasSize.height / waveformData.channels.length}
        leftMargin={50}
      />
    )}
    <CursorOverlay
      visible={cursorInfo.visible}
      x={cursorInfo.x}
      y={cursorInfo.y}
      time={cursorInfo.time}
      amplitude={cursorInfo.amplitude}
      channel={cursorInfo.channel}
    />
  </div>
  );
};
