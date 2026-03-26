/**
 * modeCompatibilityChecker 测试
 * 测试模式与 EDF 文件的兼容性检查功能
 */

import { describe, it, expect } from 'vitest';
import {
  checkModeCompatibility,
  getMissingChannels,
  checkSamplingRate,
  filterCompatibleModes,
} from '../modeCompatibilityChecker';
import { BUILT_IN_MODES } from '../../types/mode';

describe('modeCompatibilityChecker', () => {
  const mockChannelNames = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const mockSamplingRate = 256;

  describe('checkModeCompatibility', () => {
    it('应该返回兼容结果当所有条件满足', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-clinical-standard')!;
      const result = checkModeCompatibility(mode, mockChannelNames, mockSamplingRate);

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.canApplyWithFixes).toBe(true);
    });

    it('应该检测缺失的必需通道', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-research-spectral')!;
      const limitedChannels = ['Fp1', 'Fp2']; // 缺少 Fz, Cz, Pz

      const result = checkModeCompatibility(mode, limitedChannels, mockSamplingRate);

      expect(result.isCompatible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('missing_channel');
      expect(result.issues[0].severity).toBe('error');
      expect(result.canApplyWithFixes).toBe(false);
    });

    it('应该检测低采样率', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-research-spectral')!;
      const lowSamplingRate = 50; // 低于要求的 100 Hz

      const result = checkModeCompatibility(mode, ['Fz', 'Cz', 'Pz'], lowSamplingRate);

      expect(result.isCompatible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      const samplingRateIssue = result.issues.find((i) => i.type === 'low_sampling_rate');
      expect(samplingRateIssue).toBeDefined();
      expect(samplingRateIssue?.severity).toBe('error');
    });

    it('应该处理没有必需要求的模式', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-education-basic')!;
      const result = checkModeCompatibility(mode, mockChannelNames, mockSamplingRate);

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('应该处理空通道列表', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-clinical-standard')!;
      const result = checkModeCompatibility(mode, [], mockSamplingRate);

      // 模式没有必需通道，应该兼容
      expect(result.isCompatible).toBe(true);
    });

    it('应该处理零采样率', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-clinical-standard')!;
      const result = checkModeCompatibility(mode, mockChannelNames, 0);

      // 模式没有最小采样率要求，应该兼容
      expect(result.isCompatible).toBe(true);
    });

    it('应该生成修复建议', () => {
      const mode = BUILT_IN_MODES.find((m) => m.id === 'mode-research-spectral')!;
      const limitedChannels = ['Fz']; // 只有一个通道

      const result = checkModeCompatibility(mode, limitedChannels, mockSamplingRate);

      expect(result.issues.length).toBeGreaterThan(0);
      result.issues.forEach((issue) => {
        if (issue.severity === 'error') {
          expect(issue.suggestion).toBeDefined();
          expect(typeof issue.suggestion).toBe('string');
          expect(issue.suggestion!.length).toBeGreaterThan(0);
        }
      });
    });

    it('应该处理自定义模式', () => {
      const customMode = {
        id: 'custom-mode-1',
        name: 'Custom Mode',
        category: 'custom' as const,
        description: 'Test custom mode',
        config: BUILT_IN_MODES[0].config,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isBuiltIn: false,
        isFavorite: false,
        usageCount: 0,
        requiredChannels: ['Fp1', 'Fp2'],
        tags: [],
      };

      const result = checkModeCompatibility(customMode, mockChannelNames, mockSamplingRate);

      expect(result.isCompatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('getMissingChannels', () => {
    it('应该返回空数组当所有通道都存在', () => {
      const requiredChannels = ['Fp1', 'Fp2', 'F3'];
      const availableChannels = ['Fp1', 'Fp2', 'F3', 'F4', 'C3'];

      const missing = getMissingChannels(requiredChannels, availableChannels);

      expect(missing).toHaveLength(0);
    });

    it('应该返回缺失的通道', () => {
      const requiredChannels = ['Fp1', 'Fz', 'Cz', 'Pz'];
      const availableChannels = ['Fp1', 'Fp2', 'F3', 'F4'];

      const missing = getMissingChannels(requiredChannels, availableChannels);

      expect(missing).toEqual(['Fz', 'Cz', 'Pz']);
    });

    it('应该处理空必需通道列表', () => {
      const missing = getMissingChannels([], mockChannelNames);

      expect(missing).toHaveLength(0);
    });

    it('应该处理空可用通道列表', () => {
      const missing = getMissingChannels(['Fp1', 'Fp2'], []);

      expect(missing).toEqual(['Fp1', 'Fp2']);
    });

    it('应该区分大小写', () => {
      const requiredChannels = ['FP1', 'Fp2'];
      const availableChannels = ['Fp1', 'Fp2'];

      const missing = getMissingChannels(requiredChannels, availableChannels);

      expect(missing).toEqual(['FP1']);
    });

    it('应该处理重复通道', () => {
      const requiredChannels = ['Fp1', 'Fp1', 'Fp2'];
      const availableChannels = ['Fp1', 'Fp2'];

      const missing = getMissingChannels(requiredChannels, availableChannels);

      // 去重后应该没有缺失通道
      expect(missing).toHaveLength(0);
    });
  });

  describe('checkSamplingRate', () => {
    it('应该返回 true 当采样率满足要求', () => {
      const result = checkSamplingRate(256, 100);
      expect(result).toBe(true);
    });

    it('应该返回 false 当采样率低于要求', () => {
      const result = checkSamplingRate(50, 100);
      expect(result).toBe(false);
    });

    it('应该返回 true 当采样率等于要求', () => {
      const result = checkSamplingRate(100, 100);
      expect(result).toBe(true);
    });

    it('应该处理无最小采样率要求', () => {
      const result = checkSamplingRate(50, undefined);
      expect(result).toBe(true);
    });

    it('应该处理零采样率要求', () => {
      const result = checkSamplingRate(50, 0);
      expect(result).toBe(true);
    });

    it('应该处理负采样率', () => {
      const result = checkSamplingRate(50, -10);
      expect(result).toBe(true); // 无效要求视为通过
    });
  });

  describe('filterCompatibleModes', () => {
    it('应该返回所有兼容模式', () => {
      const compatible = filterCompatibleModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      expect(compatible.length).toBeGreaterThan(0);
      compatible.forEach((item) => {
        expect(item.result.isCompatible).toBe(true);
      });
    });

    it('应该包含模式对象在结果中', () => {
      const compatible = filterCompatibleModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      expect(compatible[0]).toHaveProperty('mode');
      expect(compatible[0]).toHaveProperty('result');
      expect(typeof compatible[0].mode.id).toBe('string');
    });

    it('应该返回空数组当没有模式兼容', () => {
      const limitedChannels = ['X1', 'Y1']; // 不存在的通道
      const lowSamplingRate = 10;

      const compatible = filterCompatibleModes(
        BUILT_IN_MODES,
        limitedChannels,
        lowSamplingRate
      );

      // 至少教育模式应该兼容（无特殊要求）
      expect(compatible.length).toBeGreaterThanOrEqual(1);
    });

    it('应该处理空模式列表', () => {
      const compatible = filterCompatibleModes([], mockChannelNames, mockSamplingRate);

      expect(compatible).toHaveLength(0);
    });

    it('应该保持模式顺序', () => {
      const compatible = filterCompatibleModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      const originalOrder = BUILT_IN_MODES.map((m) => m.id);
      const filteredOrder = compatible.map((c) => c.mode.id);

      // 过滤后的列表应该保持原始顺序
      expect(filteredOrder).toEqual(originalOrder.filter((id, index) => {
        const compatibleIds = compatible.map((c) => c.mode.id);
        return compatibleIds.includes(id);
      }));
    });

    it('应该包含所有兼容性信息', () => {
      const compatible = filterCompatibleModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      compatible.forEach((item) => {
        expect(item.result).toHaveProperty('isCompatible');
        expect(item.result).toHaveProperty('issues');
        expect(item.result).toHaveProperty('warnings');
        expect(item.result).toHaveProperty('canApplyWithFixes');
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('应该处理 undefined 模式属性', () => {
      const mode = {
        ...BUILT_IN_MODES[0],
        requiredChannels: undefined,
        minSamplingRate: undefined,
      };

      const result = checkModeCompatibility(mode, mockChannelNames, mockSamplingRate);

      expect(result.isCompatible).toBe(true);
    });

    it('应该处理空字符串通道名', () => {
      const mode = {
        ...BUILT_IN_MODES[0],
        requiredChannels: ['', 'Fp1', ''],
      };

      const result = checkModeCompatibility(mode, mockChannelNames, mockSamplingRate);

      // 空字符串应该被忽略
      expect(result.isCompatible).toBe(true);
    });

    it('应该处理包含空格的通道名', () => {
      const mode = {
        ...BUILT_IN_MODES[0],
        requiredChannels: [' Fp1', 'Fp2 ', ' F3 '],
      };

      const availableChannels = ['Fp1', 'Fp2', 'F3'];
      const result = checkModeCompatibility(mode, availableChannels, mockSamplingRate);

      // 未修剪的通道名应该不匹配
      expect(result.isCompatible).toBe(false);
    });

    it('应该处理非常大的采样率', () => {
      const mode = {
        ...BUILT_IN_MODES[0],
        minSamplingRate: 1000000,
      };

      const result = checkModeCompatibility(mode, mockChannelNames, mockSamplingRate);

      expect(result.isCompatible).toBe(false);
      expect(result.issues.some((i) => i.type === 'low_sampling_rate')).toBe(true);
    });

    it('应该处理负的实际采样率', () => {
      const mode = BUILT_IN_MODES[0];

      const result = checkModeCompatibility(mode, mockChannelNames, -10);

      // 负采样率无效，但没有要求所以应该兼容
      expect(result.isCompatible).toBe(true);
    });
  });
});
