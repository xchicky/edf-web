/**
 * Mode API 测试
 * 测试模式管理 API 客户端
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  getAllModes,
  getModeById,
  createMode,
  updateMode,
  deleteMode,
  checkModeCompatibility,
  recordModeUsage,
  getModeStats,
  getModeCategories,
  type Mode,
  type ModeCreateRequest,
} from '../mode';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Mode API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockApiUrl = 'http://localhost:8000';

  describe('getAllModes', () => {
    it('应该成功获取所有模式', async () => {
      const mockModes: Mode[] = [
        {
          id: 'mode-1',
          name: 'Test Mode 1',
          category: 'clinical',
          description: 'Test description',
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

      mockedAxios.get.mockResolvedValue({ data: { modes: mockModes, total: 1, categories: ['clinical'] } });

      const result = await getAllModes();

      expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/`, {
        params: undefined,
      });
      expect(result.modes).toEqual(mockModes);
      expect(result.total).toBe(1);
    });

    it('应该支持查询参数', async () => {
      const mockModes: Mode[] = [];
      mockedAxios.get.mockResolvedValue({ data: { modes: mockModes, total: 0, categories: [] } });

      await getAllModes({ category: 'clinical', includeBuiltIn: true });

      expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/`, {
        params: { category: 'clinical', include_built_in: true, include_custom: undefined, limit: undefined, offset: undefined },
      });
    });

    it('应该处理错误', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(getAllModes()).rejects.toThrow('Network error');
    });
  });

  describe('getModeById', () => {
    it('应该成功获取指定模式', async () => {
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

      mockedAxios.get.mockResolvedValue({ data: mockMode });

      const result = await getModeById('mode-1');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1`);
      expect(result).toEqual(mockMode);
    });

    it('应该处理模式不存在', async () => {
      mockedAxios.get.mockRejectedValue({ response: { status: 404 } });

      await expect(getModeById('non-existent')).rejects.toThrow();
    });
  });

  describe('createMode', () => {
    it('应该成功创建模式', async () => {
      const createRequest: ModeCreateRequest = {
        name: 'New Mode',
        category: 'custom',
        description: 'New custom mode',
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
        tags: ['custom', 'test'],
      };

      const mockMode: Mode = {
        id: 'mode-new',
        ...createRequest,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
      };

      mockedAxios.post.mockResolvedValue({ data: mockMode });

      const result = await createMode(createRequest);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockApiUrl}/api/modes/`,
        createRequest
      );
      expect(result.id).toBe('mode-new');
    });

    it('应该处理创建失败', async () => {
      const createRequest: ModeCreateRequest = {
        name: '',
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
      };

      mockedAxios.post.mockRejectedValue(new Error('Validation error'));

      await expect(createMode(createRequest)).rejects.toThrow('Validation error');
    });
  });

  describe('updateMode', () => {
    it('应该成功更新模式', async () => {
      const updateData: Partial<Mode> = {
        name: 'Updated Mode',
        isFavorite: true,
      };

      const mockMode: Mode = {
        id: 'mode-1',
        name: 'Updated Mode',
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

      mockedAxios.put.mockResolvedValue({ data: mockMode });

      const result = await updateMode('mode-1', updateData);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        `${mockApiUrl}/api/modes/mode-1`,
        updateData
      );
      expect(result.name).toBe('Updated Mode');
      expect(result.isFavorite).toBe(true);
    });

    it('应该处理更新不存在的模式', async () => {
      mockedAxios.put.mockRejectedValue({ response: { status: 404 } });

      await expect(updateMode('non-existent', { name: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteMode', () => {
    it('应该成功删除模式', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } });

      await deleteMode('mode-1');

      expect(mockedAxios.delete).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1`);
    });

    it('应该处理删除内置模式', async () => {
      mockedAxios.delete.mockRejectedValue({
        response: { status: 403, data: { detail: 'Cannot delete built-in mode' } },
      });

      await expect(deleteMode('built-in-mode')).rejects.toThrow();
    });
  });

  describe('checkModeCompatibility', () => {
    it('应该成功检查兼容性', async () => {
      const mockCompatibilityResult = {
        is_compatible: true,
        issues: [],
        warnings: [],
        can_apply_with_fixes: true,
      };

      mockedAxios.post.mockResolvedValue({ data: mockCompatibilityResult });

      const result = await checkModeCompatibility('mode-1', ['Fp1', 'Fp2'], 256);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/check-compatibility`, {
        mode_id: 'mode-1',
        channel_names: ['Fp1', 'Fp2'],
        sampling_rate: 256,
      });
      expect(result.isCompatible).toBe(true);
    });

    it('应该返回不兼容结果', async () => {
      const mockCompatibilityResult = {
        is_compatible: false,
        issues: [
          {
            type: 'missing_channel',
            severity: 'error',
            message: 'Missing channel: Fz',
            suggestion: 'Add channel Fz to your file',
          },
        ],
        warnings: [],
        can_apply_with_fixes: false,
      };

      mockedAxios.post.mockResolvedValue({ data: mockCompatibilityResult });

      const result = await checkModeCompatibility('mode-1', ['Fp1'], 256);

      expect(result.isCompatible).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('recordModeUsage', () => {
    it('应该成功记录使用', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await recordModeUsage('mode-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/use`);
    });

    it('应该处理记录失败', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      // 记录使用失败不应该抛出错误，应该静默处理
      await recordModeUsage('mode-1');

      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('getModeStats', () => {
    it('应该成功获取使用统计', async () => {
      const mockStats = {
        mode_id: 'mode-1',
        mode_name: 'Test Mode',
        total_uses: 100,
        last_used_at: Date.now(),
        first_used_at: Date.now() - 86400000,
        avg_session_duration: 600,
      };

      mockedAxios.get.mockResolvedValue({ data: mockStats });

      const result = await getModeStats('mode-1');

      expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/mode-1/stats`);
      expect(result.totalUses).toBe(100);
    });
  });

  describe('getModeCategories', () => {
    it('应该成功获取所有分类', async () => {
      const mockCategories = ['clinical', 'research', 'education', 'custom'];

      mockedAxios.get.mockResolvedValue({ data: { categories: mockCategories } });

      const result = await getModeCategories();

      expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/api/modes/categories`);
      expect(result).toEqual(mockCategories);
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(getAllModes()).rejects.toThrow('Network error');
    });

    it('应该处理服务器错误', async () => {
      mockedAxios.get.mockRejectedValue({ response: { status: 500 } });

      await expect(getAllModes()).rejects.toThrow();
    });

    it('应该处理超时', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Timeout'));

      await expect(getAllModes()).rejects.toThrow('Timeout');
    });
  });
});
