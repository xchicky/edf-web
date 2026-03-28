import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAnnotationStore } from '../annotationStore'
import type { Annotation } from '../../types/annotation'

// Mock API module
vi.mock('../../api/annotations', () => ({
  generateAnnotations: vi.fn(),
  getAnnotations: vi.fn(),
  addUserAnnotation: vi.fn(),
  deleteUserAnnotation: vi.fn(),
  clearAnnotationCache: vi.fn(),
}))

import {
  generateAnnotations,
  getAnnotations,
  addUserAnnotation,
  deleteUserAnnotation,
} from '../../api/annotations'

const mockAnnotation: Annotation = {
  id: 'ann-001',
  annotation_type: 'artifact_eog',
  source: 'preprocess',
  channel: 'Fp1',
  start_time: 1.0,
  end_time: 2.0,
  label: 'EOG artifact',
  color: '#FCD34D',
  severity: 0.7,
  confidence: 0.9,
  metadata: {},
  is_user_created: false,
  created_at: '2025-01-01T00:00:00Z',
}

const mockUserAnnotation: Annotation = {
  id: 'ann-user-001',
  annotation_type: 'user_note',
  source: 'user',
  channel: 'Fp1',
  start_time: 3.0,
  end_time: 4.0,
  label: 'My note',
  color: '#10B981',
  severity: 0.0,
  confidence: 1.0,
  metadata: { note: 'Review this' },
  is_user_created: true,
  created_at: '2025-01-01T12:00:00Z',
}

