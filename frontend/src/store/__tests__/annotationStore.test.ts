import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAnnotationStore } from '../annotationStore';
import type { Annotation, AnnotationSet } from '../../types/annotation';

// Mock the API module
vi.mock('../../api/annotations', () => ({
  generateAnnotations: vi.fn(),
  getAnnotations: vi.fn(),
  addUserAnnotation: vi.fn(),
  deleteUserAnnotation: vi.fn(),
  clearAnnotationCache: vi.fn(),
}));

import {
  generateAnnotations as apiGenerate,
  getAnnotations as apiGetAnnotations,
  addUserAnnotation as apiAddUserAnnotation,
  deleteUserAnnotation as apiDeleteUserAnnotation,
} from '../../api/annotations';

const mockApiGenerate = vi.mocked(apiGenerate);
const mockApiGetAnnotations = vi.mocked(apiGetAnnotations);
const mockApiAddUserAnnotation = vi.mocked(apiAddUserAnnotation);
const mockApiDeleteUserAnnotation = vi.mocked(apiDeleteUserAnnotation);

const mockAnnotation: Annotation = {
  id: 'ann-1',
  annotation_type: 'artifact_eog',
  source: 'preprocess',
  channel: 'Fp1',
  start_time: 1.0,
  end_time: 2.0,
  label: 'EOG 眼电伪迹',
  color: '#FCD34D',
  severity: 0.5,
  confidence: 0.8,
  metadata: {},
  is_user_created: false,
  created_at: '2024-01-01T00:00:00Z',
};

const mockAnnotation2: Annotation = {
  id: 'ann-2',
  annotation_type: 'anomaly_spike',
  source: 'anomaly_detection',
  channel: 'Fp2',
  start_time: 3.0,
  end_time: 4.0,
  label: '棘波',
  color: '#EF4444',
  severity: 0.7,
  confidence: 0.9,
  metadata: {},
  is_user_created: false,
  created_at: '2024-01-01T00:00:01Z',
};

const mockUserAnnotation: Annotation = {
  id: 'ann-user-1',
  annotation_type: 'user_note',
  source: 'user',
  channel: 'F3',
  start_time: 2.0,
  end_time: 3.0,
  label: 'Interesting',
  color: '#10B981',
  severity: 0.3,
  confidence: 1.0,
  metadata: { note: 'Check this area' },
  is_user_created: true,
  created_at: '2024-01-01T00:00:02Z',
};

const mockAnnotationSet: AnnotationSet = {
  file_id: 'file-123',
  annotations: [mockAnnotation, mockAnnotation2],
  summary: { artifact_eog: 1, anomaly_spike: 1 },
  generated_at: '2024-01-01T00:00:00Z',
};

