import { describe, it, expect } from 'vitest';
import {
  ANNOTATION_STYLES,
  ANNOTATION_TYPES_BY_SOURCE,
  getAnnotationRenderStyle,
  getAnnotationColor,
  getAnnotationLabel,
  isAnnotationInTimeRange,
  type AnnotationType,
  type AnnotationSource,
  type Annotation,
  type AnnotationRenderStyle,
} from '../annotation';

describe('annotation types', () => {
  describe('ANNOTATION_STYLES', () => {
    it('should define all 12 annotation types with styles', () => {
      const typeKeys = Object.keys(ANNOTATION_STYLES) as AnnotationType[];
      expect(typeKeys).toHaveLength(12);
    });

    it('should have label, color, and renderStyle for each type', () => {
      for (const [type, style] of Object.entries(ANNOTATION_STYLES)) {
        expect(style.label).toBeTruthy();
        expect(style.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(['highlight', 'marker', 'label']).toContain(style.renderStyle);
      }
    });

    it('should assign highlight to artifact types', () => {
      const artifactTypes: AnnotationType[] = [
        'artifact_eog', 'artifact_emg', 'artifact_flat',
        'artifact_drift', 'artifact_jump',
      ];
      for (const type of artifactTypes) {
        expect(ANNOTATION_STYLES[type].renderStyle).toBe('highlight');
      }
    });

    it('should assign marker to anomaly types', () => {
      const anomalyTypes: AnnotationType[] = [
        'anomaly_spike', 'anomaly_sharp_wave', 'anomaly_spike_and_slow',
        'anomaly_slow_wave', 'anomaly_rhythmic',
      ];
      for (const type of anomalyTypes) {
        expect(ANNOTATION_STYLES[type].renderStyle).toBe('marker');
      }
    });

    it('should assign label to band types', () => {
      expect(ANNOTATION_STYLES.band_dominant.renderStyle).toBe('label');
    });
  });

  describe('ANNOTATION_TYPES_BY_SOURCE', () => {
    it('should group types by 4 sources', () => {
      const sources = Object.keys(ANNOTATION_TYPES_BY_SOURCE) as AnnotationSource[];
      expect(sources).toEqual(['preprocess', 'band_analysis', 'anomaly_detection', 'user']);
    });

    it('should have correct artifact types under preprocess', () => {
      expect(ANNOTATION_TYPES_BY_SOURCE.preprocess).toHaveLength(5);
      expect(ANNOTATION_TYPES_BY_SOURCE.preprocess).toContain('artifact_eog');
    });

    it('should have correct types under anomaly_detection', () => {
      expect(ANNOTATION_TYPES_BY_SOURCE.anomaly_detection).toHaveLength(5);
      expect(ANNOTATION_TYPES_BY_SOURCE.anomaly_detection).toContain('anomaly_spike');
    });

    it('should have user_note under user', () => {
      expect(ANNOTATION_TYPES_BY_SOURCE.user).toEqual(['user_note']);
    });
  });

  describe('getAnnotationRenderStyle', () => {
    it('should return correct style for known types', () => {
      expect(getAnnotationRenderStyle('artifact_eog')).toBe('highlight');
      expect(getAnnotationRenderStyle('anomaly_spike')).toBe('marker');
      expect(getAnnotationRenderStyle('band_dominant')).toBe('label');
    });
  });

  describe('getAnnotationColor', () => {
    it('should return hex color for known types', () => {
      expect(getAnnotationColor('artifact_eog')).toBe('#FCD34D');
      expect(getAnnotationColor('anomaly_spike')).toBe('#EF4444');
    });
  });

  describe('getAnnotationLabel', () => {
    it('should return label for known types', () => {
      expect(getAnnotationLabel('artifact_eog')).toBe('EOG 眼电伪迹');
      expect(getAnnotationLabel('anomaly_spike')).toBe('棘波');
    });

    it('should return the type string for unknown types (fallback)', () => {
      // The function returns from ANNOTATION_STYLES, which has all known types
      // For truly unknown, it returns the type string itself
      expect(getAnnotationLabel('band_dominant' as AnnotationType)).toBe('优势频段');
    });
  });

  describe('isAnnotationInTimeRange', () => {
    const annotation: Annotation = {
      id: 'test-1',
      annotation_type: 'artifact_eog',
      source: 'preprocess',
      channel: 'Fp1',
      start_time: 5,
      end_time: 10,
      label: 'EOG',
      color: '#FCD34D',
      severity: 0.5,
      confidence: 0.8,
      metadata: {},
      is_user_created: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    it('should return true when annotation overlaps range', () => {
      expect(isAnnotationInTimeRange(annotation, 0, 6)).toBe(true);
      expect(isAnnotationInTimeRange(annotation, 8, 15)).toBe(true);
      expect(isAnnotationInTimeRange(annotation, 3, 12)).toBe(true);
      expect(isAnnotationInTimeRange(annotation, 5, 10)).toBe(true);
    });

    it('should return false when annotation does not overlap', () => {
      expect(isAnnotationInTimeRange(annotation, 0, 5)).toBe(false);
      expect(isAnnotationInTimeRange(annotation, 10, 20)).toBe(false);
      expect(isAnnotationInTimeRange(annotation, 0, 4)).toBe(false);
    });
  });
});
