/**
 * signalStorage.test.ts
 * signalStorage 工具函数的单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSignals,
  loadSignals,
  deleteSignals,
  hasSignals,
  getAllSignalFileIds,
  clearAllSignals,
  getSignalsStorageSize,
} from '../signalStorage';
import type { Signal } from '../../types/signal';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});

describe('signalStorage', () => {
  const mockSignal1: Signal = {
    id: 'signal-1',
    name: '测试信号1',
    expression: 'Fp1 - F3',
    color: '#FF0000',
    enabled: true,
    createdAt: 1000000,
    modifiedAt: 1000000,
    operands: [],
  };

  const mockSignal2: Signal = {
    id: 'signal-2',
    name: '测试信号2',
    expression: '(Fp1 + F3) / 2',
    color: '#00FF00',
    enabled: false,
    createdAt: 2000000,
    modifiedAt: 2000000,
    operands: [],
  };

  const mockSignals: Signal[] = [mockSignal1, mockSignal2];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveSignals', () => {
    it('应该成功保存信号到 localStorage', () => {
      const fileId = 'test-file-1';
      saveSignals(fileId, mockSignals);

      const storedData = localStorage.getItem(`edf-signals-${fileId}`);
      expect(storedData).toBeTruthy();
      expect(JSON.parse(storedData!)).toEqual(mockSignals);
    });

    it('应该覆盖已存在的信号数据', () => {
      const fileId = 'test-file-2';
      saveSignals(fileId, [mockSignal1]);

      const newData = [mockSignal2];
      saveSignals(fileId, newData);

      const storedData = localStorage.getItem(`edf-signals-${fileId}`);
      expect(JSON.parse(storedData!)).toEqual(newData);
      expect(JSON.parse(storedData!)).not.toContainEqual(mockSignal1);
    });

    it('应该保存空数组', () => {
      const fileId = 'test-file-3';
      saveSignals(fileId, []);

      const storedData = localStorage.getItem(`edf-signals-${fileId}`);
      expect(JSON.parse(storedData!)).toEqual([]);
    });

    it('当 localStorage 不可用时应抛出错误', () => {
      const fileId = 'test-file-error';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock localStorage.setItem to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('localStorage is full');
      });

      expect(() => saveSignals(fileId, mockSignals)).toThrow('无法保存信号到本地存储');

      localStorage.setItem = originalSetItem;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('loadSignals', () => {
    it('应该成功加载已保存的信号', () => {
      const fileId = 'test-file-4';
      localStorage.setItem(`edf-signals-${fileId}`, JSON.stringify(mockSignals));

      const loaded = loadSignals(fileId);
      expect(loaded).toEqual(mockSignals);
    });

    it('当没有保存的数据时应返回空数组', () => {
      const fileId = 'non-existent-file';
      const loaded = loadSignals(fileId);
      expect(loaded).toEqual([]);
    });

    it('当数据损坏时应返回空数组', () => {
      const fileId = 'test-file-5';
      localStorage.setItem(`edf-signals-${fileId}`, 'invalid json{');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const loaded = loadSignals(fileId);

      expect(loaded).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteSignals', () => {
    it('应该成功删除已保存的信号', () => {
      const fileId = 'test-file-6';
      localStorage.setItem(`edf-signals-${fileId}`, JSON.stringify(mockSignals));

      deleteSignals(fileId);

      const storedData = localStorage.getItem(`edf-signals-${fileId}`);
      expect(storedData).toBeNull();
    });

    it('删除不存在的数据不应报错', () => {
      const fileId = 'non-existent-file';
      expect(() => deleteSignals(fileId)).not.toThrow();
    });
  });

  describe('hasSignals', () => {
    it('当存在信号时应返回 true', () => {
      const fileId = 'test-file-7';
      localStorage.setItem(`edf-signals-${fileId}`, JSON.stringify(mockSignals));

      expect(hasSignals(fileId)).toBe(true);
    });

    it('当不存在信号时应返回 false', () => {
      const fileId = 'non-existent-file';
      expect(hasSignals(fileId)).toBe(false);
    });

    it('当数据为空字符串时应返回 true（键存在）', () => {
      const fileId = 'test-file-8';
      localStorage.setItem(`edf-signals-${fileId}`, '');

      // 空字符串仍然意味着键存在，所以返回 true
      // loadSignals 会返回空数组
      expect(hasSignals(fileId)).toBe(true);
      expect(loadSignals(fileId)).toEqual([]);
    });
  });

  describe('getAllSignalFileIds', () => {
    it('应该返回所有保存了信号的文件 ID', () => {
      localStorage.setItem('edf-signals-file-1', JSON.stringify([mockSignal1]));
      localStorage.setItem('edf-signals-file-2', JSON.stringify([mockSignal2]));
      localStorage.setItem('edf-signals-file-3', JSON.stringify(mockSignals));
      // 添加非信号数据
      localStorage.setItem('other-key', 'some data');

      const fileIds = getAllSignalFileIds();
      expect(fileIds).toHaveLength(3);
      expect(fileIds).toContain('file-1');
      expect(fileIds).toContain('file-2');
      expect(fileIds).toContain('file-3');
      expect(fileIds).not.toContain('other-key');
    });

    it('当没有信号数据时应返回空数组', () => {
      const fileIds = getAllSignalFileIds();
      expect(fileIds).toEqual([]);
    });

    it('应该正确处理带前缀的文件 ID', () => {
      localStorage.setItem('edf-signals-test-file-123', JSON.stringify(mockSignals));

      const fileIds = getAllSignalFileIds();
      expect(fileIds).toContain('test-file-123');
    });
  });

  describe('clearAllSignals', () => {
    it('应该清空所有保存的信号', () => {
      localStorage.setItem('edf-signals-file-1', JSON.stringify([mockSignal1]));
      localStorage.setItem('edf-signals-file-2', JSON.stringify([mockSignal2]));
      localStorage.setItem('other-key', 'some data');

      clearAllSignals();

      expect(localStorage.getItem('edf-signals-file-1')).toBeNull();
      expect(localStorage.getItem('edf-signals-file-2')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('some data'); // 其他数据应保留
    });

    it('当没有信号数据时应正常执行', () => {
      expect(() => clearAllSignals()).not.toThrow();
    });
  });

  describe('getSignalsStorageSize', () => {
    it('应该正确计算信号数据的字节大小', () => {
      const fileId = 'test-file-9';
      const testData = mockSignals;
      const jsonString = JSON.stringify(testData);
      localStorage.setItem(`edf-signals-${fileId}`, jsonString);

      const expectedSize = new Blob([jsonString]).size;
      const size = getSignalsStorageSize(fileId);

      expect(size).toBe(expectedSize);
      expect(size).toBeGreaterThan(0);
    });

    it('当没有数据时应返回 0', () => {
      const fileId = 'non-existent-file';
      expect(getSignalsStorageSize(fileId)).toBe(0);
    });

    it('不同大小的数据应返回不同的大小', () => {
      const fileId1 = 'test-file-10';
      const fileId2 = 'test-file-11';

      saveSignals(fileId1, [mockSignal1]);
      saveSignals(fileId2, mockSignals);

      const size1 = getSignalsStorageSize(fileId1);
      const size2 = getSignalsStorageSize(fileId2);

      expect(size2).toBeGreaterThan(size1);
    });
  });

  describe('边界情况与集成测试', () => {
    it('应该支持中文文件名和信号名', () => {
      const fileId = '测试文件-中文';
      const chineseSignal: Signal = {
        ...mockSignal1,
        id: '信号-中文-id',
        name: '中文信号名称',
      };

      saveSignals(fileId, [chineseSignal]);
      const loaded = loadSignals(fileId);

      expect(loaded).toEqual([chineseSignal]);
      expect(hasSignals(fileId)).toBe(true);
    });

    it('应该正确处理特殊字符', () => {
      const fileId = 'file-with-"special"-chars';
      const specialSignal: Signal = {
        ...mockSignal1,
        expression: 'Fp1 - F3 /* with "quotes" */',
      };

      saveSignals(fileId, [specialSignal]);
      const loaded = loadSignals(fileId);

      expect(loaded).toEqual([specialSignal]);
    });

    it('多次保存和加载应保持数据一致性', () => {
      const fileId = 'test-consistency';

      for (let i = 0; i < 5; i++) {
        saveSignals(fileId, mockSignals);
        const loaded = loadSignals(fileId);
        expect(loaded).toEqual(mockSignals);
      }
    });

    it('应该支持大量信号', () => {
      const fileId = 'test-many-signals';
      const manySignals: Signal[] = Array.from({ length: 100 }, (_, i) => ({
        id: `signal-${i}`,
        name: `信号${i}`,
        expression: `CH${i} - CH${i + 1}`,
        color: `#${i.toString(16).padStart(6, '0')}`,
        enabled: i % 2 === 0,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      }));

      saveSignals(fileId, manySignals);
      const loaded = loadSignals(fileId);

      expect(loaded).toHaveLength(100);
      expect(loaded).toEqual(manySignals);
    });
  });
});
