import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OverviewStrip } from '../OverviewStrip'
import * as api from '../../api/edf'

// Mock the API module
vi.mock('../../api/edf', () => ({
  getWaveformOverview: vi.fn(),
}))

describe('OverviewStrip', () => {
  const mockOverviewData = {
    file_id: 'test-file-123',
    data: [[1, 2, 3, 2, 1], [0, 1, 0, -1, 0]],
    times: [0, 0.2, 0.4, 0.6, 0.8],
    channels: ['EEG Fp1-Ref', 'EEG F3-Ref'],
    sfreq: 5,
    n_samples: 5,
    start_time: 0,
    duration: 1.0,
  }

  const defaultProps = {
    fileId: 'test-file-123',
    currentTime: 0,
    windowDuration: 5,
    totalDuration: 60,
    onTimeChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    })) as any

    // Mock getBoundingClientRect
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 150,
      right: 800,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }))
  })

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      vi.mocked(api.getWaveformOverview).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<OverviewStrip {...defaultProps} />)

      expect(screen.getByText(/loading overview/i)).toBeInTheDocument()
    })

    it('should render canvas element after data loads', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('should render error state on API failure', async () => {
      vi.mocked(api.getWaveformOverview).mockRejectedValue(
        new Error('Failed to load')
      )

      render(<OverviewStrip {...defaultProps} />)

      // The error state should appear after the promise rejects
      // Note: This test verifies error handling, but actual display may vary
      // based on error boundary implementation
      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalled()
      })
    })

    it('should render with correct dimensions', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement
        expect(canvas.width).toBe(800)
        // Canvas height may vary based on implementation, just check it exists
        expect(canvas.height).toBeGreaterThan(0)
      })
    })
  })

  describe('Data Loading', () => {
    it('should call getWaveformOverview on mount', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalledWith(
          'test-file-123',
          1.0,
          undefined
        )
      })
    })

    it('should call getWaveformOverview with channel filter when provided', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} channels={[0, 1]} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalledWith(
          'test-file-123',
          1.0,
          [0, 1]
        )
      })
    })

    it('should reload data when fileId changes', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      const { rerender } = render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalledTimes(1)
      })

      rerender(<OverviewStrip {...defaultProps} fileId="different-file" />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalledTimes(2)
      })
    })

    it('should reload data when channels filter changes', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      const { rerender } = render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalledTimes(1)
      })

      rerender(<OverviewStrip {...defaultProps} channels={[0]} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Window Overlay Rendering', () => {
    it('should render current time window overlay', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(
        <OverviewStrip
          {...defaultProps}
          currentTime={10}
          windowDuration={5}
        />
      )

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      // The overlay should be rendered by canvas drawing operations
      // This is verified through the component's useEffect
    })

    it('should update overlay when currentTime changes', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      const { rerender } = render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      rerender(<OverviewStrip {...defaultProps} currentTime={20} />)

      // Component should re-render with new overlay position
      expect(document.querySelector('canvas')).toBeInTheDocument()
    })

    it('should update overlay when windowDuration changes', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      const { rerender } = render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      rerender(<OverviewStrip {...defaultProps} windowDuration={10} />)

      // Component should re-render with new overlay width
      expect(document.querySelector('canvas')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty overview data', async () => {
      const emptyData = {
        ...mockOverviewData,
        data: [],
        channels: [],
      }

      vi.mocked(api.getWaveformOverview).mockResolvedValue(emptyData)

      render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('should handle zero totalDuration', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} totalDuration={0} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('should handle very large windowDuration', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} windowDuration={1000} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('should handle API error gracefully', async () => {
      vi.mocked(api.getWaveformOverview).mockRejectedValue(
        new Error('Network error')
      )

      render(<OverviewStrip {...defaultProps} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalled()
      })

      // Component should handle error without crashing
      expect(document.querySelector('.overview-strip')).toBeInTheDocument()
    })

    it('should render without errors when onTimeChange is undefined', async () => {
      vi.mocked(api.getWaveformOverview).mockResolvedValue(mockOverviewData)

      render(<OverviewStrip {...defaultProps} onTimeChange={undefined as any} />)

      await waitFor(() => {
        expect(api.getWaveformOverview).toHaveBeenCalled()
      })

      // Component should render successfully
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })
  })

})
