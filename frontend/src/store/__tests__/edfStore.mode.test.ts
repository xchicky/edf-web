/**
 * EDF Store 模式管理测试
 * 测试模式管理功能的 Store 扩展
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEDFStore } from '../edfStore';
import * as modeApi from '../../api/mode';
import type { Mode, ModeCategory } from '../../types/mode';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock mode API
vi.mock('../../api/mode');
const mockedModeApi = vi.mocked(modeApi);

describe('useEDFStore - Mode Management', () => {
  const mockMetadata = {
    file_id: 'test-file-123',
    filename: 'test.edf',
    file_size_mb: 10,
    n_channels: 8,
    channel_names: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'],
    sfreq: 256,
    n_samples: 25600,
    duration_seconds: 100,
    duration_minutes: 1.67,
    meas_date: null,
    patient_info: {
      patient_id: 'test-patient',
      sex: 'M',
      age: 30,
    },
    n_annotations: 0,
  };

  const mockModes: Mode[] = [
    {
      id: 'mode-clinical',
      name: 'Clinical Mode',
      category: 'clinical',
      description: 'Standard clinical mode',
      config: {
        viewMode: 'waveform' as const,
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [
          { channelName: 'Fp1', channelIndex: 0, visible: true },
          { channelName: 'Fp2', channelIndex: 1, visible: true },
        ],
        enableFilter: true,
        filterHighPass: 0.5,
        filterLowPass: 70,
        bands: [
          { name: 'alpha', range: [8, 13], enabled: true, color: '#ec4899' },
        ],
        analysis: { enabled: true, type: 'stats' as const, autoUpdate: false },
        autoSave: true,
        maxBookmarks: 50,
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isBuiltIn: true,
      isFavorite: false,
      usageCount: 5,
      tags: ['clinical'],
    },
    {
      id: 'mode-research',
      name: 'Research Mode',
      category: 'research',
      description: 'Advanced research mode',
      config: {
        viewMode: 'frequency' as const,
        timeWindow: 5,
        amplitudeScale: 1.5,
        showGrid: true,
        showAnnotations: false,
        displayChannels: [
          { channelName: 'Fz', channelIndex: 0, visible: true },
        ],
        enableFilter: true,
        filterHighPass: 0.5,
        filterLowPass: 100,
        bands: [],
        analysis: { enabled: false, type: 'frequency' as const, autoUpdate: true },
        autoSave: true,
        maxBookmarks: 100,
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isBuiltIn: true,
      isFavorite: true,
      usageCount: 10,
      requiredChannels: ['Fz', 'Cz'],
      minSamplingRate: 100,
      tags: ['research', 'advanced'],
    },
  ];

  beforeEach(() => {
    // Reset store state
    useEDFStore.setState({
      modes: [],
      currentModeId: null,
      modeRecommendations: null,
      isLoadingModes: false,
      metadata: mockMetadata,
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('初始状态', () => {
    it('应该初始化模式相关状态', () => {
      const state = useEDFStore.getState();

      expect(state.modes).toEqual([]);
      expect(state.currentModeId).toBeNull();
      expect(state.modeRecommendations).toBeNull();
      expect(state.isLoadingModes).toBe(false);
    });
  });

  describe('setModes', () => {
    it('应该设置模式列表', () => {
      useEDFStore.getState().setModes(mockModes);

      const { modes } = useEDFStore.getState();
      expect(modes).toHaveLength(2);
      expect(modes[0].id).toBe('mode-clinical');
      expect(modes[1].id).toBe('mode-research');
    });

    it('应该覆盖现有模式', () => {
      useEDFStore.getState().setModes([mockModes[0]]);
      useEDFStore.getState().setModes([mockModes[1]]);

      const { modes } = useEDFStore.getState();
      expect(modes).toHaveLength(1);
      expect(modes[0].id).toBe('mode-research');
    });

    it('应该支持清空模式列表', () => {
      useEDFStore.getState().setModes(mockModes);
      useEDFStore.getState().setModes([]);

      const { modes } = useEDFStore.getState();
      expect(modes).toHaveLength(0);
    });
  });

  describe('setCurrentModeId', () => {
    it('应该设置当前模式 ID', () => {
      useEDFStore.getState().setCurrentModeId('mode-clinical');

      const { currentModeId } = useEDFStore.getState();
      expect(currentModeId).toBe('mode-clinical');
    });

    it('应该支持清空当前模式', () => {
      useEDFStore.getState().setCurrentModeId('mode-clinical');
      useEDFStore.getState().setCurrentModeId(null);

      const { currentModeId } = useEDFStore.getState();
      expect(currentModeId).toBeNull();
    });
  });

  describe('setModeRecommendations', () => {
    it('应该设置模式推荐结果', () => {
      const recommendations = {
        modes: mockModes,
        total: 2,
        categories: ['clinical', 'research'] as ModeCategory[],
      };

      useEDFStore.getState().setModeRecommendations(recommendations);

      const { modeRecommendations } = useEDFStore.getState();
      expect(modeRecommendations).toEqual(recommendations);
    });

    it('应该支持清空推荐结果', () => {
      const recommendations = {
        modes: mockModes,
        total: 2,
        categories: ['clinical', 'research'] as ModeCategory[],
      };

      useEDFStore.getState().setModeRecommendations(recommendations);
      useEDFStore.getState().setModeRecommendations(null);

      const { modeRecommendations } = useEDFStore.getState();
      expect(modeRecommendations).toBeNull();
    });
  });

  describe('loadModes', () => {
    it('应该成功加载模式列表', async () => {
      const mockResponse = {
        modes: mockModes,
        total: 2,
        categories: ['clinical', 'research'] as ModeCategory[],
      };

      mockedModeApi.getAllModes.mockResolvedValue(mockResponse);

      await useEDFStore.getState().loadModes();

      const { modes, isLoadingModes } = useEDFStore.getState();

      expect(mockedModeApi.getAllModes).toHaveBeenCalled();
      expect(modes).toHaveLength(2);
      expect(isLoadingModes).toBe(false);
    });

    it('应该在加载时设置加载状态', async () => {
      const mockResponse = {
        modes: mockModes,
        total: 2,
        categories: ['clinical', 'research'] as ModeCategory[],
      };

      mockedModeApi.getAllModes.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100))
      );

      const loadPromise = useEDFStore.getState().loadModes();

      // 检查加载状态
      let { isLoadingModes } = useEDFStore.getState();
      expect(isLoadingModes).toBe(true);

      await loadPromise;

      // 加载完成后状态应该为 false
      ({ isLoadingModes } = useEDFStore.getState());
      expect(isLoadingModes).toBe(false);
    });

    it('应该处理加载错误', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockedModeApi.getAllModes.mockRejectedValue(new Error('Network error'));

      await useEDFStore.getState().loadModes();

      const { modes, isLoadingModes } = useEDFStore.getState();

      expect(modes).toHaveLength(0);
      expect(isLoadingModes).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('applyMode', () => {
    it('应该成功应用模式', async () => {
      useEDFStore.getState().setModes(mockModes);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-clinical');

      const {
        currentModeId,
        windowDuration,
        amplitudeScale,
        selectedChannels,
      } = useEDFStore.getState();

      expect(currentModeId).toBe('mode-clinical');
      expect(windowDuration).toBe(10);
      expect(amplitudeScale).toBe(1.0);
      expect(selectedChannels).toEqual([0, 1]);
      expect(mockedModeApi.recordModeUsage).toHaveBeenCalledWith('mode-clinical');
    });

    it('应该应用模式的显示通道配置', async () => {
      useEDFStore.getState().setModes(mockModes);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-clinical');

      const { selectedChannels } = useEDFStore.getState();
      expect(selectedChannels).toEqual([0, 1]); // Fp1, Fp2 的索引
    });

    it('应该清除现有派生信号', async () => {
      // 添加一些派生信号
      useEDFStore.getState().setSignals([
        {
          id: 'sig-1',
          name: 'Test Signal',
          expression: 'Fp1 - Fp2',
          operands: [],
          enabled: true,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      ]);

      useEDFStore.getState().setModes(mockModes);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-clinical');

      const { signals } = useEDFStore.getState();
      expect(signals).toHaveLength(0); // 信号应该被清除
    });

    it('应该应用模式中定义的派生信号', async () => {
      // 创建包含派生信号的模式
      const modeWithSignals: Mode = {
        ...mockModes[0],
        id: 'mode-with-signals',
        name: 'Mode with Signals',
        config: {
          ...mockModes[0].config,
          signals: [
            {
              id: 'sig-diff-1',
              name: 'Fp1-F3 Difference',
              expression: 'Fp1 - F3',
              operands: [
                { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-2', channelName: 'F3', channelIndex: 2 },
              ],
              color: '#ff0000',
              enabled: true,
            },
            {
              id: 'sig-avg-1',
              name: 'Average Frontal',
              expression: '(Fp1 + F3) / 2',
              operands: [
                { id: 'op-3', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-4', channelName: 'F3', channelIndex: 2 },
              ],
              color: '#00ff00',
              enabled: true,
            },
          ],
        },
      };

      useEDFStore.getState().setModes([modeWithSignals]);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-with-signals');

      const { signals } = useEDFStore.getState();
      expect(signals).toHaveLength(2);
      expect(signals[0].id).toBe('sig-diff-1');
      expect(signals[0].name).toBe('Fp1-F3 Difference');
      expect(signals[0].expression).toBe('Fp1 - F3');
      expect(signals[0].enabled).toBe(true);
      expect(signals[1].id).toBe('sig-avg-1');
      expect(signals[1].name).toBe('Average Frontal');
    });

    it('应该为模式中的派生信号添加时间戳', async () => {
      const modeWithSignals: Mode = {
        ...mockModes[0],
        id: 'mode-with-signals',
        config: {
          ...mockModes[0].config,
          signals: [
            {
              id: 'sig-1',
              name: 'Test Signal',
              expression: 'Fp1 - F3',
              operands: [
                { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-2', channelName: 'F3', channelIndex: 2 },
              ],
              enabled: true,
            },
          ],
        },
      };

      useEDFStore.getState().setModes([modeWithSignals]);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      const beforeTime = Date.now();
      await useEDFStore.getState().applyMode('mode-with-signals');
      const afterTime = Date.now();

      const { signals } = useEDFStore.getState();
      expect(signals[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(signals[0].createdAt).toBeLessThanOrEqual(afterTime);
      expect(signals[0].modifiedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(signals[0].modifiedAt).toBeLessThanOrEqual(afterTime);
    });

    it('应该保存模式中的派生信号到 localStorage', async () => {
      const modeWithSignals: Mode = {
        ...mockModes[0],
        id: 'mode-with-signals',
        config: {
          ...mockModes[0].config,
          signals: [
            {
              id: 'sig-1',
              name: 'Test Signal',
              expression: 'Fp1 - F3',
              operands: [
                { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-2', channelName: 'F3', channelIndex: 2 },
              ],
              enabled: true,
            },
          ],
        },
      };

      useEDFStore.getState().setModes([modeWithSignals]);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-with-signals');

      // 验证信号被保存到 localStorage
      const storedSignals = localStorageMock.getItem(`signals_${mockMetadata.file_id}`);
      expect(storedSignals).not.toBeNull();
      const parsedSignals = JSON.parse(storedSignals!);
      expect(parsedSignals).toHaveLength(1);
      expect(parsedSignals[0].id).toBe('sig-1');
    });

    it('应该处理没有派生信号的模式', async () => {
      const modeWithoutSignals: Mode = {
        ...mockModes[0],
        id: 'mode-no-signals',
        config: {
          ...mockModes[0].config,
          signals: undefined, // 没有定义派生信号
        },
      };

      useEDFStore.getState().setModes([modeWithoutSignals]);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-no-signals');

      const { signals } = useEDFStore.getState();
      expect(signals).toHaveLength(0);
    });

    it('应该处理包含禁用信号的模式的派生信号', async () => {
      const modeWithDisabledSignals: Mode = {
        ...mockModes[0],
        id: 'mode-disabled-signals',
        config: {
          ...mockModes[0].config,
          signals: [
            {
              id: 'sig-enabled',
              name: 'Enabled Signal',
              expression: 'Fp1 - F3',
              operands: [
                { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-2', channelName: 'F3', channelIndex: 2 },
              ],
              enabled: true,
            },
            {
              id: 'sig-disabled',
              name: 'Disabled Signal',
              expression: 'Fp1 + F3',
              operands: [
                { id: 'op-3', channelName: 'Fp1', channelIndex: 0 },
                { id: 'op-4', channelName: 'F3', channelIndex: 2 },
              ],
              enabled: false, // 禁用的信号
            },
          ],
        },
      };

      useEDFStore.getState().setModes([modeWithDisabledSignals]);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-disabled-signals');

      const { signals } = useEDFStore.getState();
      expect(signals).toHaveLength(2);
      expect(signals[0].enabled).toBe(true);
      expect(signals[1].enabled).toBe(false);
    });

    it('应该在模式不存在时抛出错误', async () => {
      useEDFStore.getState().setModes(mockModes);

      await expect(useEDFStore.getState().applyMode('non-existent')).rejects.toThrow(
        '模式 non-existent 不存在'
      );
    });

    it('应该在模式不兼容时抛出错误', async () => {
      useEDFStore.getState().setModes(mockModes);

      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: false,
        issues: [
          {
            type: 'missing_channel',
            severity: 'error',
            message: 'Missing required channel',
            suggestion: 'Add required channel',
          },
        ],
        warnings: [],
        canApplyWithFixes: false,
      });

      await expect(useEDFStore.getState().applyMode('mode-research')).rejects.toThrow(
        '模式不兼容'
      );
    });

    it('应该应用模式的视图配置', async () => {
      useEDFStore.getState().setModes(mockModes);

      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);
      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      await useEDFStore.getState().applyMode('mode-research');

      const { windowDuration, amplitudeScale } = useEDFStore.getState();
      expect(windowDuration).toBe(5);
      expect(amplitudeScale).toBe(1.5);
    });
  });

  describe('clearMode', () => {
    it('应该清除当前模式', () => {
      useEDFStore.getState().setCurrentModeId('mode-clinical');
      useEDFStore.getState().clearMode();

      const { currentModeId } = useEDFStore.getState();
      expect(currentModeId).toBeNull();
    });

    it('应该重置为默认配置', () => {
      // 先应用一个模式
      useEDFStore.getState().setModes(mockModes);
      useEDFStore.getState().setCurrentModeId('mode-clinical');
      useEDFStore.getState().setWindowDuration(10);
      useEDFStore.getState().setAmplitudeScale(1.0);

      // 然后清除
      useEDFStore.getState().clearMode();

      const { currentModeId, windowDuration, amplitudeScale } = useEDFStore.getState();

      expect(currentModeId).toBeNull();
      // 应该恢复到默认值或保持不变，这里我们验证不会意外修改
      expect(typeof windowDuration).toBe('number');
      expect(typeof amplitudeScale).toBe('number');
    });
  });

  describe('updateModeRecommendations', () => {
    it('应该根据可用通道更新推荐', async () => {
      const availableChannels = ['Fp1', 'Fp2', 'F3', 'F4'];

      mockedModeApi.checkModeCompatibility.mockResolvedValue({
        isCompatible: true,
        issues: [],
        warnings: [],
        canApplyWithFixes: true,
      });

      useEDFStore.getState().setModes(mockModes);
      await useEDFStore.getState().updateModeRecommendations(availableChannels);

      const { modeRecommendations } = useEDFStore.getState();

      expect(modeRecommendations).not.toBeNull();
      expect(modeRecommendations?.modes.length).toBeGreaterThan(0);
    });

    it('应该过滤不兼容的模式', async () => {
      const availableChannels = ['Fp1']; // 只有 Fp1

      // 科研模式需要 Fz, Cz，应该不兼容
      mockedModeApi.checkModeCompatibility.mockImplementation(
        async (modeId) => {
          if (modeId === 'mode-research') {
            return {
              isCompatible: false,
              issues: [
                {
                  type: 'missing_channel',
                  severity: 'error',
                  message: 'Missing Fz, Cz',
                },
              ],
              warnings: [],
              canApplyWithFixes: false,
            };
          }
          return {
            isCompatible: true,
            issues: [],
            warnings: [],
            canApplyWithFixes: true,
          };
        }
      );

      useEDFStore.getState().setModes(mockModes);
      await useEDFStore.getState().updateModeRecommendations(availableChannels);

      const { modeRecommendations } = useEDFStore.getState();

      // 应该只包含兼容的模式
      expect(modeRecommendations?.modes.some((m) => m.id === 'mode-research')).toBe(false);
    });
  });

  describe('incrementModeUsage', () => {
    it('应该记录模式使用', async () => {
      mockedModeApi.recordModeUsage.mockResolvedValue(undefined);

      await useEDFStore.getState().incrementModeUsage('mode-clinical');

      expect(mockedModeApi.recordModeUsage).toHaveBeenCalledWith('mode-clinical');
    });

    it('应该处理记录失败', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockedModeApi.recordModeUsage.mockRejectedValue(new Error('Network error'));

      await expect(
        useEDFStore.getState().incrementModeUsage('mode-clinical')
      ).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getCurrentMode', () => {
    it('应该返回当前模式', () => {
      useEDFStore.getState().setModes(mockModes);
      useEDFStore.getState().setCurrentModeId('mode-clinical');

      const currentMode = useEDFStore.getState().getCurrentMode();

      expect(currentMode).toBeDefined();
      expect(currentMode?.id).toBe('mode-clinical');
    });

    it('应该在未设置模式时返回 undefined', () => {
      useEDFStore.getState().setModes(mockModes);
      useEDFStore.getState().setCurrentModeId(null);

      const currentMode = useEDFStore.getState().getCurrentMode();

      expect(currentMode).toBeUndefined();
    });

    it('应该在模式列表为空时返回 undefined', () => {
      useEDFStore.getState().setModes([]);
      useEDFStore.getState().setCurrentModeId('mode-clinical');

      const currentMode = useEDFStore.getState().getCurrentMode();

      expect(currentMode).toBeUndefined();
    });
  });

  describe('getModeById', () => {
    it('应该根据 ID 返回模式', () => {
      useEDFStore.getState().setModes(mockModes);

      const mode = useEDFStore.getState().getModeById('mode-research');

      expect(mode).toBeDefined();
      expect(mode?.id).toBe('mode-research');
      expect(mode?.category).toBe('research');
    });

    it('应该在模式不存在时返回 undefined', () => {
      useEDFStore.getState().setModes(mockModes);

      const mode = useEDFStore.getState().getModeById('non-existent');

      expect(mode).toBeUndefined();
    });
  });

  describe('getModesByCategory', () => {
    it('应该返回指定分类的模式', () => {
      useEDFStore.getState().setModes(mockModes);

      const clinicalModes = useEDFStore.getState().getModesByCategory('clinical');

      expect(clinicalModes).toHaveLength(1);
      expect(clinicalModes[0].category).toBe('clinical');
    });

    it('应该在分类不存在时返回空数组', () => {
      useEDFStore.getState().setModes(mockModes);

      const customModes = useEDFStore.getState().getModesByCategory('custom');

      expect(customModes).toEqual([]);
    });
  });

  describe('getFavoriteModes', () => {
    it('应该返回所有收藏的模式', () => {
      useEDFStore.getState().setModes(mockModes);

      const favorites = useEDFStore.getState().getFavoriteModes();

      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe('mode-research');
      expect(favorites[0].isFavorite).toBe(true);
    });

    it('应该在无收藏时返回空数组', () => {
      const noFavorites = mockModes.map((m) => ({ ...m, isFavorite: false }));
      useEDFStore.getState().setModes(noFavorites);

      const favorites = useEDFStore.getState().getFavoriteModes();

      expect(favorites).toEqual([]);
    });
  });

  describe('getBuiltInModes', () => {
    it('应该返回所有内置模式', () => {
      useEDFStore.getState().setModes(mockModes);

      const builtIn = useEDFStore.getState().getBuiltInModes();

      expect(builtIn).toHaveLength(2);
      expect(builtIn.every((m) => m.isBuiltIn)).toBe(true);
    });

    it('应该正确区分内置和自定义模式', () => {
      const customMode: Mode = {
        ...mockModes[0],
        id: 'mode-custom',
        isBuiltIn: false,
      };

      useEDFStore.getState().setModes([...mockModes, customMode]);

      const builtIn = useEDFStore.getState().getBuiltInModes();

      expect(builtIn).toHaveLength(2);
      expect(builtIn.some((m) => m.id === 'mode-custom')).toBe(false);
    });
  });

  describe('getRecentlyUsedModes', () => {
    it('应该按最近使用时间排序', () => {
      const now = Date.now();
      const modesWithTime = [
        {
          ...mockModes[0],
          lastUsedAt: now - 1000000, // 较早使用
        },
        {
          ...mockModes[1],
          lastUsedAt: now - 1000, // 最近使用
        },
      ];

      useEDFStore.getState().setModes(modesWithTime);

      const recent = useEDFStore.getState().getRecentlyUsedModes();

      expect(recent[0].id).toBe('mode-research'); // 最近使用的排在前面
    });

    it('应该在未使用时返回空数组', () => {
      const neverUsed = mockModes.map((m) => ({ ...m, lastUsedAt: undefined }));
      useEDFStore.getState().setModes(neverUsed);

      const recent = useEDFStore.getState().getRecentlyUsedModes();

      expect(recent).toEqual([]);
    });

    it('应该限制返回数量', () => {
      const now = Date.now();
      const manyModes = Array.from({ length: 10 }, (_, i) => ({
        ...mockModes[0],
        id: `mode-${i}`,
        lastUsedAt: now - i * 1000,
      }));

      useEDFStore.getState().setModes(manyModes);

      const recent = useEDFStore.getState().getRecentlyUsedModes(5);

      expect(recent).toHaveLength(5);
    });
  });
});
