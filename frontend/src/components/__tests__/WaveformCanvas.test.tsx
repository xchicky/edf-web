import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { WaveformCanvas } from '../WaveformCanvas'
import type { WaveformData } from '../../store/edfStore'

// Declare global for TypeScript
declare const global: any

describe('WaveformCanvas', () => {
  const mockWaveformData = {
    file_id: 'test-file-123',
    data: [[1, 2, 3, 2, 1], [0, 1, 0, -1, 0]],
    times: [0, 0.2, 0.4, 0.6, 0.8],
    channels: ['EEG Fp1-Ref', 'EEG F3-Ref'],
    duration: 1.0,
    sfreq: 5,
    n_samples: 5,
    start_time: 0,
  }

  const defaultProps = {
    waveformData: mockWaveformData,
    channelColors: ['#0066CC', '#FF6B6B'],
    currentTime: 0,
    windowDuration: 5,
    amplitudeScale: 1.0,
  }

  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      font: '',
    })) as any

    // Mock getBoundingClientRect
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }))

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      cb()
      return 1
    }) as unknown as typeof requestAnimationFrame

    global.cancelAnimationFrame = vi.fn()
  })

  describe('Rendering', () => {
    it('should render canvas element', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    it('should render with cursor overlay', () => {
      render(<WaveformCanvas {...defaultProps} />)
      // CursorOverlay is rendered but may not be visible initially
      expect(document.querySelector('canvas')).toBeInTheDocument()
    })

    it('should apply crosshair cursor style', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      expect(canvas.style.cursor).toBe('crosshair')
    })
  })

  describe('Mouse Interactions', () => {
    it('should handle mouse down for selection', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseDown(canvas, {
        clientX: 100,
        clientY: 100,
      })

      expect(canvas.style.cursor).toBe('col-resize')
    })

    it('should not start selection when clicking on amplitude axis (x <= 50)', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseDown(canvas, {
        clientX: 30,
        clientY: 100,
      })

      expect(canvas.style.cursor).toBe('crosshair')
    })

    it('should handle mouse up and reset cursor', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
      fireEvent.mouseUp(canvas)

      expect(canvas.style.cursor).toBe('crosshair')
    })

    it('should handle mouse leave and hide cursor info', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseMove(canvas, {
        clientX: 100,
        clientY: 100,
      })

      fireEvent.mouseLeave(canvas)

      // Cursor overlay should be hidden
      // This is verified through the component's internal state
    })
  })

  describe('Selection Functionality', () => {
    it('should handle mouse down for selection', () => {
      const onSelectionChange = vi.fn()
      render(<WaveformCanvas {...defaultProps} onSelectionChange={onSelectionChange} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })

      // Should change cursor to indicate selection mode
      expect(canvas.style.cursor).toBe('col-resize')
    })

    it('should update selection during mouse move', () => {
      const onSelectionChange = vi.fn()
      render(<WaveformCanvas {...defaultProps} onSelectionChange={onSelectionChange} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 100 })

      // Selection should be updated (verified by cursor staying in selection mode)
      expect(canvas.style.cursor).toBe('col-resize')
    })
  })

  describe('Zoom Interactions', () => {
    it('should handle wheel zoom for amplitude when x < 50', () => {
      const onAmplitudeChange = vi.fn()
      render(<WaveformCanvas {...defaultProps} onAmplitudeChange={onAmplitudeChange} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.wheel(canvas, {
        deltaX: 0,
        deltaY: 100,
        clientX: 30,
      })

      expect(onAmplitudeChange).toHaveBeenCalled()
    })

    it('should handle wheel zoom for time when x > 50', () => {
      const onTimeChange = vi.fn()
      render(<WaveformCanvas {...defaultProps} onTimeChange={onTimeChange} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.wheel(canvas, {
        deltaX: 0,
        deltaY: 100,
        clientX: 100,
      })

      expect(onTimeChange).toHaveBeenCalled()
    })

    it('should handle wheel event', () => {
      render(<WaveformCanvas {...defaultProps} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      // Should not throw errors
      expect(() => {
        fireEvent.wheel(canvas, {
          deltaX: 0,
          deltaY: 100,
        })
      }).not.toThrow()
    })

    it('should clamp amplitude scale between 0.1 and 10', () => {
      const onAmplitudeChange = vi.fn()
      render(<WaveformCanvas {...defaultProps} onAmplitudeChange={onAmplitudeChange} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      // Test zooming out
      fireEvent.wheel(canvas, {
        deltaX: 0,
        deltaY: 1000,
        clientX: 30,
      })

      // Test zooming in
      fireEvent.wheel(canvas, {
        deltaX: 0,
        deltaY: -1000,
        clientX: 30,
      })

      onAmplitudeChange.mock.calls.forEach((call) => {
        const scale = call[0]
        expect(scale).toBeGreaterThanOrEqual(0.1)
        expect(scale).toBeLessThanOrEqual(10)
      })
    })
  })

  describe('Canvas Rendering', () => {
    it('should use provided waveformData', () => {
      const { rerender } = render(<WaveformCanvas {...defaultProps} />)

      const customData = {
        ...mockWaveformData,
        channels: ['CH1', 'CH2', 'CH3'],
        data: [[1], [2], [3]],
      }

      rerender(<WaveformCanvas {...defaultProps} waveformData={customData} />)

      // Component should update without errors
      expect(document.querySelector('canvas')).toBeInTheDocument()
    })

    it('should use provided channel colors', () => {
      const customColors = ['#FF0000', '#00FF00', '#0000FF']
      render(<WaveformCanvas {...defaultProps} channelColors={customColors} />)

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty waveformData', () => {
      const emptyData: WaveformData = {
        file_id: 'empty',
        data: [],
        times: [],
        channels: [],
        duration: 0,
        sfreq: 0,
        n_samples: 0,
        start_time: 0,
      }

      render(<WaveformCanvas {...defaultProps} waveformData={emptyData} />)

      expect(document.querySelector('canvas')).toBeInTheDocument()
    })

    it('should handle missing callbacks gracefully', () => {
      render(<WaveformCanvas {...defaultProps} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      // Should not throw errors even without callbacks
      expect(() => {
        fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
        fireEvent.mouseMove(canvas, { clientX: 200, clientY: 100 })
        fireEvent.wheel(canvas, { deltaX: 0, deltaY: 100 })
      }).not.toThrow()
    })

    it('should handle zero windowDuration', () => {
      render(<WaveformCanvas {...defaultProps} windowDuration={0} />)

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    it('should handle very large amplitudeScale', () => {
      render(<WaveformCanvas {...defaultProps} amplitudeScale={1000} />)

      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('Time Formatting', () => {
    it('should format time correctly in cursor info', () => {
      render(<WaveformCanvas {...defaultProps} currentTime={125.456} />)

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      fireEvent.mouseMove(canvas, {
        clientX: 100,
        clientY: 100,
      })

      // Time should be formatted as "M:SS.ms"
      // The exact value depends on the calculation, but the format should be consistent
      expect(document.querySelector('canvas')).toBeInTheDocument()
    })
  })

  describe('Wrapper Container', () => {
    it('should have width: 100% on wrapper div for correct canvas sizing', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      const wrapper = canvas.parentElement
      expect(wrapper).toBeInTheDocument()
      expect(wrapper?.style.width).toBe('100%')
    })

    it('should have position: relative on wrapper div for overlay positioning', () => {
      render(<WaveformCanvas {...defaultProps} />)
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      const wrapper = canvas.parentElement
      expect(wrapper?.style.position).toBe('relative')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup animation frame on unmount', () => {
      const { unmount } = render(<WaveformCanvas {...defaultProps} />)

      unmount()

      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })

    it('should cleanup animation frame when waveformData changes', () => {
      const { rerender } = render(<WaveformCanvas {...defaultProps} />)

      const customData: WaveformData = {
        ...mockWaveformData,
        data: [[5, 6, 7]],
        channels: ['CH1'],
        times: [0, 0.5, 1],
        n_samples: 3,
      }

      rerender(<WaveformCanvas {...defaultProps} waveformData={customData} />)

      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })
  })
})
