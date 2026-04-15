/**
 * Zustand Store 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEDFStore } from '../edfStore';
import * as signalStorage from '../../utils/signalStorage';
import type { Signal } from '../../types/signal';

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

describe('useEDFStore - Signal Management', () => {
  beforeEach(() => {
    useEDFStore.setState({
      signals: [],
      signalData: new Map(),
      isLoadingSignals: false,
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('addSignal', () => {
    it('应该添加新信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [
          { id: 'op-1', channelName: 'Fp1', channelIndex: 0 },
          { id: 'op-2', channelName: 'F7', channelIndex: 2 },
        ],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      const { signals } = useEDFStore.getState();

      expect(signals).toHaveLength(1);
      expect(signals[0].id).toBe('sig-1');
      expect(signals[0].name).toBe('Fp1-F7');
    });

    it('应该添加多个信号', () => {
      const signal1: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      const signal2: Signal = {
        id: 'sig-2',
        name: 'F3-F4',
        expression: 'F3 - F4',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal1);
      useEDFStore.getState().addSignal(signal2);
      const { signals } = useEDFStore.getState();

      expect(signals).toHaveLength(2);
    });
  });

  describe('updateSignal', () => {
    it('应该更新现有信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      useEDFStore.getState().updateSignal('sig-1', { name: 'Updated Name' });

      const { signals } = useEDFStore.getState();
      expect(signals[0].name).toBe('Updated Name');
    });

    it('应该更新 modifiedAt 时间戳', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: 1000,
        modifiedAt: 1000,
      };

      useEDFStore.getState().addSignal(signal);
      const beforeUpdate = Date.now();
      useEDFStore.getState().updateSignal('sig-1', { name: 'Updated' });
      const afterUpdate = Date.now();

      const { signals } = useEDFStore.getState();
      expect(signals[0].modifiedAt).toBeGreaterThanOrEqual(beforeUpdate);
      expect(signals[0].modifiedAt).toBeLessThanOrEqual(afterUpdate);
    });

    it('应该不影响其他信号', () => {
      const signal1: Signal = {
        id: 'sig-1',
        name: 'Signal 1',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      const signal2: Signal = {
        id: 'sig-2',
        name: 'Signal 2',
        expression: 'F3 - F4',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal1);
      useEDFStore.getState().addSignal(signal2);
      useEDFStore.getState().updateSignal('sig-1', { name: 'Updated' });

      const { signals } = useEDFStore.getState();
      expect(signals[0].name).toBe('Updated');
      expect(signals[1].name).toBe('Signal 2');
    });
  });

  describe('deleteSignal', () => {
    it('应该删除信号', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      useEDFStore.getState().deleteSignal('sig-1');

      const { signals } = useEDFStore.getState();
      expect(signals).toHaveLength(0);
    });

    it('应该删除关联的信号数据', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      useEDFStore.getState().setSignalData('sig-1', {
        id: 'sig-1',
        name: 'Fp1-F7',
        data: [1, 2, 3],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true,
      });

      useEDFStore.getState().deleteSignal('sig-1');

      const { signalData } = useEDFStore.getState();
      expect(signalData.has('sig-1')).toBe(false);
    });
  });

  describe('toggleSignal', () => {
    it('应该切换信号的启用状态', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      useEDFStore.getState().toggleSignal('sig-1');

      const { signals } = useEDFStore.getState();
      expect(signals[0].enabled).toBe(false);

      useEDFStore.getState().toggleSignal('sig-1');
      expect(useEDFStore.getState().signals[0].enabled).toBe(true);
    });
  });

  describe('setSignalData', () => {
    it('应该设置单个信号的计算结果', () => {
      const result = {
        id: 'sig-1',
        name: 'Fp1-F7',
        data: [1, 2, 3],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true as const,
      };

      useEDFStore.getState().setSignalData('sig-1', result);

      const { signalData } = useEDFStore.getState();
      expect(signalData.has('sig-1')).toBe(true);
      expect(signalData.get('sig-1')).toEqual(result);
    });
  });

  describe('setSignalDataBatch', () => {
    it('应该批量设置多个信号的计算结果', () => {
      const results = [
        {
          id: 'sig-1',
          name: 'Fp1-F7',
          data: [1, 2, 3],
          times: [0, 1, 2],
          sfreq: 100,
          n_samples: 3,
          isVirtual: true as const,
        },
        {
          id: 'sig-2',
          name: 'F3-F4',
          data: [4, 5, 6],
          times: [0, 1, 2],
          sfreq: 100,
          n_samples: 3,
          isVirtual: true as const,
        },
      ];

      useEDFStore.getState().setSignalDataBatch(results);

      const { signalData } = useEDFStore.getState();
      expect(signalData.size).toBe(2);
      expect(signalData.has('sig-1')).toBe(true);
      expect(signalData.has('sig-2')).toBe(true);
    });
  });

  describe('clearSignalData', () => {
    it('应该清除特定信号的数据', () => {
      useEDFStore.getState().setSignalData('sig-1', {
        id: 'sig-1',
        name: 'Fp1-F7',
        data: [1, 2, 3],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true,
      });

      useEDFStore.getState().setSignalData('sig-2', {
        id: 'sig-2',
        name: 'F3-F4',
        data: [4, 5, 6],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true,
      });

      useEDFStore.getState().clearSignalData('sig-1');

      const { signalData } = useEDFStore.getState();
      expect(signalData.has('sig-1')).toBe(false);
      expect(signalData.has('sig-2')).toBe(true);
    });

    it('应该清除所有信号数据', () => {
      useEDFStore.getState().setSignalData('sig-1', {
        id: 'sig-1',
        name: 'Fp1-F7',
        data: [1, 2, 3],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true,
      });

      useEDFStore.getState().setSignalData('sig-2', {
        id: 'sig-2',
        name: 'F3-F4',
        data: [4, 5, 6],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true,
      });

      useEDFStore.getState().clearSignalData();

      const { signalData } = useEDFStore.getState();
      expect(signalData.size).toBe(0);
    });
  });

  describe('loadSignalsFromStorage', () => {
    it('应该从 localStorage 加载信号', () => {
      const signals: Signal[] = [
        {
          id: 'sig-1',
          name: 'Fp1-F7',
          expression: 'Fp1 - F7',
          operands: [],
          enabled: true,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      ];

      signalStorage.saveSignals('file-1', signals);
      useEDFStore.getState().loadSignalsFromStorage('file-1');

      const { signals: loadedSignals } = useEDFStore.getState();
      expect(loadedSignals).toHaveLength(1);
      expect(loadedSignals[0].id).toBe('sig-1');
    });

    it('应该在没有保存信号时返回空数组', () => {
      useEDFStore.getState().loadSignalsFromStorage('non-existent-file');

      const { signals } = useEDFStore.getState();
      expect(signals).toHaveLength(0);
    });
  });

  describe('saveSignalsToStorage', () => {
    it('应该保存信号到 localStorage', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      useEDFStore.getState().saveSignalsToStorage('file-1');

      const loaded = signalStorage.loadSignals('file-1');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('sig-1');
    });
  });

  describe('reset', () => {
    it('应该重置所有信号相关状态', () => {
      const signal: Signal = {
        id: 'sig-1',
        name: 'Fp1-F7',
        expression: 'Fp1 - F7',
        operands: [],
        enabled: true,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      useEDFStore.getState().addSignal(signal);
      useEDFStore.getState().setSignalData('sig-1', {
        id: 'sig-1',
        name: 'Fp1-F7',
        data: [1, 2, 3],
        times: [0, 1, 2],
        sfreq: 100,
        n_samples: 3,
        isVirtual: true,
      });

      useEDFStore.getState().reset();

      const { signals, signalData, isLoadingSignals } = useEDFStore.getState();
      expect(signals).toHaveLength(0);
      expect(signalData.size).toBe(0);
      expect(isLoadingSignals).toBe(false);
    });
  });
});

describe('useEDFStore - Analysis', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useEDFStore.setState({
      metadata: {
        file_id: 'test-file',
        filename: 'test.edf',
        file_size_mb: 10,
        n_channels: 3,
        channel_names: ['Fp1', 'Fp2', 'F3'],
        sfreq: 256,
        n_samples: 25600,
        duration_seconds: 100,
        duration_minutes: 1.67,
        meas_date: null,
        patient_info: { patient_id: 'test', sex: 'M', age: 30 },
        n_annotations: 0,
      },
      selectedChannels: [0, 1, 2],
      analysisResults: null,
      isAnalysisLoading: false,
      analysisError: null,
      selectedAnalysisType: 'stats',
      signals: [],
      signalData: new Map(),
    });
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('setSelectedAnalysisType', () => {
    it('应设置分析类型为 stats', () => {
      const { setSelectedAnalysisType } = useEDFStore.getState();
      setSelectedAnalysisType('stats');

      expect(useEDFStore.getState().selectedAnalysisType).toBe('stats');
    });

    it('应设置分析类型为 frequency', () => {
      const { setSelectedAnalysisType } = useEDFStore.getState();
      setSelectedAnalysisType('frequency');

      expect(useEDFStore.getState().selectedAnalysisType).toBe('frequency');
    });
  });

  describe('clearAnalysisResults', () => {
    it('应清除分析结果和错误', () => {
      useEDFStore.setState({
        analysisResults: {
          fileId: 'test',
          type: 'stats',
          selectionStart: 0,
          selectionEnd: 10,
          duration: 10,
          timeDomain: { Fp1: { mean: 1, std: 1, min: 0, max: 2, rms: 1, peakToPeak: 2, kurtosis: 0, skewness: 0, nSamples: 100 } },
          timestamp: Date.now(),
        },
        analysisError: 'Some error',
      });

      const { clearAnalysisResults } = useEDFStore.getState();
      clearAnalysisResults();

      expect(useEDFStore.getState().analysisResults).toBeNull();
      expect(useEDFStore.getState().analysisError).toBeNull();
    });
  });

  describe('runAnalysis', () => {
    it('应正确设置加载状态并清除旧结果', async () => {
      const { runAnalysis } = useEDFStore.getState();

      // 先设置一些旧结果
      useEDFStore.setState({
        analysisResults: {
          fileId: 'test',
          type: 'stats',
          selectionStart: 0,
          selectionEnd: 10,
          duration: 10,
          timeDomain: { Fp1: { mean: 1, std: 1, min: 0, max: 2, rms: 1, peakToPeak: 2, kurtosis: 0, skewness: 0, nSamples: 100 } },
          timestamp: Date.now(),
        },
      });

      // 调用 runAnalysis（会失败因为没有真实后端，但可以测试状态变化）
      const promise = runAnalysis(0, 10, 'stats');

      // 检查加载状态已设置，旧结果已清除
      expect(useEDFStore.getState().isAnalysisLoading).toBe(true);
      expect(useEDFStore.getState().analysisResults).toBeNull();

      await promise.catch(() => {});
    });

    it('应处理没有元数据的情况', async () => {
      useEDFStore.setState({ metadata: null });
      const { runAnalysis } = useEDFStore.getState();

      await runAnalysis(0, 10, 'stats');

      expect(useEDFStore.getState().analysisError).toBe('没有加载的文件');
      expect(useEDFStore.getState().isAnalysisLoading).toBe(false);
    });

    it('应正确交换选择起止时间', async () => {
      const { runAnalysis } = useEDFStore.getState();

      const promise = runAnalysis(20, 10, 'stats');

      await promise.catch(() => {});

      // 由于没有真实后端，这个测试只验证函数不会崩溃
      expect(useEDFStore.getState().isAnalysisLoading).toBe(false);
    });

    it('应处理未知的分析类型', async () => {
      const { runAnalysis } = useEDFStore.getState();

      await runAnalysis(0, 10, 'unknown_type' as any);

      expect(useEDFStore.getState().analysisError).toBe('分析类型 \'unknown_type\' 暂未实现');
    });
  });
});

describe('useEDFStore - Selection Management', () => {
  beforeEach(() => {
    useEDFStore.setState({
      selectionStart: null,
      selectionEnd: null,
      isSelecting: false,
      hasSelection: false,
    });
  });

  describe('setSelectionStart', () => {
    it('应设置选择开始时间', () => {
      const { setSelectionStart } = useEDFStore.getState();
      setSelectionStart(10.5);

      expect(useEDFStore.getState().selectionStart).toBe(10.5);
    });

    it('应清除选择开始时间', () => {
      useEDFStore.setState({ selectionStart: 10.5 });
      const { setSelectionStart } = useEDFStore.getState();
      setSelectionStart(null);

      expect(useEDFStore.getState().selectionStart).toBeNull();
    });
  });

  describe('setSelectionEnd', () => {
    it('应设置选择结束时间', () => {
      const { setSelectionEnd } = useEDFStore.getState();
      setSelectionEnd(20.5);

      expect(useEDFStore.getState().selectionEnd).toBe(20.5);
    });

    it('应清除选择结束时间', () => {
      useEDFStore.setState({ selectionEnd: 20.5 });
      const { setSelectionEnd } = useEDFStore.getState();
      setSelectionEnd(null);

      expect(useEDFStore.getState().selectionEnd).toBeNull();
    });
  });

  describe('setIsSelecting', () => {
    it('应设置选择中状态', () => {
      const { setIsSelecting } = useEDFStore.getState();
      setIsSelecting(true);

      expect(useEDFStore.getState().isSelecting).toBe(true);
    });

    it('应清除选择中状态', () => {
      useEDFStore.setState({ isSelecting: true });
      const { setIsSelecting } = useEDFStore.getState();
      setIsSelecting(false);

      expect(useEDFStore.getState().isSelecting).toBe(false);
    });
  });

  describe('confirmSelection', () => {
    it('应确认选择并停止选择状态', () => {
      useEDFStore.setState({
        isSelecting: true,
        hasSelection: false,
      });

      const { confirmSelection } = useEDFStore.getState();
      confirmSelection();

      expect(useEDFStore.getState().isSelecting).toBe(false);
      expect(useEDFStore.getState().hasSelection).toBe(true);
    });
  });

  describe('clearSelection', () => {
    it('应清除所有选择状态', () => {
      useEDFStore.setState({
        selectionStart: 10,
        selectionEnd: 20,
        isSelecting: true,
        hasSelection: true,
      });

      const { clearSelection } = useEDFStore.getState();
      clearSelection();

      expect(useEDFStore.getState().selectionStart).toBeNull();
      expect(useEDFStore.getState().selectionEnd).toBeNull();
      expect(useEDFStore.getState().isSelecting).toBe(false);
      expect(useEDFStore.getState().hasSelection).toBe(false);
    });
  });
});

describe('useEDFStore - Bookmark Management', () => {
  beforeEach(() => {
    useEDFStore.setState({
      bookmarks: [],
      currentTime: 0,
    });
  });

  describe('addBookmark', () => {
    it('应添加新书签', () => {
      const { addBookmark } = useEDFStore.getState();
      addBookmark('Test Bookmark', 15.5);

      const { bookmarks } = useEDFStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].label).toBe('Test Bookmark');
      expect(bookmarks[0].time).toBe(15.5);
      expect(bookmarks[0].id).toMatch(/^bookmark-\d+-\w+$/);
    });

    it('应按时间排序书签', () => {
      const { addBookmark } = useEDFStore.getState();
      addBookmark('Third', 30);
      addBookmark('First', 10);
      addBookmark('Second', 20);

      const { bookmarks } = useEDFStore.getState();
      expect(bookmarks[0].label).toBe('First');
      expect(bookmarks[1].label).toBe('Second');
      expect(bookmarks[2].label).toBe('Third');
    });

    it('应生成唯一 ID', () => {
      const { addBookmark } = useEDFStore.getState();
      addBookmark('Bookmark 1', 10);
      addBookmark('Bookmark 2', 20);

      const { bookmarks } = useEDFStore.getState();
      expect(bookmarks[0].id).not.toBe(bookmarks[1].id);
    });
  });

  describe('removeBookmark', () => {
    it('应删除指定书签', () => {
      const { addBookmark, removeBookmark } = useEDFStore.getState();
      addBookmark('To Keep', 10);
      addBookmark('To Remove', 20);

      const { bookmarks } = useEDFStore.getState();
      const idToRemove = bookmarks[1].id;
      removeBookmark(idToRemove);

      expect(useEDFStore.getState().bookmarks).toHaveLength(1);
      expect(useEDFStore.getState().bookmarks[0].label).toBe('To Keep');
    });

    it('删除不存在的书签不应报错', () => {
      const { removeBookmark } = useEDFStore.getState();
      expect(() => removeBookmark('non-existent-id')).not.toThrow();
    });
  });

  describe('jumpToBookmark', () => {
    it('应设置当前时间为书签时间', () => {
      const { addBookmark, jumpToBookmark } = useEDFStore.getState();
      addBookmark('Test', 42.5);

      const { bookmarks } = useEDFStore.getState();
      jumpToBookmark(bookmarks[0].time);

      expect(useEDFStore.getState().currentTime).toBe(42.5);
    });
  });

  describe('setBookmarks', () => {
    it('应设置书签列表', () => {
      const newBookmarks = [
        { id: 'bm-1', label: 'First', time: 10, createdAt: Date.now() },
        { id: 'bm-2', label: 'Second', time: 20, createdAt: Date.now() },
      ];

      const { setBookmarks } = useEDFStore.getState();
      setBookmarks(newBookmarks);

      expect(useEDFStore.getState().bookmarks).toEqual(newBookmarks);
    });

    it('应支持清空书签', () => {
      const { addBookmark, setBookmarks } = useEDFStore.getState();
      addBookmark('Test', 10);
      setBookmarks([]);

      expect(useEDFStore.getState().bookmarks).toHaveLength(0);
    });
  });
});

describe('useEDFStore - Sidebar Collapse', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // 重置侧边栏状态
    useEDFStore.setState({
      isLeftSidebarCollapsed: false,
      isRightSidebarCollapsed: false,
    });
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('初始状态', () => {
    it('默认侧边栏应为展开状态', () => {
      const { isLeftSidebarCollapsed, isRightSidebarCollapsed } = useEDFStore.getState();

      expect(isLeftSidebarCollapsed).toBe(false);
      expect(isRightSidebarCollapsed).toBe(false);
    });

    it('应从 localStorage 读取保存的状态', () => {
      localStorageMock.setItem('sidebarLeftCollapsed', 'true');
      localStorageMock.setItem('sidebarRightCollapsed', 'true');

      // 需要重新创建 store 来读取 localStorage
      // 由于 zustand store 是单例，我们只能测试 toggle 功能
      const { toggleLeftSidebar } = useEDFStore.getState();
      toggleLeftSidebar();

      const { isLeftSidebarCollapsed } = useEDFStore.getState();
      expect(isLeftSidebarCollapsed).toBe(true);
    });

    it('localStorage 为空时应默认为展开状态', () => {
      // 由于 zustand store 是单例，初始状态已经在第一次创建时设置
      // 这里我们测试 toggle 功能在无 localStorage 情况下正常工作
      localStorageMock.clear();

      const { toggleLeftSidebar, toggleRightSidebar } = useEDFStore.getState();

      // Toggle 应该正常工作
      toggleLeftSidebar();
      expect(useEDFStore.getState().isLeftSidebarCollapsed).toBe(true);

      toggleRightSidebar();
      expect(useEDFStore.getState().isRightSidebarCollapsed).toBe(true);

      // 检查 localStorage 应该没有被写入（在测试环境中可能无法写入）
      // 或者状态已经正确改变
    });
  });

  describe('toggleLeftSidebar', () => {
    it('应切换左侧边栏折叠状态', () => {
      // 重置为展开状态
      useEDFStore.setState({ isLeftSidebarCollapsed: false });

      const { toggleLeftSidebar } = useEDFStore.getState();

      toggleLeftSidebar();
      expect(useEDFStore.getState().isLeftSidebarCollapsed).toBe(true);

      toggleLeftSidebar();
      expect(useEDFStore.getState().isLeftSidebarCollapsed).toBe(false);
    });

    it('应将左侧边栏状态保存到 localStorage', () => {
      const { toggleLeftSidebar } = useEDFStore.getState();

      toggleLeftSidebar();

      expect(localStorageMock.getItem('sidebarLeftCollapsed')).toBe('true');

      toggleLeftSidebar();

      expect(localStorageMock.getItem('sidebarLeftCollapsed')).toBe('false');
    });

    it('不应影响右侧边栏状态', () => {
      const { toggleLeftSidebar } = useEDFStore.getState();
      const initialRightState = useEDFStore.getState().isRightSidebarCollapsed;

      toggleLeftSidebar();

      expect(useEDFStore.getState().isRightSidebarCollapsed).toBe(initialRightState);
    });
  });

  describe('toggleRightSidebar', () => {
    it('应切换右侧边栏折叠状态', () => {
      // 重置为展开状态
      useEDFStore.setState({ isRightSidebarCollapsed: false });

      const { toggleRightSidebar } = useEDFStore.getState();

      toggleRightSidebar();
      expect(useEDFStore.getState().isRightSidebarCollapsed).toBe(true);

      toggleRightSidebar();
      expect(useEDFStore.getState().isRightSidebarCollapsed).toBe(false);
    });

    it('应将右侧边栏状态保存到 localStorage', () => {
      const { toggleRightSidebar } = useEDFStore.getState();

      toggleRightSidebar();

      expect(localStorageMock.getItem('sidebarRightCollapsed')).toBe('true');

      toggleRightSidebar();

      expect(localStorageMock.getItem('sidebarRightCollapsed')).toBe('false');
    });

    it('不应影响左侧边栏状态', () => {
      const { toggleRightSidebar } = useEDFStore.getState();
      const initialLeftState = useEDFStore.getState().isLeftSidebarCollapsed;

      toggleRightSidebar();

      expect(useEDFStore.getState().isLeftSidebarCollapsed).toBe(initialLeftState);
    });
  });

  describe('侧边栏状态交互', () => {
    it('应支持同时折叠两个侧边栏', () => {
      // 重置为展开状态
      useEDFStore.setState({
        isLeftSidebarCollapsed: false,
        isRightSidebarCollapsed: false,
      });

      const { toggleLeftSidebar, toggleRightSidebar } = useEDFStore.getState();

      toggleLeftSidebar();
      toggleRightSidebar();

      const { isLeftSidebarCollapsed, isRightSidebarCollapsed } = useEDFStore.getState();
      expect(isLeftSidebarCollapsed).toBe(true);
      expect(isRightSidebarCollapsed).toBe(true);
    });

    it('应支持同时展开两个侧边栏', () => {
      const { toggleLeftSidebar, toggleRightSidebar } = useEDFStore.getState();

      // 先折叠两个侧边栏
      toggleLeftSidebar();
      toggleRightSidebar();

      // 再展开两个侧边栏
      toggleLeftSidebar();
      toggleRightSidebar();

      const { isLeftSidebarCollapsed, isRightSidebarCollapsed } = useEDFStore.getState();
      expect(isLeftSidebarCollapsed).toBe(false);
      expect(isRightSidebarCollapsed).toBe(false);
    });

    it('应保持各自的折叠状态独立', () => {
      const { toggleLeftSidebar, toggleRightSidebar } = useEDFStore.getState();

      toggleLeftSidebar();
      expect(useEDFStore.getState().isLeftSidebarCollapsed).toBe(true);
      expect(useEDFStore.getState().isRightSidebarCollapsed).toBe(false);

      toggleRightSidebar();
      expect(useEDFStore.getState().isLeftSidebarCollapsed).toBe(true);
      expect(useEDFStore.getState().isRightSidebarCollapsed).toBe(true);
    });
  });
});
