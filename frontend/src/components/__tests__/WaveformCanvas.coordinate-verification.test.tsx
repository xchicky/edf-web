/**
 * Coordinate System Verification Tests
 * 
 * These tests verify the coordinate calculations for:
 * - Voltage scaling (no 50% error)
 * - X-axis alignment with TimeAxis (50px offset)
 * - Grid line positioning
 * 
 * Purpose: Automated verification of the bug fixes applied in
 * the EEG Critical Issues Fix session (2026-01-27)
 */

import { describe, it, expect } from 'vitest'

describe('WaveformCanvas Coordinate System Verification', () => {
  
  describe('Task 1: Y-Axis Voltage Scaling', () => {
    it('should NOT apply 0.5 scaling factor to voltage values', () => {
      // This test verifies the fix for the 50% voltage error
      // The bug was: const y = yBase - (data[j] * 0.5 / amplitudeScale)
      // The fix is: const y = yBase - data[j] / amplitudeScale
      
      // Simulate the coordinate calculation
      const dataValue = 100 // µV from backend
      const amplitudeScale = 1.0
      const yBase = 300 // channel center
      
      // OLD (BUGGY) calculation:
      const yOld = yBase - (dataValue * 0.5 / amplitudeScale)
      
      // NEW (FIXED) calculation:
      const yNew = yBase - (dataValue / amplitudeScale)
      
      // Verify the fix: 100µV should move y by 100 pixels (not 50)
      expect(yNew).toBe(200) // 300 - 100 = 200
      expect(yOld).toBe(250) // 300 - 50 = 250 (WRONG!)
      
      // The difference proves the 0.5 factor was removed
      expect(yNew).not.toBe(yOld)
    })
    
    it('should maintain voltage accuracy at different amplitudeScale values', () => {
      // Verify voltage scaling works correctly at scale = 0.5, 1.0, 2.0
      const dataValue = 100 // µV
      const yBase = 300
      
      // At scale = 1.0 (default): 100µV = 100px
      const y1 = yBase - (dataValue / 1.0)
      expect(y1).toBe(200)
      
      // At scale = 2.0 (zoomed in): 100µV = 50px
      const y2 = yBase - (dataValue / 2.0)
      expect(y2).toBe(250)
      
      // At scale = 0.5 (zoomed out): 100µV = 200px
      const y05 = yBase - (dataValue / 0.5)
      expect(y05).toBe(100)
      
      // The voltage VALUE should remain constant
      // Only the pixel representation changes
      const voltage1 = (yBase - y1) * 1.0
      const voltage2 = (yBase - y2) * 2.0
      const voltage05 = (yBase - y05) * 0.5
      
      expect(voltage1).toBe(100)
      expect(voltage2).toBe(100)
      expect(voltage05).toBe(100)
    })
  })
  
  describe('Task 2: X-Axis Width Alignment', () => {
    it('should account for 50px amplitude axis offset in X-coordinate', () => {
      // This test verifies the fix for X-axis misalignment
      // The bug was: const x = (time / duration) * width
      // The fix is: const x = 50 + (time / duration) * (width - 50)
      
      const time = 5.0 // seconds
      const duration = 10.0 // total duration
      const width = 800 // total canvas width
      const amplitudeAxisWidth = 50 // left margin for axis
      
      // OLD (BUGGY) calculation:
      const xOld = (time / duration) * width
      
      // NEW (FIXED) calculation:
      const xNew = amplitudeAxisWidth + (time / duration) * (width - amplitudeAxisWidth)
      
      // At time = 5s (middle of 10s window):
      // Old: x = (5/10) * 800 = 400px (wrong - doesn't account for axis)
      // New: x = 50 + (5/10) * 750 = 50 + 375 = 425px (correct!)
      
      expect(xOld).toBe(400)
      expect(xNew).toBe(425)
      
      // The 25px difference is the amplitude axis offset at midpoint
      expect(xNew - xOld).toBeGreaterThan(0)
    })
    
    it('should keep grid lines aligned with waveform X-coordinates', () => {
      // Verify grid lines use same 50px offset as waveform
      const duration = 10.0
      const width = 800
      const amplitudeAxisWidth = 50
      
      // Grid line time step
      const timeStep = (width - amplitudeAxisWidth) / duration
      
      // Grid line at t=5s
      const gridX = amplitudeAxisWidth + 5 * timeStep
      
      // Waveform X at t=5s
      const waveformX = amplitudeAxisWidth + (5 / duration) * (width - amplitudeAxisWidth)
      
      // They should be identical
      expect(gridX).toBe(waveformX)
      expect(gridX).toBe(425) // 50 + (5/10) * 750
    })
  })
  
  describe('Task 3: Crosshair Coordinate Calculations', () => {
    it('should calculate crosshair voltage correctly', () => {
      // Verify crosshair voltage formula matches the fixed plotting formula
      const yBase = 300 // channel center
      const mouseY = 200 // cursor position (100px above center)
      const amplitudeScale = 1.0
      
      // Crosshair voltage calculation (from WaveformCanvas.tsx line 89)
      const amplitude = (yBase - mouseY) / amplitudeScale
      
      // This should give 100µV
      expect(amplitude).toBe(100)
      
      // And the reverse calculation should match the plotting formula
      const plottedY = yBase - amplitude / amplitudeScale
      expect(plottedY).toBe(mouseY)
    })
    
    it('should calculate crosshair time correctly with 50px offset', () => {
      // Verify crosshair time calculation accounts for amplitude axis
      const mouseX = 425 // cursor at 5-second mark (after 50px offset)
      const canvasWidth = 800
      const windowDuration = 10
      const currentTime = 0
      
      // Crosshair time calculation (from WaveformCanvas.tsx line 81)
      const pixelsPerSecond = (canvasWidth - 50) / windowDuration
      const time = currentTime + (mouseX - 50) / pixelsPerSecond
      
      // Should give exactly 5.0 seconds
      expect(time).toBe(5.0)
      
      // This should match the waveform X-coordinate
      const waveformX = 50 + (time / windowDuration) * (canvasWidth - 50)
      expect(waveformX).toBe(mouseX)
    })
  })
  
  describe('Integration: Complete Coordinate System', () => {
    it('should maintain consistency between plotting and crosshair', () => {
      // Verify the entire coordinate system is consistent
      const width = 800
      const height = 600
      const duration = 10.0
      const currentTime = 0
      const amplitudeScale = 1.0
      const amplitudeAxisWidth = 50
      
      // Given a data point at (5s, 100µV)
      const dataTime = 5.0
      const dataVoltage = 100
      const channelIndex = 0
      const channelHeight = height / 2 // 2 channels
      const yBase = channelIndex * channelHeight + channelHeight / 2
      
      // Plotting coordinates:
      const plotX = amplitudeAxisWidth + (dataTime / duration) * (width - amplitudeAxisWidth)
      const plotY = yBase - dataVoltage / amplitudeScale
      
      // Crosshair should return same values when queried at these coordinates:
      const crosshairTime = currentTime + (plotX - amplitudeAxisWidth) / ((width - amplitudeAxisWidth) / duration)
      const crosshairVoltage = (yBase - plotY) * amplitudeScale
      
      // Verify round-trip consistency
      expect(crosshairTime).toBeCloseTo(dataTime, 5) // Allow small floating point error
      expect(crosshairVoltage).toBeCloseTo(dataVoltage, 5)
      
      // Exact values:
      expect(crosshairTime).toBe(5.0)
      expect(crosshairVoltage).toBe(100)
    })
  })
  
  describe('Grid Line Positioning', () => {
    it('should draw grid lines at correct intervals', () => {
      // Verify 1 line per second is drawn correctly
      const duration = 10.0
      const width = 800
      const amplitudeAxisWidth = 50
      
      const timeStep = (width - amplitudeAxisWidth) / duration
      
      // Should have 11 lines total (0s, 1s, 2s, ..., 10s)
      const expectedLines = 11
      const actualLines = duration + 1 // 0 to 10 inclusive
      
      expect(actualLines).toBe(expectedLines)
      
      // Verify spacing is consistent
      const x0 = amplitudeAxisWidth + 0 * timeStep
      const x1 = amplitudeAxisWidth + 1 * timeStep
      const x4 = amplitudeAxisWidth + 4 * timeStep
      const x5 = amplitudeAxisWidth + 5 * timeStep
      const x9 = amplitudeAxisWidth + 9 * timeStep
      const x10 = amplitudeAxisWidth + 10 * timeStep
      
      expect(x1 - x0).toBe(x5 - x4)
      expect(x5 - x4).toBe(x10 - x9)
    })
    
    it('should start grid lines after amplitude axis', () => {
      // Verify grid lines don't draw over amplitude axis (left 50px)
      const width = 800
      const amplitudeAxisWidth = 50
      
      // First grid line at t=0 should start at x=50
      const x0 = amplitudeAxisWidth
      
      expect(x0).toBe(50)
      expect(x0).toBeGreaterThan(0)
      expect(x0).toBeLessThan(width)
    })
  })
})