describe('annotationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAnnotationStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have null annotationSet', () => {
      expect(useAnnotationStore.getState().annotationSet).toBeNull();
    });

    it('should not be loading', () => {
      expect(useAnnotationStore.getState().isLoading).toBe(false);
    });

    it('should have no error', () => {
      expect(useAnnotationStore.getState().error).toBeNull();
    });

    it('should have empty visibility filters', () => {
      const filter = useAnnotationStore.getState().visibilityFilter;
      expect(filter.types).toEqual([]);
      expect(filter.channels).toEqual([]);
      expect(filter.source).toEqual([]);
    });
  });

  describe('generateAnnotations', () => {
    it('should call API and set annotationSet on success', async () => {
      mockApiGenerate.mockResolvedValueOnce(mockAnnotationSet);

      await useAnnotationStore.getState().generateAnnotations('file-123');

      expect(mockApiGenerate).toHaveBeenCalledWith('file-123');
      const state = useAnnotationStore.getState();
      expect(state.annotationSet).toEqual(mockAnnotationSet);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set loading state during generation', async () => {
      let resolvePromise!: (value: AnnotationSet) => void;
      mockApiGenerate.mockImplementationOnce(
        () => new Promise<AnnotationSet>((resolve) => { resolvePromise = resolve; })
      );

      const promise = useAnnotationStore.getState().generateAnnotations('file-123');
      expect(useAnnotationStore.getState().isLoading).toBe(true);

      resolvePromise(mockAnnotationSet);
      await promise;

      expect(useAnnotationStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      mockApiGenerate.mockRejectedValueOnce(new Error('Network error'));

      await useAnnotationStore.getState().generateAnnotations('file-123');

      const state = useAnnotationStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
      expect(state.annotationSet).toBeNull();
    });
  });

  describe('fetchAnnotations', () => {
    it('should fetch annotations with params', async () => {
      mockApiGetAnnotations.mockResolvedValueOnce(mockAnnotationSet);

      await useAnnotationStore.getState().fetchAnnotations('file-123', {
        start: 0,
        end: 10,
        types: ['artifact_eog'],
      });

      expect(mockApiGetAnnotations).toHaveBeenCalledWith('file-123', {
        start: 0,
        end: 10,
        types: ['artifact_eog'],
      });
      expect(useAnnotationStore.getState().annotationSet).toEqual(mockAnnotationSet);
    });

    it('should set error on fetch failure', async () => {
      mockApiGetAnnotations.mockRejectedValueOnce(new Error('Server error'));

      await useAnnotationStore.getState().fetchAnnotations('file-123');

      expect(useAnnotationStore.getState().error).toBe('Server error');
    });
  });

  describe('addUserAnnotation', () => {
    beforeEach(() => {
      useAnnotationStore.setState({ annotationSet: mockAnnotationSet });
    });

    it('should call API and add annotation to set', async () => {
      mockApiAddUserAnnotation.mockResolvedValueOnce(mockUserAnnotation);

      await useAnnotationStore.getState().addUserAnnotation(
        'file-123', 'F3', 2.0, 3.0, 'Interesting', 'Check this area'
      );

      expect(mockApiAddUserAnnotation).toHaveBeenCalledWith('file-123', {
        channel: 'F3',
        start_time: 2.0,
        end_time: 3.0,
        label: 'Interesting',
        note: 'Check this area',
      });

      const state = useAnnotationStore.getState();
      expect(state.annotationSet?.annotations).toHaveLength(3);
      expect(state.annotationSet?.annotations).toContainEqual(mockUserAnnotation);
      expect(state.annotationSet?.summary.user_note).toBe(1);
    });

    it('should set error on add failure', async () => {
      mockApiAddUserAnnotation.mockRejectedValueOnce(new Error('Add failed'));

      await useAnnotationStore.getState().addUserAnnotation(
        'file-123', 'F3', 2.0, 3.0, 'Test'
      );

      expect(useAnnotationStore.getState().error).toBe('Add failed');
    });
  });

  describe('removeUserAnnotation', () => {
    beforeEach(() => {
      useAnnotationStore.setState({
        annotationSet: {
          ...mockAnnotationSet,
          annotations: [...mockAnnotationSet.annotations, mockUserAnnotation],
          summary: { ...mockAnnotationSet.summary, user_note: 1 },
        },
      });
    });

    it('should call API and remove annotation from set', async () => {
      mockApiDeleteUserAnnotation.mockResolvedValueOnce(undefined);

      await useAnnotationStore.getState().removeUserAnnotation('file-123', 'ann-user-1');

      expect(mockApiDeleteUserAnnotation).toHaveBeenCalledWith('file-123', 'ann-user-1');

      const state = useAnnotationStore.getState();
      expect(state.annotationSet?.annotations).toHaveLength(2);
      expect(state.annotationSet?.annotations.find(a => a.id === 'ann-user-1')).toBeUndefined();
      expect(state.annotationSet?.summary.user_note).toBe(0);
    });

    it('should set error on delete failure', async () => {
      mockApiDeleteUserAnnotation.mockRejectedValueOnce(new Error('Delete failed'));

      await useAnnotationStore.getState().removeUserAnnotation('file-123', 'ann-user-1');

      expect(useAnnotationStore.getState().error).toBe('Delete failed');
    });
  });

  describe('visibility filters', () => {
    it('should toggle type visibility', () => {
      useAnnotationStore.getState().toggleTypeVisibility('artifact_eog');
      expect(useAnnotationStore.getState().visibilityFilter.types).toEqual(['artifact_eog']);

      useAnnotationStore.getState().toggleTypeVisibility('artifact_eog');
      expect(useAnnotationStore.getState().visibilityFilter.types).toEqual([]);
    });

    it('should toggle source visibility', () => {
      useAnnotationStore.getState().toggleSourceVisibility('preprocess');
      expect(useAnnotationStore.getState().visibilityFilter.source).toEqual(['preprocess']);

      useAnnotationStore.getState().toggleSourceVisibility('preprocess');
      expect(useAnnotationStore.getState().visibilityFilter.source).toEqual([]);
    });

    it('should set visible types', () => {
      useAnnotationStore.getState().setVisibleTypes(['artifact_eog', 'anomaly_spike']);
      expect(useAnnotationStore.getState().visibilityFilter.types).toEqual(['artifact_eog', 'anomaly_spike']);
    });

    it('should set visible sources', () => {
      useAnnotationStore.getState().setVisibleSources(['preprocess']);
      expect(useAnnotationStore.getState().visibilityFilter.source).toEqual(['preprocess']);
    });

    it('should set visible channels', () => {
      useAnnotationStore.getState().setVisibleChannels(['Fp1', 'Fp2']);
      expect(useAnnotationStore.getState().visibilityFilter.channels).toEqual(['Fp1', 'Fp2']);
    });

    it('should merge partial filter with setVisibilityFilter', () => {
      useAnnotationStore.getState().setVisibilityFilter({ types: ['artifact_eog'] });
      useAnnotationStore.getState().setVisibilityFilter({ channels: ['Fp1'] });
      const filter = useAnnotationStore.getState().visibilityFilter;
      expect(filter.types).toEqual(['artifact_eog']);
      expect(filter.channels).toEqual(['Fp1']);
    });
  });

  describe('getFilteredAnnotations', () => {
    beforeEach(() => {
      useAnnotationStore.setState({
        annotationSet: {
          ...mockAnnotationSet,
          annotations: [mockAnnotation, mockAnnotation2, mockUserAnnotation],
        },
      });
    });

    it('should return all annotations when no filters set', () => {
      const result = useAnnotationStore.getState().getFilteredAnnotations();
      expect(result).toHaveLength(3);
    });

    it('should filter by type', () => {
      useAnnotationStore.getState().setVisibleTypes(['artifact_eog']);
      const result = useAnnotationStore.getState().getFilteredAnnotations();
      expect(result).toHaveLength(1);
      expect(result[0].annotation_type).toBe('artifact_eog');
    });

    it('should filter by source', () => {
      useAnnotationStore.getState().setVisibleSources(['anomaly_detection']);
      const result = useAnnotationStore.getState().getFilteredAnnotations();
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('anomaly_detection');
    });

    it('should filter by channel', () => {
      useAnnotationStore.getState().setVisibleChannels(['Fp1']);
      const result = useAnnotationStore.getState().getFilteredAnnotations();
      // Fp1 annotation + null channel annotations + user annotation (F3, not Fp1)
      expect(result.some(a => a.channel === 'Fp1')).toBe(true);
    });

    it('should allow null-channel annotations when channel filter is set', () => {
      // Add an annotation with null channel
      const nullChannelAnnotation: Annotation = {
        ...mockAnnotation,
        id: 'ann-null',
        channel: null,
      };
      useAnnotationStore.setState({
        annotationSet: {
          ...mockAnnotationSet,
          annotations: [nullChannelAnnotation, mockAnnotation2, mockUserAnnotation],
        },
      });

      useAnnotationStore.getState().setVisibleChannels(['Fp1']);
      const result = useAnnotationStore.getState().getFilteredAnnotations();
      // null channel should pass through
      expect(result).toContainEqual(nullChannelAnnotation);
    });

    it('should combine multiple filters', () => {
      useAnnotationStore.getState().setVisibleTypes(['artifact_eog']);
      useAnnotationStore.getState().setVisibleChannels(['Fp1']);
      const result = useAnnotationStore.getState().getFilteredAnnotations();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ann-1');
    });
  });

  describe('getAnnotationsForTimeWindow', () => {
    beforeEach(() => {
      useAnnotationStore.setState({
        annotationSet: {
          ...mockAnnotationSet,
          annotations: [mockAnnotation, mockAnnotation2],
        },
      });
    });

    it('should return annotations in time window', () => {
      // mockAnnotation: 1.0-2.0, mockAnnotation2: 3.0-4.0
      const result = useAnnotationStore.getState().getAnnotationsForTimeWindow(0, 2.5);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ann-1');
    });

    it('should return all annotations in large window', () => {
      const result = useAnnotationStore.getState().getAnnotationsForTimeWindow(0, 10);
      expect(result).toHaveLength(2);
    });

    it('should return no annotations in empty window', () => {
      const result = useAnnotationStore.getState().getAnnotationsForTimeWindow(10, 20);
      expect(result).toHaveLength(0);
    });
  });

  describe('clearAnnotations', () => {
    it('should clear annotationSet and error', () => {
      useAnnotationStore.setState({
        annotationSet: mockAnnotationSet,
        error: 'some error',
      });

      useAnnotationStore.getState().clearAnnotations();

      expect(useAnnotationStore.getState().annotationSet).toBeNull();
      expect(useAnnotationStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      useAnnotationStore.setState({
        annotationSet: mockAnnotationSet,
        isLoading: true,
        error: 'error',
        visibilityFilter: { types: ['artifact_eog'], channels: ['Fp1'], source: ['preprocess'] },
      });

      useAnnotationStore.getState().reset();

      const state = useAnnotationStore.getState();
      expect(state.annotationSet).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.visibilityFilter.types).toEqual([]);
      expect(state.visibilityFilter.channels).toEqual([]);
      expect(state.visibilityFilter.source).toEqual([]);
    });
  });
});
