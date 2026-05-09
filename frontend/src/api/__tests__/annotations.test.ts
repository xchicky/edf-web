/**
 * annotations.test.ts
 * 标注 API 函数的单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
  generateAnnotations,
  getAnnotations,
  addUserAnnotation,
  deleteUserAnnotation,
  clearAnnotationCache,
} from '../annotations';
import type { AnnotationSet } from '../../types/annotation';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock env module
vi.mock('../../env', () => ({
  getApiUrl: (endpoint: string) => `http://localhost:8001/api${endpoint}`,
}));

describe('Annotations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const API_BASE = 'http://localhost:8001/api';

  describe('generateAnnotations', () => {
    const mockAnnotationSet: AnnotationSet = {
      file_id: 'test-file-id',
      annotations: [],
      summary: {},
      generated_at: '2024-01-01T00:00:00Z',
    };

    it('应该使用默认选项生成标注', async () => {
      const fileId = 'test-file-id';

      mockedAxios.post.mockResolvedValue({ data: mockAnnotationSet });

      const result = await generateAnnotations(fileId);

      expect(result).toEqual(mockAnnotationSet);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id/generate`,
        {
          run_band_analysis: true,
          run_anomaly_detection: true,
          anomaly_sensitivity: 1.0,
        },
        { timeout: 120000 }
      );
    });

    it('应该使用自定义选项生成标注', async () => {
      const fileId = 'test-file-id';
      const options = {
        run_band_analysis: false,
        run_anomaly_detection: true,
        anomaly_sensitivity: 1.5,
      };

      mockedAxios.post.mockResolvedValue({ data: mockAnnotationSet });

      const result = await generateAnnotations(fileId, options);

      expect(result).toEqual(mockAnnotationSet);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id/generate`,
        {
          run_band_analysis: false,
          run_anomaly_detection: true,
          anomaly_sensitivity: 1.5,
        },
        { timeout: 120000 }
      );
    });

    it('应该只运行异常检测', async () => {
      const fileId = 'test-file-id';
      const options = {
        run_band_analysis: false,
        run_anomaly_detection: true,
      };

      mockedAxios.post.mockResolvedValue({ data: mockAnnotationSet });

      await generateAnnotations(fileId, options);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id/generate`,
        expect.objectContaining({
          run_band_analysis: false,
          run_anomaly_detection: true,
        }),
        expect.any(Object)
      );
    });

    it('应该处理生成失败', async () => {
      const fileId = 'test-file-id';
      const mockError = new Error('Generation failed');

      mockedAxios.post.mockRejectedValue(mockError);

      await expect(generateAnnotations(fileId)).rejects.toThrow('Generation failed');
    });
  });

  describe('getAnnotations', () => {
    const mockAnnotationSet: AnnotationSet = {
      file_id: 'test-file-id',
      annotations: [],
      summary: {},
      generated_at: '2024-01-01T00:00:00Z',
    };

    it('应该获取标注（不带参数）', async () => {
      const fileId = 'test-file-id';

      mockedAxios.get.mockResolvedValue({ data: mockAnnotationSet });

      const result = await getAnnotations(fileId);

      expect(result).toEqual(mockAnnotationSet);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id`,
        { params: {} }
      );
    });

    it('应该获取标注（带过滤参数）', async () => {
      const fileId = 'test-file-id';
      const params = {
        types: ['artifact_eog', 'anomaly_spike'],
        channels: ['Fp1', 'Fp2'],
        start: 10,
        end: 20,
      };

      mockedAxios.get.mockResolvedValue({ data: mockAnnotationSet });

      const result = await getAnnotations(fileId, params);

      expect(result).toEqual(mockAnnotationSet);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id`,
        {
          params: {
            types: 'artifact_eog,anomaly_spike',
            channels: 'Fp1,Fp2',
            start: '10',
            end: '20',
          },
        }
      );
    });
  });

  describe('addUserAnnotation', () => {
    it('应该添加用户标注', async () => {
      const fileId = 'test-file-id';
      const data = {
        annotation_type: 'user_note',
        channel: 'Fp1',
        start_time: 10.5,
        end_time: 11.0,
        label: '测试标注',
        note: '备注',
      };

      const mockResponse = {
        id: 'annotation-1',
        annotation_type: 'user_note',
        source: 'user',
        channel: 'Fp1',
        start_time: 10.5,
        end_time: 11.0,
        label: '测试标注',
        color: '#6366f1',
        severity: 0.5,
        confidence: 1.0,
        metadata: {},
        is_user_created: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await addUserAnnotation(fileId, data);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id/user`,
        data
      );
    });
  });

  describe('deleteUserAnnotation', () => {
    it('应该删除用户标注', async () => {
      const fileId = 'test-file-id';
      const annotationId = 'annotation-1';

      mockedAxios.delete.mockResolvedValue({ data: { message: '已删除' } });

      await deleteUserAnnotation(fileId, annotationId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id/user/annotation-1`
      );
    });
  });

  describe('clearAnnotationCache', () => {
    it('应该清除标注缓存', async () => {
      const fileId = 'test-file-id';

      mockedAxios.delete.mockResolvedValue({
        data: { message: '文件 test-file-id 的标注缓存已清除' },
      });

      await clearAnnotationCache(fileId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${API_BASE}/annotations/test-file-id/cache`
      );
    });

    it('应该处理清除缓存失败', async () => {
      const fileId = 'test-file-id';
      const mockError = new Error('Clear failed');

      mockedAxios.delete.mockRejectedValue(mockError);

      await expect(clearAnnotationCache(fileId)).rejects.toThrow('Clear failed');
    });
  });
});
