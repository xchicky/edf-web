import { describe, it, expect } from 'vitest'
import {
  ANNOTATION_STYLES,
  getAnnotationCategory,
  isAnnotationInCategory,
} from '../annotation'
import type { Annotation, AnnotationType } from '../annotation'

describe('Annotation Types', () => {
  describe('ANNOTATION_STYLES', () => {
    it('should define styles for all 12 annotation types', () => {
      const types = Object.keys(ANNOTATION_STYLES) as AnnotationType[]
      expect(types).toHaveLength(12)
    })

    it('should have correct artifact types', () => {
      const artifactTypes: AnnotationType[] = [
        'artifact_eog', 'artifact_emg', 'artifact_flat',
        'artifact_drift', 'artifact_jump',
      ]
      for (const type of artifactTypes) {
        expect(ANNOTATION_STYLES[type]).toBeDefined()
        expect(ANNOTATION_STYLES[type].category).toBe('artifact')
      }
    })

    it('should have correct band types', () => {
      expect(ANNOTATION_STYLES.band_dominant).toBeDefined()
      expect(ANNOTATION_STYLES.band_dominant.category).toBe('band')
    })

    it('should have correct anomaly types', () => {
      const anomalyTypes: AnnotationType[] = [
        'anomaly_spike', 'anomaly_sharp_wave', 'anomaly_spike_and_slow',
        'anomaly_slow_wave', 'anomaly_rhythmic',
      ]
      for (const type of anomalyTypes) {
        expect(ANNOTATION_STYLES[type]).toBeDefined()
        expect(ANNOTATION_STYLES[type].category).toBe('anomaly')
      }
    })

    it('should have user_note type', () => {
      expect(ANNOTATION_STYLES.user_note).toBeDefined()
      expect(ANNOTATION_STYLES.user_note.category).toBe('user')
    })

    it('should assign render styles by category', () => {
      expect(ANNOTATION_STYLES.artifact_eog.renderStyle).toBe('highlight')
      expect(ANNOTATION_STYLES.band_dominant.renderStyle).toBe('label')
      expect(ANNOTATION_STYLES.anomaly_spike.renderStyle).toBe('marker')
      expect(ANNOTATION_STYLES.user_note.renderStyle).toBe('label')
    })

    it('should have valid hex colors for all types', () => {
      for (const [_type, style] of Object.entries(ANNOTATION_STYLES)) {
        expect(style.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    })

    it('should have non-empty labels for all types', () => {
      for (const [_type, style] of Object.entries(ANNOTATION_STYLES)) {
        expect(style.label.length).toBeGreaterThan(0)
      }
    })
  })

  describe('getAnnotationCategory', () => {
    it('should return correct category for artifact types', () => {
      expect(getAnnotationCategory('artifact_eog')).toBe('artifact')
      expect(getAnnotationCategory('artifact_emg')).toBe('artifact')
    })

    it('should return correct category for band types', () => {
      expect(getAnnotationCategory('band_dominant')).toBe('band')
    })

    it('should return correct category for anomaly types', () => {
      expect(getAnnotationCategory('anomaly_spike')).toBe('anomaly')
      expect(getAnnotationCategory('anomaly_rhythmic')).toBe('anomaly')
    })

    it('should return correct category for user type', () => {
      expect(getAnnotationCategory('user_note')).toBe('user')
    })
  })

  describe('isAnnotationInCategory', () => {
    const createAnnotation = (type: AnnotationType): Annotation => ({
      id: 'test-1',
      annotation_type: type,
      source: 'preprocess',
      channel: 'Fp1',
      start_time: 0,
      end_time: 1,
      label: 'Test',
      color: '#FF0000',
      severity: 0.5,
      confidence: 0.9,
      metadata: {},
      is_user_created: false,
      created_at: '2025-01-01T00:00:00Z',
    })

    it('should return true when annotation matches category', () => {
      const annotation = createAnnotation('artifact_eog')
      expect(isAnnotationInCategory(annotation, 'artifact')).toBe(true)
    })

    it('should return false when annotation does not match category', () => {
      const annotation = createAnnotation('artifact_eog')
      expect(isAnnotationInCategory(annotation, 'anomaly')).toBe(false)
    })

    it('should work for all categories', () => {
      const testCases: [AnnotationType, string][] = [
        ['artifact_eog', 'artifact'],
        ['band_dominant', 'band'],
        ['anomaly_spike', 'anomaly'],
        ['user_note', 'user'],
      ]
      for (const [type, category] of testCases) {
        const annotation = createAnnotation(type)
        expect(isAnnotationInCategory(annotation, category as any)).toBe(true)
      }
    })
  })

  describe('Annotation interface', () => {
    it('should create valid annotation objects', () => {
      const annotation: Annotation = {
        id: 'ann-001',
        annotation_type: 'anomaly_spike',
        source: 'anomaly_detection',
        channel: 'Fp1',
        start_time: 1.5,
        end_time: 2.0,
        label: 'Spike detected',
        color: '#EF4444',
        severity: 0.8,
        confidence: 0.95,
        metadata: { description: 'Test spike' },
        is_user_created: false,
        created_at: '2025-01-01T00:00:00Z',
      }

      expect(annotation.id).toBe('ann-001')
      expect(annotation.annotation_type).toBe('anomaly_spike')
      expect(annotation.channel).toBe('Fp1')
      expect(annotation.severity).toBe(0.8)
    })

    it('should support null channel for global annotations', () => {
      const annotation: Annotation = {
        id: 'ann-002',
        annotation_type: 'band_dominant',
        source: 'band_analysis',
        channel: null,
        start_time: 0,
        end_time: 10,
        label: 'Alpha dominant',
        color: '#34D399',
        severity: 0.5,
        confidence: 0.7,
        metadata: {},
        is_user_created: false,
        created_at: null,
      }

      expect(annotation.channel).toBeNull()
    })

    it('should support user-created annotations', () => {
      const annotation: Annotation = {
        id: 'ann-003',
        annotation_type: 'user_note',
        source: 'user',
        channel: 'Fp1',
        start_time: 5.0,
        end_time: 6.0,
        label: 'Interesting segment',
        color: '#10B981',
        severity: 0.0,
        confidence: 1.0,
        metadata: { note: 'Review this section' },
        is_user_created: true,
        created_at: '2025-01-01T12:00:00Z',
      }

      expect(annotation.is_user_created).toBe(true)
      expect(annotation.source).toBe('user')
    })
  })
})
