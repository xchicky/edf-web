import React, { useRef, useEffect, useMemo } from "react";
import { useAnnotationStore } from "../store/annotationStore";
import { ANNOTATION_RENDER_CONFIG } from "../types/annotation";
import type { Annotation } from "../types/annotation";

interface AnnotationLayerProps {
  width: number;
  height: number;
  currentTime: number;
  windowDuration: number;
  channels: string[];
  channelHeight: number;
  leftMargin: number;
  onAnnotationClick?: (annotation: Annotation) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  width,
  height,
  currentTime,
  windowDuration,
  channels,
  channelHeight,
  leftMargin,
  onAnnotationClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getAnnotationsInTimeRange = useAnnotationStore(
    (s) => s.getAnnotationsInTimeRange
  );
  const visibilityFilter = useAnnotationStore((s) => s.visibilityFilter);

  // visibilityFilter is used to bust the memo cache when visibility changes,
  // since getAnnotationsInTimeRange is a stable function reference
  const visibleAnnotations = useMemo(() => {
    void visibilityFilter;
    return getAnnotationsInTimeRange(currentTime, currentTime + windowDuration);
  }, [currentTime, windowDuration, getAnnotationsInTimeRange, visibilityFilter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const plotWidth = width - leftMargin;

    visibleAnnotations.forEach((annotation) => {
      const config = ANNOTATION_RENDER_CONFIG[annotation.annotation_type];
      if (!config) return;

      const startX =
        leftMargin +
        ((annotation.start_time - currentTime) / windowDuration) * plotWidth;
      const endX =
        leftMargin +
        ((annotation.end_time - currentTime) / windowDuration) * plotWidth;

      const channelIndex = annotation.channel
        ? channels.indexOf(annotation.channel)
        : -1;

      if (config.mode === "highlight") {
        const yStart = channelIndex >= 0 ? channelIndex * channelHeight : 0;
        const rectHeight = channelIndex >= 0 ? channelHeight : height;
        ctx.fillStyle = hexToRgba(annotation.color, config.opacity);
        ctx.fillRect(
          Math.max(leftMargin, startX),
          yStart,
          Math.min(endX - startX, width - startX),
          rectHeight
        );
      } else if (config.mode === "marker") {
        if (startX < leftMargin || startX > width) return;
        const yBase = channelIndex >= 0 ? channelIndex * channelHeight : 0;
        ctx.fillStyle = annotation.color;
        ctx.font = "12px sans-serif";
        if (config.icon) {
          ctx.fillText(config.icon, startX - 6, yBase + 14);
        } else {
          ctx.beginPath();
          ctx.arc(startX, yBase + 8, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (config.mode === "label") {
        if (channelIndex >= 0) {
          const yBase = channelIndex * channelHeight + channelHeight / 2;
          ctx.fillStyle = annotation.color;
          ctx.beginPath();
          ctx.arc(leftMargin - 8, yBase - 8, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#374151";
          ctx.font = "9px sans-serif";
          const bandName =
            (annotation.metadata?.dominant_band as string) || "";
          if (bandName) ctx.fillText(bandName, leftMargin - 4, yBase - 4);
        }
      }
    });
  }, [
    visibleAnnotations,
    width,
    height,
    currentTime,
    windowDuration,
    channels,
    channelHeight,
    leftMargin,
  ]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAnnotationClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const plotWidth = width - leftMargin;
    const clickChannel = Math.floor(y / channelHeight);

    const hit = visibleAnnotations.find((a) => {
      const config = ANNOTATION_RENDER_CONFIG[a.annotation_type];
      if (!config) return false;
      const startX =
        leftMargin +
        ((a.start_time - currentTime) / windowDuration) * plotWidth;
      const chIdx = a.channel ? channels.indexOf(a.channel) : -1;
      if (config.mode === "marker") {
        return Math.abs(x - startX) < 10 && chIdx === clickChannel;
      }
      const endX =
        leftMargin +
        ((a.end_time - currentTime) / windowDuration) * plotWidth;
      return x >= startX && x <= endX && chIdx === clickChannel;
    });

    if (hit) onAnnotationClick(hit);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: onAnnotationClick ? "auto" : "none",
      }}
    />
  );
};
