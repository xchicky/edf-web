/**
 * edf.test.ts
 * EDF API 调用函数的单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
  uploadEDF,
  getMetadata,
  getWaveform,
  getWaveformOverview,
  validateSignalExpression,
  calculateSignals,
  analyzeTimeDomain,
  analyzeBandPower,
  analyzePSD,
  analyzeComprehensive,
  type EDFMetadata,
  type WaveformData,
} from '../edf';
import type { SignalValidation, SignalComputationResult } from '../../types/signal';
import type {
  TimeDomainResponse,
  BandPowerResponse,
  PSDResponse,
  ComprehensiveResponse,
} from '../../types/analysis';

// Mock axios
vi.mock('axios');

// Mock getApiUrl
vi.mock('../../env', () => ({
  getApiUrl: (path: string) => `http://localhost:8000${path}`,
}));

const mockedAxios = vi.mocked(axios);

describe('EDF API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadEDF', () => {
    it('应该成功上传 EDF 文件', async () => {
      const mockFile = new File(['mock content'], 'test.edf', { type: 'application/octet-stream' });
      const mockResponse: EDFMetadata = {
        file_id: 'test-file-id',
        filename: 'test.edf',
        file_size_mb: 10.5,
        n_channels: 19,
        channel_names: ['Fp1', 'Fp2', 'F3', 'F4'],
        sfreq: 256,
        duration_seconds: 600,
        duration_minutes: 10,
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await uploadEDF(mockFile);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/upload/',
        expect.any(FormData),
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000,
        }
      );
    });

    it('应该处理上传失败', async () => {
      const mockFile = new File(['mock content'], 'test.edf', { type: 'application/octet-stream' });
      const mockError = new Error('Upload failed');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(uploadEDF(mockFile)).rejects.toThrow('Upload failed');
    });
  });

  describe('getMetadata', () => {
    it('应该成功获取元数据', async () => {
      const fileId = 'test-file-id';
      const mockResponse: EDFMetadata = {
        file_id: fileId,
        filename: 'test.edf',
        file_size_mb: 10.5,
        n_channels: 19,
        channel_names: ['Fp1', 'Fp2', 'F3', 'F4'],
        sfreq: 256,
        duration_seconds: 600,
        duration_minutes: 10,
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await getMetadata(fileId);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(`http://localhost:8000/metadata/${fileId}`);
    });

    it('应该处理获取元数据失败', async () => {
      const fileId = 'non-existent-file';
      const mockError = new Error('File not found');
      mockedAxios.get.mockRejectedValue(mockError);

      await expect(getMetadata(fileId)).rejects.toThrow('File not found');
    });
  });

  describe('getWaveform', () => {
    it('应该成功获取波形数据（带通道参数）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = [0, 1, 2];

      const mockResponse: WaveformData = {
        file_id: fileId,
        data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        times: [10, 10.1, 10.2],
        channels: ['Fp1', 'Fp2', 'F3'],
        sfreq: 256,
        n_samples: 3,
        start_time: start,
        duration: duration,
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await getWaveform(fileId, start, duration, channels);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:8000/waveform/${fileId}`,
        {
          params: { start, duration, channels: '0,1,2' },
        }
      );
    });

    it('应该成功获取波形数据（不带通道参数）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;

      const mockResponse: WaveformData = {
        file_id: fileId,
        data: [[1, 2, 3]],
        times: [10, 10.1, 10.2],
        channels: ['Fp1'],
        sfreq: 256,
        n_samples: 3,
        start_time: start,
        duration: duration,
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await getWaveform(fileId, start, duration);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:8000/waveform/${fileId}`,
        {
          params: { start, duration, channels: undefined },
        }
      );
    });
  });

  describe('getWaveformOverview', () => {
    it('应该成功获取概览数据（带参数）', async () => {
      const fileId = 'test-file-id';
      const samplesPerSecond = 2.0;
      const channels = [0, 1];

      const mockResponse: WaveformData = {
        file_id: fileId,
        data: [[1, 2], [3, 4]],
        times: [0, 0.5],
        channels: ['Fp1', 'Fp2'],
        sfreq: 256,
        n_samples: 2,
        start_time: 0,
        duration: 600,
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await getWaveformOverview(fileId, samplesPerSecond, channels);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:8000/waveform_overview/${fileId}`,
        {
          params: { samples_per_second: samplesPerSecond, channels: '0,1' },
        }
      );
    });

    it('应该使用默认参数获取概览数据', async () => {
      const fileId = 'test-file-id';

      const mockResponse: WaveformData = {
        file_id: fileId,
        data: [[1]],
        times: [0],
        channels: ['Fp1'],
        sfreq: 256,
        n_samples: 1,
        start_time: 0,
        duration: 600,
      };

      mockedAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await getWaveformOverview(fileId);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:8000/waveform_overview/${fileId}`,
        {
          params: { samples_per_second: 1.0, channels: undefined },
        }
      );
    });
  });

  describe('validateSignalExpression', () => {
    it('应该成功验证有效表达式', async () => {
      const expression = 'Fp1 - F3';
      const channelNames = ['Fp1', 'Fp2', 'F3', 'F4'];

      const mockResponse: SignalValidation = {
        isValid: true,
        referencedChannels: ['Fp1', 'F3'],
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await validateSignalExpression(expression, channelNames);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/signals/validate',
        {
          expression,
          channel_names: channelNames,
        }
      );
    });

    it('应该返回无效表达式的错误', async () => {
      const expression = 'invalid +++ expression';
      const channelNames = ['Fp1', 'Fp2'];

      const mockResponse: SignalValidation = {
        isValid: false,
        referencedChannels: [],
        error: 'Invalid syntax',
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await validateSignalExpression(expression, channelNames);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid syntax');
    });
  });

  describe('calculateSignals', () => {
    it('应该成功计算派生信号', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;

      const signals = [
        {
          id: 'signal-1',
          expression: 'Fp1 - F3',
          operands: [
            { id: 'op1', channelName: 'Fp1', channelIndex: 0, coefficient: 1 },
            { id: 'op2', channelName: 'F3', channelIndex: 2, coefficient: -1 },
          ],
        },
      ];

      const mockResults: SignalComputationResult[] = [
        {
          id: 'signal-1',
          data: [1, 2, 3],
          times: [10, 10.1, 10.2],
          sfreq: 256,
          n_samples: 3,
        },
      ];

      mockedAxios.post.mockResolvedValue({ data: { results: mockResults } });

      const result = await calculateSignals(fileId, signals, start, duration);

      expect(result).toEqual(mockResults);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/signals/calculate',
        {
          file_id: fileId,
          signals,
          start,
          duration,
        }
      );
    });
  });

  describe('analyzeTimeDomain', () => {
    it('应该成功执行时域分析（带通道）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
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

      const result = await analyzeTimeDomain(fileId, start, duration, channels);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        {
          channels: channels,
          start,
          duration,
        }
      );
    });

    it('应该成功执行时域分析（不带通道）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;

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

      const result = await analyzeTimeDomain(fileId, start, duration);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/time_domain/${fileId}`,
        {
          channels: null,
          start,
          duration,
        }
      );
    });
  });

  describe('analyzeBandPower', () => {
    it('应该成功执行频带功率分析（完整参数）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = ['Fp1'];
      const bands = { delta: [0.5, 4], theta: [4, 8] };

      const mockResponse: BandPowerResponse = {
        file_id: fileId,
        channels: channels,
        band_powers: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
            theta: { absolute: 80, relative: 0.32, range: [4, 8] },
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzeBandPower(fileId, start, duration, channels, bands);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/band_power/${fileId}`,
        {
          channels: channels,
          start,
          duration,
          bands: bands,
        }
      );
    });

    it('应该使用默认频带执行分析', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;

      const mockResponse: BandPowerResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        band_powers: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
          },
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzeBandPower(fileId, start, duration);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/band_power/${fileId}`,
        {
          channels: null,
          start,
          duration,
          bands: null,
        }
      );
    });
  });

  describe('analyzePSD', () => {
    it('应该成功执行 PSD 分析（完整参数）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = ['Fp1'];
      const fmin = 0.5;
      const fmax = 50;

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: channels,
        frequencies: [0.5, 1, 1.5, 2],
        psd: {
          Fp1: [[1, 2, 3, 4]],
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzePSD(fileId, start, duration, channels, fmin, fmax);

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        {
          channels: channels,
          start,
          duration,
          fmin: fmin,
          fmax: fmax,
        }
      );
    });

    it('应该使用默认频率范围执行 PSD 分析', async () => {
      const fileId = 'test-file-id';

      const mockResponse: PSDResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        frequencies: [0.5, 1],
        psd: {
          Fp1: [[1, 2]],
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzePSD(fileId, 0, 10);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/psd/${fileId}`,
        {
          channels: null,
          start: 0,
          duration: 10,
          fmin: 0.5,
          fmax: 50,
        }
      );
    });
  });

  describe('analyzeComprehensive', () => {
    it('应该成功执行综合分析（完整参数）', async () => {
      const fileId = 'test-file-id';
      const start = 10;
      const duration = 5;
      const channels = ['Fp1'];
      const fmin = 0.5;
      const fmax = 50;
      const bands = { delta: [0.5, 4] };

      const mockResponse: ComprehensiveResponse = {
        file_id: fileId,
        channels: channels,
        time_domain: {
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
        },
        band_powers: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
          },
        },
        psd: {
          frequencies: [0.5, 1],
          Fp1: [1, 2],
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzeComprehensive(
        fileId,
        start,
        duration,
        channels,
        fmin,
        fmax,
        bands
      );

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/comprehensive/${fileId}`,
        {
          channels: channels,
          start,
          duration,
          fmin: fmin,
          fmax: fmax,
          bands: bands,
        }
      );
    });

    it('应该使用默认参数执行综合分析', async () => {
      const fileId = 'test-file-id';

      const mockResponse: ComprehensiveResponse = {
        file_id: fileId,
        channels: ['Fp1'],
        time_domain: {
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
        },
        band_powers: {
          Fp1: {
            delta: { absolute: 100, relative: 0.4, range: [0.5, 4] },
          },
        },
        psd: {
          frequencies: [0.5, 1],
          Fp1: [1, 2],
        },
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await analyzeComprehensive(fileId, 0, 10);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `http://localhost:8000/analysis/comprehensive/${fileId}`,
        {
          channels: null,
          start: 0,
          duration: 10,
          fmin: 0.5,
          fmax: 50,
          bands: null,
        }
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      const fileId = 'test-file-id';
      const networkError = new Error('Network Error');
      (networkError as any).isAxiosError = true;

      mockedAxios.get.mockRejectedValue(networkError);

      await expect(getMetadata(fileId)).rejects.toThrow('Network Error');
    });

    it('应该处理 HTTP 404 错误', async () => {
      const fileId = 'non-existent';
      const error404 = new Error('Request failed with status code 404');
      (error404 as any).isAxiosError = true;
      (error404 as any).response = { status: 404 };

      mockedAxios.get.mockRejectedValue(error404);

      await expect(getMetadata(fileId)).rejects.toThrow('404');
    });

    it('应该处理超时错误', async () => {
      const fileId = 'test-file-id';
      const timeoutError = new Error('timeout of 5000ms exceeded');
      (timeoutError as any).isAxiosError = true;
      (timeoutError as any).code = 'ECONNABORTED';

      mockedAxios.get.mockRejectedValue(timeoutError);

      await expect(getMetadata(fileId)).rejects.toThrow('timeout');
    });
  });
});
