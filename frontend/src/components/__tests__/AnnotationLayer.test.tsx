import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { AnnotationLayer } from '../AnnotationLayer'
import type { Annotation } from '../../types/annotation'
import { useAnnotationStore } from '../../store/annotationStore'

// Mock annotation store
vi.mock('../../store/annotationStore', () => ({
  useAnnotationStore: vi.fn(() => vi.fn()),
}))

const mockAnnotationStore = vi.mocked(useAnnotationStore)

const createAnnotation = (overrides: Partial<Annotation> = {}): Annotation => ({
  id: 'ann-001',
  annotation_type: 'artifact_eog',
  source: 'preprocess',
  channel: 'Fp1',
  start_time: 1.0,
  end_time: 3.0,
  label: 'EOG artifact',
  color: '#FCD34D',
  severity: 0.7,
  confidence: 0.9,
  metadata: {},
  is_user_created: false,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

const defaultProps = {
  width: 800,
  height: 400,
  currentTime: 0,
  windowDuration: 10,
  channels: ['Fp1', 'Fp2', 'F3', 'F4'],
  amplitudeScale: 1.0,
}

describe('AnnotationLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnnotationStore.mockReturnValue(vi.fn())
  })

  describe('Rendering', () => {
    it('should render nothing when no annotations', () => {
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={[]} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render SVG with correct dimensions', () => {
      const annotations = [createAnnotation()]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const svg = container.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg?.getAttribute('width')).toBe('800')
      expect(svg?.getAttribute('height')).toBe('400')
    })

    it('should render nothing when channels are empty', () => {
      const annotations = [createAnnotation()]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} channels={[]} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing when width is too small', () => {
      const annotations = [createAnnotation()]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} width={40} />
      )
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Highlight rendering (artifact)', () => {
    it('should render highlight for artifact annotations', () => {
      const annotations = [createAnnotation({ annotation_type: 'artifact_eog' })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const rect = container.querySelector('rect')
      expect(rect).toBeTruthy()
      expect(rect?.getAttribute('fill')).toBe('#FCD34D')
    })

    it('should skip annotations for non-existent channels', () => {
      const annotations = [createAnnotation({ channel: 'NonExistent' })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const rects = container.querySelectorAll('rect')
      expect(rects).toHaveLength(0)
    })

    it('should render global annotation across all channels', () => {
      const annotations = [createAnnotation({ channel: null })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const rect = container.querySelector('rect')
      expect(rect).toBeTruthy()
    })
  })

  describe('Marker rendering (anomaly)', () => {
    it('should render dashed border for anomaly annotations', () => {
      const annotations = [createAnnotation({
        annotation_type: 'anomaly_spike',
        color: '#EF4444',
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const rects = container.querySelectorAll('rect')
      expect(rects.length).toBeGreaterThan(0)
      // Should have dashed stroke
      const borderRect = Array.from(rects).find(r => r.getAttribute('stroke-dasharray'))
      expect(borderRect).toBeTruthy()
    })

    it('should handle click on marker annotation', () => {
      const handleClick = vi.fn()
      const annotations = [createAnnotation({
        annotation_type: 'anomaly_spike',
        color: '#EF4444',
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} onAnnotationClick={handleClick} />
      )

      const g = container.querySelector('g')
      expect(g).toBeTruthy()
      if (g) {
        fireEvent.click(g)
        expect(handleClick).toHaveBeenCalledTimes(1)
      }
    })

    it('should render triangle marker for anomalies', () => {
      const annotations = [createAnnotation({
        annotation_type: 'anomaly_spike',
        color: '#EF4444',
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const polygon = container.querySelector('polygon')
      expect(polygon).toBeTruthy()
    })
  })

  describe('Label rendering (band/user)', () => {
    it('should render label for band annotations', () => {
      const annotations = [createAnnotation({
        annotation_type: 'band_dominant',
        color: '#34D399',
        label: 'Alpha dominant',
        start_time: 0,
        end_time: 10,
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const text = container.querySelector('text')
      expect(text).toBeTruthy()
      expect(text?.textContent).toBe('Alpha dominant')
    })

    it('should render label for user annotations', () => {
      const annotations = [createAnnotation({
        annotation_type: 'user_note',
        source: 'user',
        color: '#10B981',
        label: 'My note',
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const text = container.querySelector('text')
      expect(text).toBeTruthy()
      expect(text?.textContent).toBe('My note')
    })

    it('should handle click on label annotation', () => {
      const handleClick = vi.fn()
      const annotations = [createAnnotation({
        annotation_type: 'user_note',
        source: 'user',
        color: '#10B981',
        label: 'My note',
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} onAnnotationClick={handleClick} />
      )

      const g = container.querySelector('g')
      expect(g).toBeTruthy()
      if (g) {
        fireEvent.click(g)
        expect(handleClick).toHaveBeenCalledTimes(1)
      }
    })

    it('should not render text when rect is too narrow', () => {
      // Very short annotation that would be < 30px wide
      const annotations = [createAnnotation({
        annotation_type: 'band_dominant',
        color: '#34D399',
        label: 'Alpha dominant',
        start_time: 5.0,
        end_time: 5.01,
      })]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const text = container.querySelector('text')
      expect(text).toBeNull()
    })
  })

  describe('Time mapping', () => {
    it('should position annotations based on currentTime and windowDuration', () => {
      const annotations = [createAnnotation({
        start_time: 5,
        end_time: 8,
      })]
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={annotations}
          currentTime={5}
          windowDuration={10}
        />
      )

      const rect = container.querySelector('rect')
      expect(rect).toBeTruthy()
      // start_time=5 with currentTime=5 -> x should be at LABEL_WIDTH (50)
      expect(Number(rect?.getAttribute('x'))).toBeGreaterThanOrEqual(50)
    })

    it('should not render annotations outside viewport', () => {
      const annotations = [createAnnotation({
        start_time: 20,
        end_time: 25,
      })]
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={annotations}
          currentTime={0}
          windowDuration={10}
        />
      )

      const rects = container.querySelectorAll('rect')
      expect(rects).toHaveLength(0)
    })

    it('should clamp annotations partially outside viewport', () => {
      const annotations = [createAnnotation({
        start_time: -2,
        end_time: 2,
      })]
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={annotations}
          currentTime={0}
          windowDuration={10}
        />
      )

      const rect = container.querySelector('rect')
      expect(rect).toBeTruthy()
      // Should be clamped to LABEL_WIDTH (50)
      expect(Number(rect?.getAttribute('x'))).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Click events', () => {
    it('should call onAnnotationClick when annotation is clicked', () => {
      const handleClick = vi.fn()
      const annotations = [createAnnotation()]
      const { container } = render(
        <AnnotationLayer
          {...defaultProps}
          annotations={annotations}
          onAnnotationClick={handleClick}
        />
      )

      const g = container.querySelector('g')
      expect(g).toBeTruthy()
      if (g) {
        fireEvent.click(g)
        expect(handleClick).toHaveBeenCalledTimes(1)
        expect(handleClick).toHaveBeenCalledWith(
          expect.objectContaining({
            annotation: expect.objectContaining({ id: 'ann-001' }),
          })
        )
      }
    })

    it('should update store selected annotation on click', () => {
      const mockSetSelected = vi.fn()
      mockAnnotationStore.mockReturnValue(mockSetSelected)

      const annotations = [createAnnotation()]
      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const g = container.querySelector('g')
      if (g) {
        fireEvent.click(g)
        expect(mockSetSelected).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('Multiple annotations', () => {
    it('should render multiple annotations of different types', () => {
      const annotations = [
        createAnnotation({ id: 'ann-1', annotation_type: 'artifact_eog' }),
        createAnnotation({ id: 'ann-2', annotation_type: 'anomaly_spike', color: '#EF4444', channel: 'Fp2' }),
        createAnnotation({ id: 'ann-3', annotation_type: 'band_dominant', color: '#34D399', channel: 'F3', start_time: 0, end_time: 10 }),
      ]

      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const groups = container.querySelectorAll('g')
      expect(groups).toHaveLength(3)
    })

    it('should render overlapping annotations', () => {
      const annotations = [
        createAnnotation({ id: 'ann-1', channel: 'Fp1', start_time: 1, end_time: 3 }),
        createAnnotation({ id: 'ann-2', channel: 'Fp1', start_time: 2, end_time: 4 }),
      ]

      const { container } = render(
        <AnnotationLayer {...defaultProps} annotations={annotations} />
      )

      const groups = container.querySelectorAll('g')
      expect(groups).toHaveLength(2)
    })
  })
})