describe('annotationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAnnotationStore.getState().reset()
  })

  describe('initial state', () => {
    it('should have empty annotations', () => {
      const state = useAnnotationStore.getState()
      expect(state.annotations).toEqual([])
    })

    it('should have no error', () => {
      const state = useAnnotationStore.getState()
      expect(state.error).toBeNull()
    })

    it('should not be loading', () => {
      const state = useAnnotationStore.getState()
      expect(state.isLoading).toBe(false)
    })

    it('should have all categories visible by default', () => {
      const state = useAnnotationStore.getState()
      expect(state.visibility).toEqual({
        artifact: true,
        band: true,
        anomaly: true,
        user: true,
      })
    })

    it('should have no selected annotation', () => {
      const state = useAnnotationStore.getState()
      expect(state.selectedAnnotation).toBeNull()
    })

    it('should not be generated', () => {
      const state = useAnnotationStore.getState()
      expect(state.isGenerated).toBe(false)
    })
  })

  describe('generate', () => {
    it('should generate annotations successfully', async () => {
      const mockResponse = {
        file_id: 'file-001',
        annotations: [mockAnnotation],
        summary: { artifact_eog: 1 },
        generated_at: '2025-01-01T00:00:00Z',
      }
      vi.mocked(generateAnnotations).mockResolvedValue(mockResponse)

      await useAnnotationStore.getState().generate('file-001')

      const state = useAnnotationStore.getState()
      expect(state.annotations).toEqual([mockAnnotation])
      expect(state.summary).toEqual({ artifact_eog: 1 })
      expect(state.fileId).toBe('file-001')
      expect(state.isLoading).toBe(false)
      expect(state.isGenerated).toBe(true)
    })

    it('should pass options to API', async () => {
      vi.mocked(generateAnnotations).mockResolvedValue({
        file_id: 'file-001',
        annotations: [],
        summary: {},
        generated_at: '2025-01-01T00:00:00Z',
      })

      await useAnnotationStore.getState().generate('file-001', {
        runBandAnalysis: false,
        runAnomalyDetection: true,
        anomalySensitivity: 1.5,
      })

      expect(generateAnnotations).toHaveBeenCalledWith('file-001', {
        run_band_analysis: false,
        run_anomaly_detection: true,
        anomaly_sensitivity: 1.5,
      })
    })

    it('should handle generation error', async () => {
      vi.mocked(generateAnnotations).mockRejectedValue(new Error('Server error'))

      await useAnnotationStore.getState().generate('file-001')

      const state = useAnnotationStore.getState()
      expect(state.error).toBe('Server error')
      expect(state.isLoading).toBe(false)
      expect(state.annotations).toEqual([])
    })

    it('should handle non-Error generation failure', async () => {
      vi.mocked(generateAnnotations).mockRejectedValue('unknown error')

      await useAnnotationStore.getState().generate('file-001')

      const state = useAnnotationStore.getState()
      expect(state.error).toBe('生成标注失败')
    })

    it('should set loading state during generation', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => { resolvePromise = resolve })
      vi.mocked(generateAnnotations).mockReturnValue(promise as any)

      const generatePromise = useAnnotationStore.getState().generate('file-001')

      expect(useAnnotationStore.getState().isLoading).toBe(true)

      resolvePromise!({
        file_id: 'file-001',
        annotations: [],
        summary: {},
        generated_at: '2025-01-01T00:00:00Z',
      })

      await generatePromise

      expect(useAnnotationStore.getState().isLoading).toBe(false)
    })
  })

  describe('loadAnnotations', () => {
    it('should load annotations with filters', async () => {
      const mockResponse = {
        file_id: 'file-001',
        annotations: [mockAnnotation],
        summary: { artifact_eog: 1 },
        generated_at: '2025-01-01T00:00:00Z',
      }
      vi.mocked(getAnnotations).mockResolvedValue(mockResponse)

      await useAnnotationStore.getState().loadAnnotations('file-001', {
        start: 0,
        end: 10,
        types: ['artifact_eog'],
        channels: ['Fp1'],
      })

      expect(getAnnotations).toHaveBeenCalledWith('file-001', {
        start: 0,
        end: 10,
        types: ['artifact_eog'],
        channels: ['Fp1'],
      })
      const state = useAnnotationStore.getState()
      expect(state.annotations).toEqual([mockAnnotation])
    })

    it('should handle load error', async () => {
      vi.mocked(getAnnotations).mockRejectedValue(new Error('Network error'))

      await useAnnotationStore.getState().loadAnnotations('file-001')

      const state = useAnnotationStore.getState()
      expect(state.error).toBe('Network error')
    })

    it('should handle non-Error load failure', async () => {
      vi.mocked(getAnnotations).mockRejectedValue('string error')

      await useAnnotationStore.getState().loadAnnotations('file-001')

      expect(useAnnotationStore.getState().error).toBe('加载标注失败')
    })
  })

  describe('addUserAnnotation', () => {
    it('should add user annotation to the list', async () => {
      // Start with existing annotations
      useAnnotationStore.setState({ annotations: [mockAnnotation] })
      vi.mocked(addUserAnnotation).mockResolvedValue(mockUserAnnotation)

      await useAnnotationStore.getState().addUserAnnotation('file-001', {
        channel: 'Fp1',
        startTime: 3.0,
        endTime: 4.0,
        label: 'My note',
        note: 'Review this',
      })

      expect(addUserAnnotation).toHaveBeenCalledWith('file-001', {
        annotation_type: 'user_note',
        channel: 'Fp1',
        start_time: 3.0,
        end_time: 4.0,
        label: 'My note',
        note: 'Review this',
      })

      const state = useAnnotationStore.getState()
      expect(state.annotations).toHaveLength(2)
      expect(state.annotations[1]).toEqual(mockUserAnnotation)
    })

    it('should handle add error', async () => {
      vi.mocked(addUserAnnotation).mockRejectedValue(new Error('Add failed'))

      await useAnnotationStore.getState().addUserAnnotation('file-001', {
        channel: 'Fp1',
        startTime: 1,
        endTime: 2,
        label: 'Note',
      })

      expect(useAnnotationStore.getState().error).toBe('Add failed')
    })

    it('should handle non-Error add failure', async () => {
      vi.mocked(addUserAnnotation).mockRejectedValue(500)

      await useAnnotationStore.getState().addUserAnnotation('file-001', {
        channel: 'Fp1',
        startTime: 1,
        endTime: 2,
        label: 'Note',
      })

      expect(useAnnotationStore.getState().error).toBe('添加标注失败')
    })
  })

  describe('deleteUserAnnotation', () => {
    it('should remove annotation from the list', async () => {
      useAnnotationStore.setState({
        annotations: [mockAnnotation, mockUserAnnotation],
      })
      vi.mocked(deleteUserAnnotation).mockResolvedValue(undefined)

      await useAnnotationStore.getState().deleteUserAnnotation('file-001', 'ann-user-001')

      expect(deleteUserAnnotation).toHaveBeenCalledWith('file-001', 'ann-user-001')
      const state = useAnnotationStore.getState()
      expect(state.annotations).toHaveLength(1)
      expect(state.annotations[0].id).toBe('ann-001')
    })

    it('should handle delete error', async () => {
      vi.mocked(deleteUserAnnotation).mockRejectedValue(new Error('Delete failed'))

      await useAnnotationStore.getState().deleteUserAnnotation('file-001', 'ann-001')

      expect(useAnnotationStore.getState().error).toBe('Delete failed')
    })

    it('should handle non-Error delete failure', async () => {
      vi.mocked(deleteUserAnnotation).mockRejectedValue(null)

      await useAnnotationStore.getState().deleteUserAnnotation('file-001', 'ann-001')

      expect(useAnnotationStore.getState().error).toBe('删除标注失败')
    })
  })

  describe('visibility', () => {
    const allAnnotations: Annotation[] = [
      { ...mockAnnotation, annotation_type: 'artifact_eog' },
      { ...mockAnnotation, id: 'ann-002', annotation_type: 'band_dominant' },
      { ...mockAnnotation, id: 'ann-003', annotation_type: 'anomaly_spike' },
      { ...mockAnnotation, id: 'ann-004', annotation_type: 'user_note', is_user_created: true, source: 'user' },
    ]

    it('should set visibility', () => {
      useAnnotationStore.getState().setVisibility({ artifact: false })

      expect(useAnnotationStore.getState().visibility.artifact).toBe(false)
      expect(useAnnotationStore.getState().visibility.band).toBe(true)
    })

    it('should toggle category visibility', () => {
      useAnnotationStore.getState().toggleCategoryVisibility('artifact')

      expect(useAnnotationStore.getState().visibility.artifact).toBe(false)

      useAnnotationStore.getState().toggleCategoryVisibility('artifact')

      expect(useAnnotationStore.getState().visibility.artifact).toBe(true)
    })

    it('should filter annotations by visibility', () => {
      useAnnotationStore.setState({ annotations: allAnnotations })
      useAnnotationStore.getState().setVisibility({ artifact: false, anomaly: false })

      const filtered = useAnnotationStore.getState().getFilteredAnnotations()
      expect(filtered).toHaveLength(2)
      expect(filtered.map(a => a.annotation_type)).toEqual(
        expect.arrayContaining(['band_dominant', 'user_note'])
      )
    })

    it('should return all annotations when all categories visible', () => {
      useAnnotationStore.setState({ annotations: allAnnotations })

      const filtered = useAnnotationStore.getState().getFilteredAnnotations()
      expect(filtered).toHaveLength(4)
    })

    it('should return empty when all categories hidden', () => {
      useAnnotationStore.setState({ annotations: allAnnotations })
      useAnnotationStore.getState().setVisibility({
        artifact: false,
        band: false,
        anomaly: false,
        user: false,
      })

      const filtered = useAnnotationStore.getState().getFilteredAnnotations()
      expect(filtered).toHaveLength(0)
    })
  })

  describe('setSelectedAnnotation', () => {
    it('should set selected annotation', () => {
      const clickEvent = {
        annotation: mockAnnotation,
        pixelX: 100,
        pixelY: 200,
      }

      useAnnotationStore.getState().setSelectedAnnotation(clickEvent)

      expect(useAnnotationStore.getState().selectedAnnotation).toEqual(clickEvent)
    })

    it('should clear selected annotation', () => {
      useAnnotationStore.getState().setSelectedAnnotation({
        annotation: mockAnnotation,
        pixelX: 100,
        pixelY: 200,
      })

      useAnnotationStore.getState().setSelectedAnnotation(null)

      expect(useAnnotationStore.getState().selectedAnnotation).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useAnnotationStore.setState({
        annotations: [mockAnnotation],
        summary: { artifact_eog: 1 },
        isLoading: true,
        error: 'some error',
        fileId: 'file-001',
        isGenerated: true,
        selectedAnnotation: { annotation: mockAnnotation, pixelX: 0, pixelY: 0 },
      })

      useAnnotationStore.getState().reset()

      const state = useAnnotationStore.getState()
      expect(state.annotations).toEqual([])
      expect(state.summary).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.fileId).toBeNull()
      expect(state.isGenerated).toBe(false)
      expect(state.selectedAnnotation).toBeNull()
      expect(state.visibility).toEqual({
        artifact: true,
        band: true,
        anomaly: true,
        user: true,
      })
    })
  })
})
