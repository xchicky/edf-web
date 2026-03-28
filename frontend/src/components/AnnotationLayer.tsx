import React from 'react';
import type {
  Annotation,
  AnnotationRenderStyle,
  AnnotationClickEvent,
} from '../types/annotation';
import {
  getAnnotationRenderStyle,
  getAnnotationColor,
  getAnnotationLabel,
} from '../types/annotation';

interface AnnotationLayerProps {
  annotations: Annotation[];
  currentTime: number;
  windowDuration: number;
  canvasWidth: number;
  canvasHeight: number;
  channels: string[];
  onAnnotationClick?: (event: AnnotationClickEvent) => void;
}

const LEFT_MARGIN = 50;

/**
 * 将时间值映射到 canvas X 坐标
 */
function timeToX(
  time: number,
  currentTime: number,
  windowDuration: number,
  canvasWidth: number
): number {
  const plotWidth = canvasWidth - LEFT_MARGIN;
  return LEFT_MARGIN + ((time - currentTime) / windowDuration) * plotWidth;
}

/**
 * 将通道名称映射到 canvas Y 区域
 */
function channelToY(
  channel: string | null,
  channels: string[],
  canvasHeight: number
): { yTop: number; yBottom: number } {
  const channelHeight = canvasHeight / channels.length;
  if (channel === null) {
    return { yTop: 0, yBottom: canvasHeight };
  }
  const index = channels.indexOf(channel);
  if (index === -1) {
    return { yTop: 0, yBottom: canvasHeight };
  }
  return {
    yTop: index * channelHeight,
    yBottom: (index + 1) * channelHeight,
  };
}

/**
 * 绘制 highlight 样式标注（半透明矩形覆盖）
 */
function drawHighlight(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  currentTime: number,
  windowDuration: number,
  canvasWidth: number,
  canvasHeight: number,
  channels: string[]
): void {
  const startX = timeToX(annotation.start_time, currentTime, windowDuration, canvasWidth);
  const endX = timeToX(annotation.end_time, currentTime, windowDuration, canvasWidth);
  const { yTop, yBottom } = channelToY(annotation.channel, channels, canvasHeight);

  // Clamp to visible area
  const clampedStartX = Math.max(LEFT_MARGIN, Math.min(startX, canvasWidth));
  const clampedEndX = Math.max(LEFT_MARGIN, Math.min(endX, canvasWidth));

  if (clampedStartX >= clampedEndX) return;

  const color = getAnnotationColor(annotation.annotation_type);
  const alpha = 0.15 + annotation.severity * 0.2;

  // Draw highlight rectangle
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fillRect(clampedStartX, yTop, clampedEndX - clampedStartX, yBottom - yTop);

  // Draw border
  ctx.strokeStyle = hexToRGBA(color, 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(clampedStartX, yTop, clampedEndX - clampedStartX, yBottom - yTop);

  // Draw label at top-left corner
  const label = annotation.label || getAnnotationLabel(annotation.annotation_type);
  if (clampedEndX - clampedStartX > 40) {
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = hexToRGBA(color, 0.9);
    ctx.fillText(label, clampedStartX + 4, yTop + 12);
  }
}

/**
 * 绘制 marker 样式标注（三角形标记 + 竖线）
 */
function drawMarker(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  currentTime: number,
  windowDuration: number,
  canvasWidth: number,
  canvasHeight: number,
  channels: string[]
): void {
  const midTime = (annotation.start_time + annotation.end_time) / 2;
  const x = timeToX(midTime, currentTime, windowDuration, canvasWidth);
  const { yTop, yBottom } = channelToY(annotation.channel, channels, canvasHeight);

  if (x < LEFT_MARGIN || x > canvasWidth) return;

  const color = getAnnotationColor(annotation.annotation_type);

  // Draw vertical line
  ctx.strokeStyle = hexToRGBA(color, 0.7);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x, yBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw triangle marker at top
  const markerSize = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x - markerSize, yTop - markerSize);
  ctx.lineTo(x + markerSize, yTop - markerSize);
  ctx.closePath();
  ctx.fill();

  // Draw label
  const label = annotation.label || getAnnotationLabel(annotation.annotation_type);
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(label, x + 8, yTop - 2);
}

