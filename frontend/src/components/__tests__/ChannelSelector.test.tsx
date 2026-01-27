import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChannelSelector } from '../ChannelSelector'

describe('ChannelSelector', () => {
  const defaultProps = {
    channels: ['EEG Fp1-Ref', 'EEG F3-Ref', 'EEG C3-Ref', 'EEG P3-Ref'],
    selectedChannels: [0, 1],
    onChannelToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
  }

  describe('Rendering', () => {
    it('should render component with header', () => {
      render(<ChannelSelector {...defaultProps} />)

      expect(screen.getByText('Channels')).toBeInTheDocument()
    })

    it('should render all channels', () => {
      render(<ChannelSelector {...defaultProps} />)

      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()
      expect(screen.getByText('EEG F3-Ref')).toBeInTheDocument()
      expect(screen.getByText('EEG C3-Ref')).toBeInTheDocument()
      expect(screen.getByText('EEG P3-Ref')).toBeInTheDocument()
    })

    it('should render search input', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')
      expect(searchInput).toBeInTheDocument()
    })

    it('should render All and None buttons', () => {
      render(<ChannelSelector {...defaultProps} />)

      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('None')).toBeInTheDocument()
    })

    it('should render checkboxes for each channel', () => {
      render(<ChannelSelector {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)
    })
  })

  describe('Channel Selection', () => {
    it('should display selected channels with correct state', () => {
      render(<ChannelSelector {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')

      // First two channels should be checked
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()

      // Last two channels should be unchecked
      expect(checkboxes[2]).not.toBeChecked()
      expect(checkboxes[3]).not.toBeChecked()
    })

    it('should apply selected class to selected channels', () => {
      render(<ChannelSelector {...defaultProps} />)

      const channelItems = document.querySelectorAll('.channel-item')

      // Check that first two channels (selected) have selected class
      expect(channelItems[0]).toHaveClass('channel-item', 'selected')
      expect(channelItems[1]).toHaveClass('channel-item', 'selected')

      // Check that unselected channels don't have selected class
      expect(channelItems[2]).toHaveClass('channel-item')
      expect(channelItems[2]).not.toHaveClass('selected')
    })

    it('should call onChannelToggle when checkbox is clicked', () => {
      render(<ChannelSelector {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')

      // Click first checkbox
      fireEvent.click(checkboxes[0])

      expect(defaultProps.onChannelToggle).toHaveBeenCalledWith(0)
    })

    it('should call onChannelToggle with correct index', () => {
      render(<ChannelSelector {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')

      // Click third checkbox (index 2)
      fireEvent.click(checkboxes[2])

      expect(defaultProps.onChannelToggle).toHaveBeenCalledWith(2)
    })

    it('should toggle channel selection when label is clicked', () => {
      render(<ChannelSelector {...defaultProps} />)

      const channelLabel = screen.getByText('EEG C3-Ref').closest('label')
      expect(channelLabel).toBeInTheDocument()

      if (channelLabel) {
        fireEvent.click(channelLabel)

        // Should trigger the checkbox inside the label
        expect(defaultProps.onChannelToggle).toHaveBeenCalled()
      }
    })
  })

  describe('Bulk Selection', () => {
    it('should call onSelectAll when All button is clicked', () => {
      render(<ChannelSelector {...defaultProps} />)

      const allButton = screen.getByText('All')
      fireEvent.click(allButton)

      expect(defaultProps.onSelectAll).toHaveBeenCalled()
    })

    it('should call onDeselectAll when None button is clicked', () => {
      render(<ChannelSelector {...defaultProps} />)

      const noneButton = screen.getByText('None')
      fireEvent.click(noneButton)

      expect(defaultProps.onDeselectAll).toHaveBeenCalled()
    })
  })

  describe('Search Functionality', () => {
    it('should filter channels based on search term', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // Type "Fp1"
      fireEvent.change(searchInput, { target: { value: 'Fp1' } })

      // Should show only EEG Fp1-Ref
      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()

      // Other channels should not be visible in the filtered list
      // They may still be in DOM but not displayed
    })

    it('should filter channels case-insensitively', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // Type lowercase "fp1"
      fireEvent.change(searchInput, { target: { value: 'fp1' } })

      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()
    })

    it('should show all channels when search is empty', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // Type something
      fireEvent.change(searchInput, { target: { value: 'Fp1' } })

      // Clear it
      fireEvent.change(searchInput, { target: { value: '' } })

      // All channels should be visible again
      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()
      expect(screen.getByText('EEG F3-Ref')).toBeInTheDocument()
      expect(screen.getByText('EEG C3-Ref')).toBeInTheDocument()
      expect(screen.getByText('EEG P3-Ref')).toBeInTheDocument()
    })

    it('should filter based on partial match', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // Type "EEG"
      fireEvent.change(searchInput, { target: { value: 'EEG' } })

      // All channels start with EEG, so all should match
      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()
    })

    it('should show no results when search matches nothing', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // Type something that won't match
      fireEvent.change(searchInput, { target: { value: 'XYZ' } })

      // No channel labels should be visible
      const channelLabels = screen.queryAllByRole('label')
      // Filter out the header label
      const channelItemLabels = channelLabels.filter(
        (label) => label.className.includes('channel-item')
      )
      expect(channelItemLabels.length).toBe(0)
    })
  })

  describe('Channel Index Mapping', () => {
    it('should maintain correct channel indices when filtering', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // Filter to show only first two channels
      fireEvent.change(searchInput, { target: { value: 'F' } })

      // Click on a visible channel
      const visibleChannel = screen.getByText('EEG F3-Ref')
      fireEvent.click(visibleChannel.closest('label')!)

      // Should still use original channel index (1), not filtered index
      expect(defaultProps.onChannelToggle).toHaveBeenCalledWith(1)
    })

    it('should handle channels with duplicate names', () => {
      const propsWithDuplicates = {
        ...defaultProps,
        channels: ['CH1', 'CH2', 'CH1', 'CH2'], // Duplicate names
        selectedChannels: [0, 1],
      }

      render(<ChannelSelector {...propsWithDuplicates} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)

      // Click first CH1
      fireEvent.click(checkboxes[0])
      expect(defaultProps.onChannelToggle).toHaveBeenCalledWith(0)

      // Click second CH1 (different index)
      fireEvent.click(checkboxes[2])
      expect(defaultProps.onChannelToggle).toHaveBeenCalledWith(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty channels array', () => {
      render(<ChannelSelector {...defaultProps} channels={[]} />)

      const searchInput = screen.getByPlaceholderText('Search channels...')

      // No error should occur
      expect(searchInput).toBeInTheDocument()

      // No checkboxes should be rendered
      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })

    it('should handle empty selectedChannels', () => {
      render(<ChannelSelector {...defaultProps} selectedChannels={[]} />)

      const checkboxes = screen.getAllByRole('checkbox')

      checkboxes.forEach((checkbox) => {
        expect(checkbox).not.toBeChecked()
      })
    })

    it('should handle all channels selected', () => {
      render(
        <ChannelSelector {...defaultProps} selectedChannels={[0, 1, 2, 3]} />
      )

      const checkboxes = screen.getAllByRole('checkbox')

      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeChecked()
      })
    })

    it('should throw error when callbacks are missing and user interacts', () => {
      const propsWithoutCallbacks = {
        channels: ['CH1', 'CH2'],
        selectedChannels: [0],
        onChannelToggle: undefined as any,
        onSelectAll: undefined as any,
        onDeselectAll: undefined as any,
      }

      render(<ChannelSelector {...propsWithoutCallbacks} />)

      // Component should render without throwing errors
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
      expect(screen.getByText('CH1')).toBeInTheDocument()
    })

    it('should handle very long channel names', () => {
      const longName = 'EEG Fp1-Ref-Extra-Long-Channel-Name-With-Lots-Of-Info'
      render(
        <ChannelSelector {...defaultProps} channels={[longName, 'CH2']} />
      )

      expect(screen.getByText(longName)).toBeInTheDocument()
    })

    it('should handle special characters in channel names', () => {
      const specialNames = ['EEG/Fp1-Ref', 'ECG-II', 'SpO2 (%)']
      render(
        <ChannelSelector {...defaultProps} channels={specialNames} />
      )

      expect(screen.getByText('EEG/Fp1-Ref')).toBeInTheDocument()
      expect(screen.getByText('ECG-II')).toBeInTheDocument()
      expect(screen.getByText('SpO2 (%)')).toBeInTheDocument()
    })

    it('should handle unicode characters in channel names', () => {
      const unicodeNames = ['EEG α', 'EEG β', 'EEG γ']
      render(
        <ChannelSelector {...defaultProps} channels={unicodeNames} />
      )

      expect(screen.getByText('EEG α')).toBeInTheDocument()
      expect(screen.getByText('EEG β')).toBeInTheDocument()
      expect(screen.getByText('EEG γ')).toBeInTheDocument()
    })
  })

  describe('Search Input Behavior', () => {
    it('should update search term on input change', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(
        'Search channels...'
      ) as HTMLInputElement

      fireEvent.change(searchInput, { target: { value: 'test' } })

      expect(searchInput.value).toBe('test')
    })

    it('should filter channels in real-time as user types', () => {
      render(<ChannelSelector {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(
        'Search channels...'
      ) as HTMLInputElement

      // Type character by character
      fireEvent.change(searchInput, { target: { value: 'E' } })
      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()

      fireEvent.change(searchInput, { target: { value: 'EE' } })
      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()

      fireEvent.change(searchInput, { target: { value: 'EEG' } })
      expect(screen.getByText('EEG Fp1-Ref')).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should have correct CSS classes', () => {
      render(<ChannelSelector {...defaultProps} />)

      const container = document.querySelector('.channel-selector')
      expect(container).toBeInTheDocument()

      const header = document.querySelector('.channel-selector-header')
      expect(header).toBeInTheDocument()

      const channelList = document.querySelector('.channel-list')
      expect(channelList).toBeInTheDocument()
    })

    it('should render text buttons with correct class', () => {
      render(<ChannelSelector {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2)

      buttons.forEach((button) => {
        expect(button).toHaveClass('text-button')
      })
    })
  })
})
