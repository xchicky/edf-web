/**
 * Mode API 额外测试
 * 测试额外 API 函数以提高覆盖率
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  batchCheckCompatibility,
  applyMode,
  toggleModeFavorite,
  duplicateMode,
  exportMode,
  importMode,
  getRecommendedModes,
  resetMode,
} from '../mode';
import type { Mode } from '../../types/mode';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Mode API - Additional Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockApiUrl = 'http://localhost:8000';

  describe('batchCheckCompatibility', () => {
    it('应该成功批量检查兼容性', async () => {
      const mockResults = [
        {
          mode_id: 'mode-1',
          is_compatible: true,
          issues: [],
          warnings: [],
          can_apply_with_fixes: true,
        },
        {
          mode_id: 'mode-2',
          is_compatible: false,
          issues: [{ type: 'missing_channel', severity: 'error', message: 'Missing Fz' }],
          warnings: [],
          can_apply_with_fixes: false,
        },
      ];

      mockedAxios.post.mockResolvedValue({
        data: { results: mockResults },
      });

      const requests = [
        { mode_id: 'mode-1', channel_names: ['Fp1', 'Fp2'], sampling_rate: 256 },
        { mode_id: 'mode-2', channel_names: ['Fp1'], sampling_rate: 256 },
      ];

      const result = await batchCheckCompatibility(requests);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/batch-check-compatibility`, {
        requests,
      });
      expect(result).toHaveLength(2);
      expect(result[0].modeId).toBe('mode-1');
      expect(result[0].isCompatible).toBe(true);
      expect(result[1].modeId).toBe('mode-2');
      expect(result[1].isCompatible).toBe(false);
    });
  });

  describe('applyMode', () => {
    it('应该成功应用模式', async () => {
      const mockMode: Mode = {
        id: 'mode-1',
        name: 'Test Mode',
        category: 'clinical',
        description: 'Test',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          mode: mockMode,
          appliedConfig: {},
          issues: [],
        },
      });

      const result = await applyMode('mode-1', 'file-123');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/apply`, {
        file_id: 'file-123',
        auto_load_data: true,
        preserve_bookmarks: true,
      });
      expect(result.success).toBe(true);
    });

    it('应该支持自定义选项', async () => {
      const mockMode: Mode = {
        id: 'mode-1',
        name: 'Test Mode',
        category: 'clinical',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          mode: mockMode,
          appliedConfig: {},
          issues: [],
        },
      });

      await applyMode('mode-1', 'file-123', {
        autoLoadData: false,
        preserveBookmarks: false,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/apply`, {
        file_id: 'file-123',
        auto_load_data: false,
        preserve_bookmarks: false,
      });
    });
  });

  describe('toggleModeFavorite', () => {
    it('应该成功切换收藏状态', async () => {
      const mockMode: Mode = {
        id: 'mode-1',
        name: 'Test Mode',
        category: 'clinical',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: true,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({ data: mockMode });

      const result = await toggleModeFavorite('mode-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/favorite`);
      expect(result.isFavorite).toBe(true);
    });
  });

  describe('duplicateMode', () => {
    it('应该成功复制模式', async () => {
      const mockMode: Mode = {
        id: 'mode-2',
        name: 'Copy of Test Mode',
        category: 'custom',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({ data: mockMode });

      const result = await duplicateMode('mode-1', 'Copy of Test Mode');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/duplicate`, {
        new_name: 'Copy of Test Mode',
      });
      expect(result.id).toBe('mode-2');
    });

    it('应该支持不指定新名称', async () => {
      const mockMode: Mode = {
        id: 'mode-2',
        name: 'Test Mode (Copy)',
        category: 'custom',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({ data: mockMode });

      await duplicateMode('mode-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/duplicate`, {
        new_name: undefined,
      });
    });
  });

  describe('exportMode', () => {
    it('应该成功导出模式', async () => {
      const mockExportData = JSON.stringify({
        id: 'mode-1',
        name: 'Test Mode',
        category: 'clinical',
        config: {},
      });

      mockedAxios.get.mockResolvedValue({ data: mockExportData });

      const result = await exportMode('mode-1');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/export`, {
        responseType: 'text',
      });
      expect(result).toBe(mockExportData);
    });
  });

  describe('importMode', () => {
    it('应该成功导入模式', async () => {
      const mockModeData = JSON.stringify({
        id: 'mode-1',
        name: 'Test Mode',
        category: 'clinical',
        config: {},
      });

      const mockMode: Mode = {
        id: 'mode-new',
        name: 'Test Mode',
        category: 'custom',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({ data: mockMode });

      const result = await importMode(mockModeData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockApiUrl}/api/modes/import`,
        mockModeData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result.id).toBe('mode-new');
    });
  });

  describe('getRecommendedModes', () => {
    it('应该成功获取推荐模式', async () => {
      const mockModes: Mode[] = [
        {
          id: 'mode-1',
          name: 'Recommended Mode 1',
          category: 'clinical',
          config: {
            viewMode: 'waveform',
            timeWindow: 10,
            amplitudeScale: 1.0,
            showGrid: true,
            showAnnotations: true,
            displayChannels: [],
            enableFilter: false,
            bands: [],
            analysis: { enabled: false, type: 'stats', autoUpdate: false },
            autoSave: true,
            maxBookmarks: 50,
          },
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          isBuiltIn: true,
          isFavorite: false,
          usageCount: 0,
          tags: [],
        },
      ];

      mockedAxios.post.mockResolvedValue({
        data: { modes: mockModes },
      });

      const result = await getRecommendedModes(['Fp1', 'Fp2'], 256);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/recommend`, {
        channel_names: ['Fp1', 'Fp2'],
        sampling_rate: 256,
        context: undefined,
      });
      expect(result).toEqual(mockModes);
    });

    it('应该支持上下文参数', async () => {
      const mockModes: Mode[] = [];

      mockedAxios.post.mockResolvedValue({
        data: { modes: mockModes },
      });

      const context = {
        purpose: 'clinical-diagnosis',
        sessionDuration: 600,
        userLevel: 'intermediate',
      };

      await getRecommendedModes(['Fp1', 'Fp2'], 256, context);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/recommend`, {
        channel_names: ['Fp1', 'Fp2'],
        sampling_rate: 256,
        context,
      });
    });
  });

  describe('resetMode', () => {
    it('应该成功重置模式', async () => {
      const mockMode: Mode = {
        id: 'mode-1',
        name: 'Test Mode',
        category: 'clinical',
        config: {
          viewMode: 'waveform',
          timeWindow: 10,
          amplitudeScale: 1.0,
          showGrid: true,
          showAnnotations: true,
          displayChannels: [],
          enableFilter: false,
          bands: [],
          analysis: { enabled: false, type: 'stats', autoUpdate: false },
          autoSave: true,
          maxBookmarks: 50,
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        tags: [],
      };

      mockedAxios.post.mockResolvedValue({ data: mockMode });

      const result = await resetMode('mode-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/reset`);
      expect(result).toEqual(mockMode);
    });
  });
});
