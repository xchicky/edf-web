/**
 * Zustand Store 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEDFStore } from '../edfStore';
import * as signalStorage from '../../utils/signalStorage';
import { Signal } from '../../types/signal';

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