/**
 * 绘制 label 样式标注（文字标签 + 背景）
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  currentTime: number,
  windowDuration: number,
  canvasWidth: number,
  canvasHeight: number,
  channels: string[]
): void {
  const startX = timeToX(annotation.start_time, currentTime, windowDuration, canvasWidth);
  const { yTop, yBottom } = channelToY(annotation.channel, channels, canvasHeight);

  if (startX < LEFT_MARGIN || startX > canvasWidth) return;

  const color = getAnnotationColor(annotation.annotation_type);
  const label = annotation.label || getAnnotationLabel(annotation.annotation_type);

  // Measure text width
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const textWidth = ctx.measureText(label).width;
  const padding = 6;
  const labelHeight = 16;
  const midY = (yTop + yBottom) / 2 - labelHeight / 2;

  // Draw background pill
  ctx.fillStyle = hexToRGBA(color, 0.15);
  ctx.beginPath();
  const radius = 4;
  const bx = startX;
  const by = midY;
  const bw = textWidth + padding * 2;
  const bh = labelHeight;
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + bw - radius, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
  ctx.lineTo(bx + bw, by + bh - radius);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
  ctx.lineTo(bx + radius, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
  ctx.lineTo(bx, by + radius);
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.closePath();
  ctx.fill();

  // Draw border
  ctx.strokeStyle = hexToRGBA(color, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw text
  ctx.fillStyle = color;
  ctx.fillText(label, startX + padding, midY + 12);
}

/**
 * 将 hex 颜色转换为 RGBA
 */
function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 绘制单条标注
 */
function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  currentTime: number,
  windowDuration: number,
  canvasWidth: number,
  canvasHeight: number,
  channels: string[]
): void {
  const style: AnnotationRenderStyle = getAnnotationRenderStyle(
    annotation.annotation_type
  );

  switch (style) {
    case 'highlight':
      drawHighlight(ctx, annotation, currentTime, windowDuration, canvasWidth, canvasHeight, channels);
      break;
    case 'marker':
      drawMarker(ctx, annotation, currentTime, windowDuration, canvasWidth, canvasHeight, channels);
      break;
    case 'label':
      drawLabel(ctx, annotation, currentTime, windowDuration, canvasWidth, canvasHeight, channels);
      break;
  }
}

/**
 * AnnotationLayer 组件
 * 在 WaveformCanvas 上叠加渲染标注数据
 */
export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  annotations,
  currentTime,
  windowDuration,
  canvasWidth,
  canvasHeight,
  channels,
  onAnnotationClick,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // 渲染标注到 canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    for (const annotation of annotations) {
      drawAnnotation(
        ctx,
        annotation,
        currentTime,
        windowDuration,
        canvasWidth,
        canvasHeight,
        channels
      );
    }
  }, [annotations, currentTime, windowDuration, canvasWidth, canvasHeight, channels]);

  // 处理点击事件 - 找到点击位置对应的标注
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onAnnotationClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pixelX = (event.clientX - rect.left) * scaleX;
      const pixelY = (event.clientY - rect.top) * scaleY;

      // 将像素坐标转换为时间
      const plotWidth = canvasWidth - LEFT_MARGIN;
      const clickTime =
        currentTime + ((pixelX - LEFT_MARGIN) / plotWidth) * windowDuration;

      // 找到点击位置对应的标注
      for (const annotation of annotations) {
        if (clickTime < annotation.start_time || clickTime > annotation.end_time) {
          continue;
        }

        // 检查通道
        const { yTop, yBottom } = channelToY(
          annotation.channel,
          channels,
          canvasHeight
        );
        if (pixelY >= yTop && pixelY <= yBottom) {
          onAnnotationClick({
            annotation,
            pixelX: event.clientX - rect.left,
            pixelY: event.clientY - rect.top,
          });
          return;
        }
      }
    },
    [annotations, currentTime, windowDuration, canvasWidth, canvasHeight, channels, onAnnotationClick]
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: onAnnotationClick ? 'auto' : 'none',
      }}
    />
  );
};
