import React from 'react';
import type { Annotation, AnnotationClickEvent } from '../types/annotation';
import { ANNOTATION_STYLES } from '../types/annotation';
import { useAnnotationStore } from '../store/annotationStore';

interface AnnotationLayerProps {
  /** 标注数据列表（已过滤的） */
  annotations: Annotation[];
  /** 画布宽度（像素） */
  width: number;
  /** 画布高度（像素） */
  height: number;
  /** 当前时间窗口起始时间（秒） */
  currentTime: number;
  /** 时间窗口长度（秒） */
  windowDuration: number;
  /** 通道名称列表 */
  channels: string[];
  /** 振幅缩放 */
  amplitudeScale: number;
  /** 标注点击回调 */
  onAnnotationClick?: (event: AnnotationClickEvent) => void;
}

/** 左侧通道标签区域的宽度 */
const LABEL_WIDTH = 50;

/**
 * AnnotationLayer 组件
 * 在 WaveformCanvas 上叠加渲染标注信息
 * 使用 SVG 实现以支持交互事件
 */
export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  annotations,
  width,
  height,
  currentTime,
  windowDuration,
  channels,
  onAnnotationClick,
}) => {
  const setSelectedAnnotation = useAnnotationStore(state => state.setSelectedAnnotation);

  if (!annotations.length || !channels.length || width <= LABEL_WIDTH) {
    return null;
  }

  const plotWidth = width - LABEL_WIDTH;
  const channelHeight = height / channels.length;

  /** 将时间转换为 X 坐标 */
  const timeToX = (time: number): number => {
    return LABEL_WIDTH + ((time - currentTime) / windowDuration) * plotWidth;
  };

  /** 根据通道名获取 Y 坐标和高度 */
  const getChannelRect = (channel: string | null): { y: number; h: number } | null => {
    if (channel === null) {
      return { y: 0, h: height };
    }
    const idx = channels.indexOf(channel);
    if (idx === -1) return null;
    return { y: idx * channelHeight, h: channelHeight };
  };

  const handleClick = (annotation: Annotation, event: React.MouseEvent<SVGGElement>) => {
    const svgRect = (event.currentTarget as SVGGElement).ownerSVGElement?.getBoundingClientRect();
    const pixelX = svgRect ? event.clientX - svgRect.left : event.clientX;
    const pixelY = svgRect ? event.clientY - svgRect.top : event.clientY;

    const clickEvent: AnnotationClickEvent = {
      annotation,
      pixelX,
      pixelY,
    };

    setSelectedAnnotation(clickEvent);
    onAnnotationClick?.(clickEvent);
  };

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      {annotations.map(annotation => {
        const style = ANNOTATION_STYLES[annotation.annotation_type];
        const channelRect = getChannelRect(annotation.channel);
        if (!channelRect) return null;

        const x1 = timeToX(annotation.start_time);
        const x2 = timeToX(annotation.end_time);

        // 跳过不在视口内的标注
        if (x2 < LABEL_WIDTH || x1 > width) return null;

        const clampedX1 = Math.max(LABEL_WIDTH, x1);
        const clampedX2 = Math.min(width, x2);
        const rectWidth = clampedX2 - clampedX1;

        if (rectWidth <= 0) return null;

        const color = annotation.color || style.color;

        if (style.renderStyle === 'highlight') {
          return (
            <g
              key={annotation.id}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => handleClick(annotation, e)}
            >
              <rect
                x={clampedX1}
                y={channelRect.y}
                width={rectWidth}
                height={channelRect.h}
                fill={color}
                opacity={0.25}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.6}
              />
            </g>
          );
        }

        if (style.renderStyle === 'marker') {
          return (
            <g
              key={annotation.id}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => handleClick(annotation, e)}
            >
              <rect
                x={clampedX1}
                y={channelRect.y}
                width={rectWidth}
                height={channelRect.h}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.8}
                strokeDasharray="4,2"
              />
              {/* 三角标记 */}
              {clampedX1 > LABEL_WIDTH && (
                <polygon
                  points={`${clampedX1},${channelRect.y} ${clampedX1 + 8},${channelRect.y} ${clampedX1},${channelRect.y + 8}`}
                  fill={color}
                  opacity={0.9}
                />
              )}
            </g>
          );
        }

        // label 样式
        return (
          <g
            key={annotation.id}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={(e) => handleClick(annotation, e)}
          >
            <rect
              x={clampedX1}
              y={channelRect.y + 2}
              width={rectWidth}
              height={channelRect.h - 4}
              fill={color}
              opacity={0.15}
              rx={3}
            />
            {/* 标签文字 */}
            {rectWidth > 30 && (
              <text
                x={clampedX1 + 4}
                y={channelRect.y + 14}
                fontSize={10}
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                fill={color}
                opacity={0.9}
              >
                {annotation.label || style.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
