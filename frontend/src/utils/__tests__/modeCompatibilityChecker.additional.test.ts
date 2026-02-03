/**
 * modeCompatibilityChecker 额外测试
 * 测试额外函数以提高覆盖率
 */

import { describe, it, expect } from 'vitest';
import {
  getCompatibilityIssueMessage,
  canAutoFix,
  generateCompatibilitySummary,
  type CompatibilityIssue,
} from '../modeCompatibilityChecker';
import { BUILT_IN_MODES } from '../../types/mode';
import { checkModeCompatibility } from '../modeCompatibilityChecker';

describe('modeCompatibilityChecker - Additional Functions', () => {
  const mockChannelNames = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const mockSamplingRate = 256;

  describe('getCompatibilityIssueMessage', () => {
    it('应该返回缺失通道消息', () => {
      const issue: CompatibilityIssue = {
        type: 'missing_channel',
        severity: 'error',
        message: 'Missing channel Fz',
        suggestion: 'Add Fz channel',
      };

      const result = getCompatibilityIssueMessage(issue);
      expect(result).toBe('缺失通道: Missing channel Fz');
    });

    it('应该返回采样率不足消息', () => {
      const issue: CompatibilityIssue = {
        type: 'low_sampling_rate',
        severity: 'error',
        message: 'Sampling rate too low',
        suggestion: 'Use higher sampling rate',
      };

      const result = getCompatibilityIssueMessage(issue);
      expect(result).toBe('采样率不足: Sampling rate too low');
    });

    it('应该返回配置冲突消息', () => {
      const issue: CompatibilityIssue = {
        type: 'config_conflict',
        severity: 'warning',
        message: 'Config conflict detected',
      };

      const result = getCompatibilityIssueMessage(issue);
      expect(result).toBe('配置冲突: Config conflict detected');
    });

    it('应该返回其他类型消息', () => {
      const issue: CompatibilityIssue = {
        type: 'other',
        severity: 'error',
        message: 'Some other error',
      };

      const result = getCompatibilityIssueMessage(issue);
      expect(result).toBe('Some other error');
    });

    it('应该处理未知类型', () => {
      const issue = {
        type: 'unknown' as any,
        severity: 'error' as const,
        message: 'Unknown error',
      };

      const result = getCompatibilityIssueMessage(issue);
      expect(result).toBe('Unknown error');
    });
  });

  describe('canAutoFix', () => {
    it('应该对所有问题类型返回 false', () => {
      const issues: CompatibilityIssue[] = [
        {
          type: 'missing_channel',
          severity: 'error',
          message: 'Missing channel',
        },
        {
          type: 'low_sampling_rate',
          severity: 'error',
          message: 'Low sampling rate',
        },
        {
          type: 'config_conflict',
          severity: 'warning',
          message: 'Config conflict',
        },
        {
          type: 'other',
          severity: 'error',
          message: 'Other issue',
        },
      ];

      issues.forEach((issue) => {
        expect(canAutoFix(issue)).toBe(false);
      });
    });
  });

  describe('generateCompatibilitySummary', () => {
    it('应该生成正确摘要', () => {
      const results = [
        {
          mode: BUILT_IN_MODES[0],
          result: checkModeCompatibility(BUILT_IN_MODES[0], mockChannelNames, mockSamplingRate),
        },
        {
          mode: BUILT_IN_MODES[1],
          result: checkModeCompatibility(BUILT_IN_MODES[1], mockChannelNames, mockSamplingRate),
        },
        {
          mode: BUILT_IN_MODES[2],
          result: checkModeCompatibility(BUILT_IN_MODES[2], mockChannelNames, mockSamplingRate),
        },
      ];

      const summary = generateCompatibilitySummary(results);

      expect(summary.totalModes).toBe(3);
      expect(summary.compatibleModes).toBeGreaterThan(0);
      expect(summary.incompatibleModes).toBeGreaterThanOrEqual(0);
      expect(summary.categories).toBeDefined();
    });

    it('应该正确统计分类', () => {
      const results = [
        {
          mode: BUILT_IN_MODES[0], // clinical
          result: checkModeCompatibility(BUILT_IN_MODES[0], mockChannelNames, mockSamplingRate),
        },
        {
          mode: BUILT_IN_MODES[1], // research
          result: checkModeCompatibility(BUILT_IN_MODES[1], mockChannelNames, mockSamplingRate),
        },
      ];

      const summary = generateCompatibilitySummary(results);

      expect(summary.categories).toHaveProperty('clinical');
      expect(summary.categories).toHaveProperty('research');
      expect(summary.categories.clinical.total).toBe(1);
      expect(summary.categories.research.total).toBe(1);
    });

    it('应该处理空结果列表', () => {
      const summary = generateCompatibilitySummary([]);

      expect(summary.totalModes).toBe(0);
      expect(summary.compatibleModes).toBe(0);
      expect(summary.incompatibleModes).toBe(0);
      expect(summary.categories).toEqual({});
    });

    it('应该正确处理兼容和不兼容的模式', () => {
      const compatibleMode = BUILT_IN_MODES[0];
      const incompatibleMode = {
        ...BUILT_IN_MODES[1],
        requiredChannels: ['NonExistentChannel'],
      };

      const results = [
        {
          mode: compatibleMode,
          result: checkModeCompatibility(compatibleMode, mockChannelNames, mockSamplingRate),
        },
        {
          mode: incompatibleMode,
          result: checkModeCompatibility(incompatibleMode, mockChannelNames, mockSamplingRate),
        },
      ];

      const summary = generateCompatibilitySummary(results);

      expect(summary.totalModes).toBe(2);
      expect(summary.compatibleModes).toBe(1);
      expect(summary.incompatibleModes).toBe(1);
    });

    it('应该正确计算每个分类的兼容数量', () => {
      const results = [
        {
          mode: BUILT_IN_MODES[0], // clinical
          result: { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        },
        {
          mode: BUILT_IN_MODES[0], // clinical (duplicate for testing)
          result: { isCompatible: false, issues: [], warnings: [], canApplyWithFixes: false },
        },
      ];

      const summary = generateCompatibilitySummary(results);

      expect(summary.categories.clinical.total).toBe(2);
      expect(summary.categories.clinical.compatible).toBe(1);
    });
  });
});
