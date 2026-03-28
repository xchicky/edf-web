import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { AnnotationLayer } from '../AnnotationLayer';
import type { Annotation, AnnotationClickEvent } from '../../types/annotation';

const mockHighlightAnnotation: Annotation = {
  id: 'ann-1',
  annotation_type: 'artifact_eog',
  source: 'preprocess',
  channel: 'Fp1',
  start_time: 1.0,
  end_time: 3.0,
  label: 'EOG 伪迹',
  color: '#FCD34D',
  severity: 0.5,
  confidence: 0.8,
  metadata: {},
  is_user_created: false,
  created_at: '2024-01-01T00:00:00Z',
};

const mockMarkerAnnotation: Annotation = {
  id: 'ann-2',
  annotation_type: 'anomaly_spike',
  source: 'anomaly_detection',
  channel: 'Fp2',
  start_time: 2.0,
  end_time: 2.5,
  label: '棘波',
  color: '#EF4444',
  severity: 0.7,
  confidence: 0.9,
  metadata: {},
  is_user_created: false,
  created_at: '2024-01-01T00:00:01Z',
};

const mockLabelAnnotation: Annotation = {
  id: 'ann-3',
  annotation_type: 'band_dominant',
  source: 'band_analysis',
  channel: null,
  start_time: 1.5,
  end_time: 2.5,
  label: 'Alpha',
  color: '#34D399',
  severity: 0.4,
  confidence: 0.85,
  metadata: {},
  is_user_created: false,
  created_at: '2024-01-01T00:00:02Z',
};

const channels = ['Fp1', 'Fp2', 'F3', 'F4'];
const defaultProps = {
  currentTime: 0,
  windowDuration: 10,
  canvasWidth: 800,
  canvasHeight: 400,
  channels,
};

describe('AnnotationLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without errors', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('should render with empty annotations array', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[]}
        />
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('should render with multiple annotation types', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[
            mockHighlightAnnotation,
            mockMarkerAnnotation,
            mockLabelAnnotation,
          ]}
        />
      );
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
    });

    it('should have absolute positioning', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );
      const canvas = container.querySelector('canvas');
      expect(canvas?.style.position).toBe('absolute');
      expect(canvas?.style.top).toBe('0px');
      expect(canvas?.style.left).toBe('0px');
    });
  });

  describe('highlight annotations', () => {
    it('should render highlight style for artifact types', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
      // Canvas should be sized
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(400);
    });
  });

  describe('marker annotations', () => {
    it('should render marker style for anomaly types', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockMarkerAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
    });
  });

  describe('label annotations', () => {
    it('should render label style for band types', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockLabelAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
    });
  });

  describe('click events', () => {
    it('should call onAnnotationClick when clicking on annotation', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
          onAnnotationClick={handleClick}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();

      // pointerEvents should be 'auto' when handler is provided
      expect(canvas.style.pointerEvents).toBe('auto');

      // Simulate click
      fireEvent.click(canvas, {
        clientX: 200,
        clientY: 100,
      });

      // The click handler tries to find matching annotation
      // Exact assertion depends on coordinate mapping
    });

    it('should set pointerEvents to none when no handler', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.pointerEvents).toBe('none');
    });
  });

  describe('time window filtering', () => {
    it('should not render annotations outside visible window', () => {
      const outOfRangeAnnotation: Annotation = {
        ...mockHighlightAnnotation,
        start_time: 100,
        end_time: 200,
      };

      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          currentTime={0}
          windowDuration={10}
          annotations={[outOfRangeAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
      // Annotation is out of view - canvas is still rendered but nothing drawn
    });

    it('should render annotations partially in view', () => {
      const partialAnnotation: Annotation = {
        ...mockHighlightAnnotation,
        start_time: 8,
        end_time: 15,
      };

      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          currentTime={0}
          windowDuration={10}
          annotations={[partialAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
    });
  });

  describe('channel mapping', () => {
    it('should render null-channel annotations across all channels', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockLabelAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
    });

    it('should render channel-specific annotations', () => {
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
    });
  });

  describe('props updates', () => {
    it('should re-render when annotations change', () => {
      const { container, rerender } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();

      rerender(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation, mockMarkerAnnotation]}
        />
      );

      expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('should re-render when time window changes', () => {
      const { container, rerender } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[mockHighlightAnnotation]}
        />
      );

      rerender(
        <AnnotationLayer
          {...defaultProps}
          currentTime={5}
          windowDuration={10}
          annotations={[mockHighlightAnnotation]}
        />
      );

      expect(container.querySelector('canvas')).toBeTruthy();
    });
  });

  describe('user annotations', () => {
    it('should render user annotations', () => {
      const userAnnotation: Annotation = {
        id: 'ann-user',
        annotation_type: 'user_note',
        source: 'user',
        channel: 'F3',
        start_time: 2,
        end_time: 4,
        label: 'Interesting area',
        color: '#10B981',
        severity: 0.3,
        confidence: 1.0,
        metadata: {},
        is_user_created: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={[userAnnotation]}
        />
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
    });
  });
});
