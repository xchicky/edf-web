/**
 * edf.preprocessing.test.ts
 * EDF API 预处理功能扩展的单元测试
 * TDD Phase 2: Frontend API Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
  analyzeTimeDomain,
  analyzePSD,
  analyzeComprehensive,
} from '../edf';
import type {
  TimeDomainResponse,
  PSDResponse,
  ComprehensiveResponse,
  PreprocessConfig,
} from '../../types/analysis';

// Mock axios
vi.mock('axios');

// Mock getApiUrl
vi.mock('../../env', () => ({
  getApiUrl: (path: string) => `http://localhost:8000${path}`,
}));

const mockedAxios = vi.mocked(axios);

describe('EDF API - Preprocessing Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeTimeDomain with preprocessing', () => {
    it('应该在请求中包含预处理配置', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = ['Fp1'];
      const preprocess: PreprocessConfig = {
        method: 'linear_detrend',
        parameters: null,
      };

      const mockResponse: TimeDomainResponse = {
        file_id: fileId,
        channels: channels,
        statistics: {
          Fp1: {
            mean: 0.5,
            std: 1.2,
            min: -2,
            max: 3,
            rms: 1.3,
            peak_to_peak: 5,
            kurtosis: 2.5,
            skewness: 0.1,
            n_samples: 1280,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzeTimeDomain(fileId, start, duration, channels, preprocess);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        {
          channels: channels,
          start,
          duration,
          preprocess: preprocess,
        }
      );
    });

    it('应该支持多项式去漂移预处理', async () => {
      const fileId = 'test-file-id';
      const preprocess: PreprocessConfig = {
        method: 'polynomial_detrend',
        parameters: { order: 2 },
      };

      const mockResponse: TimeDomainResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        statistics: {
          Fp1: {
            mean: 0,
            std: 1.0,
            min: -2,
            max: 2,
            rms: 1.0,
            peak_to_peak: 4,
            kurtosis: 3,
            skewness: 0,
            n_samples: 1280,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzeTimeDomain(fileId, 0, 5, ['Fp1'], preprocess);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        expect.objectContaining({
          preprocess: {
            method: 'polynomial_detrend',
            parameters: { order: 2 },
          },
        })
      );
    });

    it('应该支持高通滤波预处理', async () => {
      const fileId = 'test-file-id';
      const preprocess: PreprocessConfig = {
        method: 'highpass_filter',
        parameters: { cutoff: 0.5 },
      };

      const mockResponse: TimeDomainResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        statistics: {
          Fp1: {
            mean: 0.1,
            std: 1.0,
            min: -2,
            max: 2,
            rms: 1.0,
            peak_to_peak: 4,
            kurtosis: 3,
            skewness: 0,
            n_samples: 1280,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzeTimeDomain(fileId, 0, 5, ['Fp1'], preprocess);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        expect.objectContaining({
          preprocess: {
            method: 'highpass_filter',
            parameters: { cutoff: 0.5 },
          },
        })
      );
    });

    it('应该支持基线校正预处理', async () => {
      const fileId = 'test-file-id';
      const preprocess: PreprocessConfig = {
        method: 'baseline_correction',
        parameters: null,
      };

      const mockResponse: TimeDomainResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        statistics: {
          Fp1: {
            mean: 0,
            std: 1.0,
            min: -2,
            max: 2,
            rms: 1.0,
            peak_to_peak: 4,
            kurtosis: 3,
            skewness: 0,
            n_samples: 1280,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzeTimeDomain(fileId, 0, 5, ['Fp1'], preprocess);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        expect.objectContaining({
          preprocess: {
            method: 'baseline_correction',
            parameters: null,
          },
        })
      );
    });

    it('应该在未指定预处理时发送 null', async () => {
      const fileId = 'test-file-id';

      const mockResponse: TimeDomainResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        statistics: {
          Fp1: {
            mean: 0.5,
            std: 1.2,
            min: -2,
            max: 3,
            rms: 1.3,
            peak_to_peak: 5,
            kurtosis: 2.5,
            skewness: 0.1,
            n_samples: 1280,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzeTimeDomain(fileId, 0, 5, ['Fp1']);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        expect.objectContaining({
          preprocess: null,
        })
      );
    });

    it('应该在未指定预处理时发送 null（即使指定了其他参数）', async () => {
      const fileId = 'test-file-id';
      const channels = ['Fp1', 'Fp2'];

      const mockResponse: TimeDomainResponse = {
        file_id: fileId,
        channels: channels,
        statistics: {
          Fp1: {
            mean: 0.5,
            std: 1.2,
            min: -2,
            max: 3,
            rms: 1.3,
            peak_to_peak: 5,
            kurtosis: 2.5,
            skewness: 0.1,
            n_samples: 1280,
          },
          Fp2: {
            mean: 0.3,
            std: 1.1,
            min: -1.5,
            max: 2.5,
            rms: 1.2,
            peak_to_peak: 4,
            kurtosis: 2.3,
            skewness: 0.2,
            n_samples: 1280,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzeTimeDomain(fileId, 10, 5, channels);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        {
          channels: channels,
          start: 10,
          duration: 5,
          preprocess: null,
        }
      );
    });
  });

  describe('analyzePSD with preprocessing', () => {
    it('应该在请求中包含预处理配置', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = ['Fp1'];
      const fmin = 0.5;
      const fmax = 50;
      const preprocess: PreprocessConfig = {
        method: 'linear_detrend',
        parameters: null,
      };

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: channels,
        psd_data: {
          Fp1: {
            frequencies: [0.5, 1, 1.5, 2],
            psd: [1, 2, 3, 4],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzePSD(fileId, start, duration, channels, fmin, fmax, preprocess);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        {
          channels: channels,
          start,
          duration,
          fmin: fmin,
          fmax: fmax,
          preprocess: preprocess,
        }
      );
    });

    it('应该支持多项式去漂移预处理', async () => {
      const fileId = 'test-file-id';
      const preprocess: PreprocessConfig = {
        method: 'polynomial_detrend',
        parameters: { order: 2 },
      };

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        psd_data: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzePSD(fileId, 0, 5, ['Fp1'], undefined, undefined, preprocess);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        expect.objectContaining({
          preprocess: {
            method: 'polynomial_detrend',
            parameters: { order: 2 },
          },
        })
      );
    });

    it('应该支持高通滤波预处理', async () => {
      const fileId = 'test-file-id';
      const preprocess: PreprocessConfig = {
        method: 'highpass_filter',
        parameters: { cutoff: 0.5 },
      };

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        psd_data: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzePSD(fileId, 0, 5, ['Fp1'], undefined, undefined, preprocess);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        expect.objectContaining({
          preprocess: {
            method: 'highpass_filter',
            parameters: { cutoff: 0.5 },
          },
        })
      );
    });

    it('应该在未指定预处理时发送 null', async () => {
      const fileId = 'test-file-id';

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        psd_data: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzePSD(fileId, 0, 5, ['Fp1']);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        expect.objectContaining({
          preprocess: null,
        })
      );
    });

    it('应该使用默认频率范围', async () => {
      const fileId = 'test-file-id';

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        psd_data: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzePSD(fileId, 0, 5, ['Fp1']);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        {
          channels: ['Fp1'],
          start: 0,
          duration: 5,
          fmin: 0.5,
          fmax: 50,
          preprocess: null,
        }
      );
    });
  });

  describe('analyzeComprehensive with preprocessing', () => {
    it('应该在请求中包含预处理配置', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = ['Fp1'];
      const preprocess: PreprocessConfig = {
        method: 'linear_detrend',
        parameters: null,
      };

      const mockResponse: ComprehensiveResponse = {
        file_id: fileId,
        channels: channels,
        time_domain: {
          Fp1: {
            mean: 0.5,
            std: 1.2,
            min: -2,
            max: 3,
            rms: 1.3,
            peak_to_peak: 5,
            kurtosis: 2.5,
            skewness: 0.1,
            n_samples: 1280,
          },
        },
        band_power: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
          },
        },
        psd: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzeComprehensive(fileId, start, duration, channels, undefined, undefined, undefined, preprocess);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/comprehensive/${fileId}`,
        {
          channels: channels,
          start,
          duration,
          fmin: 0.5,
          fmax: 50,
          bands: null,
          preprocess: preprocess,
        }
      );
    });

    it('应该支持所有预处理方法', async () => {
      const fileId = 'test-file-id';
      const preprocessMethods: PreprocessConfig[] = [
        { method: 'none', parameters: null },
        { method: 'linear_detrend', parameters: null },
        { method: 'polynomial_detrend', parameters: { order: 2 } },
        { method: 'highpass_filter', parameters: { cutoff: 0.5 } },
        { method: 'baseline_correction', parameters: null },
      ];

      const mockResponse: ComprehensiveResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        time_domain: {
          Fp1: {
            mean: 0,
            std: 1.0,
            min: -2,
            max: 2,
            rms: 1.0,
            peak_to_peak: 4,
            kurtosis: 3,
            skewness: 0,
            n_samples: 1280,
          },
        },
        band_power: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
          },
        },
        psd: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      for (const preprocess of preprocessMethods) {
        mockedAxios.post.mockClear();
        mockedAxios.post.mockResolvedValue({ data: mockResponse });

        await analyzeComprehensive(fileId, 0, 5, ['Fp1'], undefined, undefined, undefined, preprocess);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          `http://localhost:8000/analysis/comprehensive/${fileId}`,
          expect.objectContaining({
            preprocess: preprocess,
          })
        );
      }
    });

    it('应该在未指定预处理时发送 null', async () => {
      const fileId = 'test-file-id';

      const mockResponse: ComprehensiveResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        time_domain: {
          Fp1: {
            mean: 0.5,
            std: 1.2,
            min: -2,
            max: 3,
            rms: 1.3,
            peak_to_peak: 5,
            kurtosis: 2.5,
            skewness: 0.1,
            n_samples: 1280,
          },
        },
        band_power: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
          },
        },
        psd: {
          Fp1: {
            frequencies: [0.5, 1],
            psd: [1, 2],
            sfreq: 256,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      await analyzeComprehensive(fileId, 0, 5);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/comprehensive/${fileId}`,
        expect.objectContaining({
          preprocess: null,
        })
      );
    });
  });

  describe('错误处理 with preprocessing', () => {
    it('应该处理预处理参数无效的错误', async () => {
      const fileId = 'test-file-id';
      const invalidPreprocess: PreprocessConfig = {
        method: 'invalid_method' as any,
        parameters: null,
      };

      const mockError = new Error('Invalid preprocessing method');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(
        analyzeTimeDomain(fileId, 0, 5, ['Fp1'], invalidPreprocess)
      ).rejects.toThrow('Invalid preprocessing method');
    });

    it('应该处理网络错误（带预处理参数）', async () => {
      const fileId = 'test-file-id';
      const preprocess: PreprocessConfig = {
        method: 'linear_detrend',
        parameters: null,
      };

      const networkError = new Error('Network Error');
      (networkError as any).isAxiosError = true;

      mockedAxios.post.mockRejectedValue(networkError);

      await expect(
        analyzeTimeDomain(fileId, 0, 5, ['Fp1'], preprocess)
      ).rejects.toThrow('Network Error');
    });
  });
});
