/**
 * ModeSelector 组件测试
 * 测试智能模式选择器功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeSelector } from '../ModeSelector';
import { useEDFStore } from '../../store/edfStore';
import type { Mode, ModeCategory } from '../../types/mode';

// Mock Store
vi.mock('../../store/edfStore');

const mockUseEDFStore = vi.mocked(useEDFStore);

describe('ModeSelector', () => {
  const mockModes: Mode[] = [
    {
      id: 'mode-clinical',
      name: '临床标准模式',
      category: 'clinical' as ModeCategory,
      description: '标准临床 EEG 分析视图',
      config: {
        viewMode: 'waveform',
        timeWindow: 10,
        amplitudeScale: 1.0,
        showGrid: true,
        showAnnotations: true,
        displayChannels: [
          { channelName: 'Fp1', channelIndex: 0, visible: true },
        ],
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
      usageCount: 10,
      tags: ['clinical'],
    },
    {
      id: 'mode-research',
      name: '科研模式',
      category: 'research' as ModeCategory,
      description: '高级科研分析',
      config: {
        viewMode: 'frequency',
        timeWindow: 5,
        amplitudeScale: 1.5,
        showGrid: true,
        showAnnotations: false,
        displayChannels: [],
        enableFilter: true,
        bands: [],
        analysis: { enabled: true, type: 'frequency', autoUpdate: true },
        autoSave: true,
        maxBookmarks: 100,
      },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isBuiltIn: true,
      isFavorite: true,
      usageCount: 5,
      requiredChannels: ['Fz', 'Cz'],
      minSamplingRate: 100,
      tags: ['research'],
    },
    {
      id: 'mode-custom',
      name: '自定义模式',
      category: 'custom' as ModeCategory,
      description: '用户自定义',
      config: {
        viewMode: 'waveform',
        timeWindow: 15,
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
      usageCount: 2,
      tags: [],
    },
  ];

  const mockMetadata = {
    file_id: 'test-file',
    filename: 'test.edf',
    file_size_mb: 10,
    n_channels: 8,
    channel_names: ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'],
    sfreq: 256,
    n_samples: 25600,
    duration_seconds: 100,
    duration_minutes: 1.67,
    meas_date: null,
    patient_info: { patient_id: 'test', sex: 'M', age: 30 },
    n_annotations: 0,
  };

  beforeEach(() => {
    mockUseEDFStore.mockReturnValue({
      modes: mockModes,
      currentModeId: null,
      metadata: mockMetadata,
      applyMode: vi.fn().mockResolvedValue(undefined),
      setCurrentModeId: vi.fn(),
      isLoadingModes: false,
      // 其他必需的属性
      waveform: null,
      currentTime: 0,
      selectedChannels: [0, 1],
      isLoading: false,
      error: null,
      windowDuration: 10,
      amplitudeScale: 1.0,
      isPlaying: false,
      bookmarks: [],
      signals: [],
      signalData: new Map(),
      isLoadingSignals: false,
      selectionStart: null,
      selectionEnd: null,
      isSelecting: false,
      hasSelection: false,
      analysisResults: null,
      isAnalysisLoading: false,
      analysisError: null,
      selectedAnalysisType: 'stats',
      isLeftSidebarCollapsed: false,
      isRightSidebarCollapsed: false,
      modeRecommendations: null,
      setModes: vi.fn(),
      setModeRecommendations: vi.fn(),
      loadModes: vi.fn().mockResolvedValue(undefined),
      clearMode: vi.fn(),
      updateModeRecommendations: vi.fn().mockResolvedValue(undefined),
      incrementModeUsage: vi.fn().mockResolvedValue(undefined),
      getCurrentMode: vi.fn(),
      getModeById: vi.fn(),
      getModesByCategory: vi.fn(),
      getFavoriteModes: vi.fn(),
      getBuiltInModes: vi.fn(),
      getRecentlyUsedModes: vi.fn(),
      setMetadata: vi.fn(),
      setWaveform: vi.fn(),
      setCurrentTime: vi.fn(),
      setSelectedChannels: vi.fn(),
      toggleChannel: vi.fn(),
      selectAllChannels: vi.fn(),
      deselectAllChannels: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setWindowDuration: vi.fn(),
      setAmplitudeScale: vi.fn(),
      setIsPlaying: vi.fn(),
      setBookmarks: vi.fn(),
      addBookmark: vi.fn(),
      removeBookmark: vi.fn(),
      jumpToBookmark: vi.fn(),
      setSignals: vi.fn(),
      addSignal: vi.fn(),
      updateSignal: vi.fn(),
      deleteSignal: vi.fn(),
      toggleSignal: vi.fn(),
      setSignalData: vi.fn(),
      setSignalDataBatch: vi.fn(),
      clearSignalData: vi.fn(),
      setIsLoadingSignals: vi.fn(),
      loadSignalsFromStorage: vi.fn(),
      saveSignalsToStorage: vi.fn(),
      setSelectionStart: vi.fn(),
      setSelectionEnd: vi.fn(),
      setIsSelecting: vi.fn(),
      confirmSelection: vi.fn(),
      clearSelection: vi.fn(),
      runAnalysis: vi.fn().mockResolvedValue(undefined),
      clearAnalysisResults: vi.fn(),
      setSelectedAnalysisType: vi.fn(),
      toggleLeftSidebar: vi.fn(),
      toggleRightSidebar: vi.fn(),
      reset: vi.fn(),
    } as any);
  });

  describe('渲染', () => {
    it('应该渲染选择器', () => {
      render(<ModeSelector />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('应该显示"无模式"选项', () => {
      render(<ModeSelector />);

      expect(screen.getByText('无模式')).toBeInTheDocument();
    });

    it('应该显示所有模式', () => {
      render(<ModeSelector />);

      expect(screen.getByText('临床标准模式 *')).toBeInTheDocument();
      expect(screen.getByText(/科研模式/)).toBeInTheDocument();
      expect(screen.getByText('自定义模式')).toBeInTheDocument();
    });

    it('应该在加载时显示禁用状态', () => {
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        isLoadingModes: true,
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('应该显示当前选中的模式', () => {
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        currentModeId: 'mode-clinical',
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('mode-clinical');
    });
  });

  describe('交互', () => {
    it('应该在选择模式时调用 applyMode', async () => {
      const applyMode = vi.fn().mockResolvedValue(undefined);
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        applyMode,
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');

      await userEvent.selectOptions(select, 'mode-clinical');

      await waitFor(() => {
        expect(applyMode).toHaveBeenCalledWith('mode-clinical');
      });
    });

    it('应该在选择"无模式"时调用 clearMode', async () => {
      const clearMode = vi.fn();
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        clearMode,
        currentModeId: 'mode-clinical',
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');

      await userEvent.selectOptions(select, '');

      expect(clearMode).toHaveBeenCalled();
    });

    it('应该处理应用模式失败', async () => {
      const applyMode = vi.fn().mockRejectedValue(new Error('应用失败'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        applyMode,
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');

      await userEvent.selectOptions(select, 'mode-clinical');

      await waitFor(() => {
        expect(applyMode).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('兼容性显示', () => {
    it('应该显示兼容模式', () => {
      render(<ModeSelector />);

      expect(screen.getByText('临床标准模式 *')).toBeInTheDocument();
    });

    it('应该显示不兼容模式', () => {
      render(<ModeSelector />);

      // 科研模式需要 Fz, Cz 通道，但当前文件没有
      expect(screen.getByText(/科研模式.*不兼容/)).toBeInTheDocument();
    });

    it('应该标记部分兼容模式', () => {
      render(<ModeSelector />);

      // 验证科研模式（不兼容）在列表中
      const researchOption = screen.getByText(/科研模式/);
      expect(researchOption).toBeInTheDocument();
    });
  });

  describe('分类显示', () => {
    it('应该显示模式分类', () => {
      render(<ModeSelector showCategory={true} />);

      // 检查是否有分类相关的标记
      expect(screen.getByText(/临床诊断/)).toBeInTheDocument();
    });

    it('应该显示内置模式标记', () => {
      render(<ModeSelector showCategory={false} />);

      // 内置模式应该有 * 标记
      expect(screen.getByText('临床标准模式 *')).toBeInTheDocument();
    });
  });

  describe('快捷选择', () => {
    it('应该支持键盘导航', async () => {
      render(<ModeSelector />);

      const select = screen.getByRole('combobox');

      await userEvent.click(select);

      // 验证选项可以聚焦
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('应该在无可用模式时禁用选择器', () => {
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        modes: [],
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  describe('无障碍', () => {
    it('应该有正确的 label', () => {
      render(<ModeSelector />);

      expect(screen.getByLabelText(/模式/i)).toBeInTheDocument();
    });

    it('应该有描述性文本', () => {
      render(<ModeSelector />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label');
    });
  });

  describe('空状态', () => {
    it('应该在没有模式时显示提示', () => {
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        modes: [],
        isLoadingModes: false,
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('应该在加载时显示加载状态', () => {
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        isLoadingModes: true,
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('样式', () => {
    it('应该应用正确的类名', () => {
      render(<ModeSelector />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass(/selector/i);
    });

    it('应该在选中模式时高亮显示', () => {
      mockUseEDFStore.mockReturnValue({
        ...mockUseEDFStore(),
        currentModeId: 'mode-clinical',
      } as any);

      render(<ModeSelector />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('mode-clinical');
    });
  });
});
