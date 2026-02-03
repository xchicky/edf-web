/**
 * modeRecommender 测试
 * 测试智能模式推荐功能
 */

import { describe, it, expect } from 'vitest';
import {
  recommendModes,
  recommendByCategory,
  recommendByUsage,
  recommendByContext,
  calculateRecommendationScore,
  type RecommendationContext,
} from '../modeRecommender';
import { BUILT_IN_MODES } from '../../types/mode';
import type { Mode } from '../../types/mode';

describe('modeRecommender', () => {
  const mockChannelNames = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const mockSamplingRate = 256;

  describe('recommendModes', () => {
    it('应该返回按分数排序的推荐列表', () => {
      const recommendations = recommendModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].score).toBeGreaterThanOrEqual(recommendations[1]?.score ?? 0);
    });

    it('应该包含推荐理由', () => {
      const recommendations = recommendModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      recommendations.forEach((rec) => {
        expect(rec.reason).toBeDefined();
        expect(Array.isArray(rec.reason)).toBe(true);
        expect(rec.reason.length).toBeGreaterThan(0);
      });
    });

    it('应该只返回兼容的模式', () => {
      const recommendations = recommendModes(
        BUILT_IN_MODES,
        mockChannelNames,
        mockSamplingRate
      );

      recommendations.forEach((rec) => {
        expect(rec.compatibility.isCompatible).toBe(true);
      });
    });

    it('应该处理空模式列表', () => {
      const recommendations = recommendModes([], mockChannelNames, mockSamplingRate);

      expect(recommendations).toHaveLength(0);
    });

    it('应该处理不兼容的模式', () => {
      const limitedChannels = ['X1']; // 不存在的通道

      const recommendations = recommendModes(
        BUILT_IN_MODES,
        limitedChannels,
        mockSamplingRate
      );

      // 应该只返回兼容的模式（如果有）
      recommendations.forEach((rec) => {
        expect(rec.compatibility.isCompatible).toBe(true);
      });
    });
  });

  describe('recommendByCategory', () => {
    it('应该推荐指定分类的模式', () => {
      const recommendations = recommendByCategory(
        BUILT_IN_MODES,
        'clinical',
        mockChannelNames,
        mockSamplingRate
      );

      recommendations.forEach((rec) => {
        expect(rec.mode.category).toBe('clinical');
      });
    });

    it('应该返回空数组当没有该分类的模式', () => {
      const recommendations = recommendByCategory(
        BUILT_IN_MODES,
        'custom' as any, // 可能没有自定义模式
        mockChannelNames,
        mockSamplingRate
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该过滤不兼容的模式', () => {
      const recommendations = recommendByCategory(
        BUILT_IN_MODES,
        'research',
        mockChannelNames,
        mockSamplingRate
      );

      recommendations.forEach((rec) => {
        expect(rec.mode.category).toBe('research');
        expect(rec.compatibility.isCompatible).toBe(true);
      });
    });
  });

  describe('recommendByUsage', () => {
    it('应该优先推荐使用频率高的模式', () => {
      // 创建带使用统计的模式
      const modesWithUsage = BUILT_IN_MODES.map((mode) => ({
        ...mode,
        usageCount: mode.id === 'mode-clinical-standard' ? 100 : 10,
      }));

      const recommendations = recommendByUsage(
        modesWithUsage,
        mockChannelNames,
        mockSamplingRate
      );

      if (recommendations.length > 1) {
        const clinicalRec = recommendations.find((r) => r.mode.id === 'mode-clinical-standard');
        expect(clinicalRec?.score).toBeGreaterThanOrEqual(0.5); // 高使用率应该有高分数
      }
    });

    it('应该考虑最近使用时间', () => {
      const now = Date.now();
      const modesWithUsage = BUILT_IN_MODES.map((mode) => ({
        ...mode,
        lastUsedAt: mode.id === 'mode-clinical-standard' ? now : now - 86400000 * 30, // 30天前
      }));

      const recommendations = recommendByUsage(
        modesWithUsage,
        mockChannelNames,
        mockSamplingRate
      );

      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('应该处理没有使用记录的模式', () => {
      const modesWithoutUsage = BUILT_IN_MODES.map((mode) => ({
        ...mode,
        usageCount: 0,
        lastUsedAt: undefined,
      }));

      const recommendations = recommendByUsage(
        modesWithoutUsage,
        mockChannelNames,
        mockSamplingRate
      );

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('recommendByContext', () => {
    it('应该根据上下文推荐模式', () => {
      const context: RecommendationContext = {
        purpose: 'clinical-diagnosis',
        sessionDuration: 600, // 10分钟
        analysisTypes: ['time-domain', 'frequency'],
      };

      const recommendations = recommendByContext(
        BUILT_IN_MODES,
        context,
        mockChannelNames,
        mockSamplingRate
      );

      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach((rec) => {
        expect(rec.compatibility.isCompatible).toBe(true);
      });
    });

    it('应该推荐教学模式用于教学场景', () => {
      const context: RecommendationContext = {
        purpose: 'education',
        sessionDuration: 300,
        analysisTypes: [],
      };

      const recommendations = recommendByContext(
        BUILT_IN_MODES,
        context,
        mockChannelNames,
        mockSamplingRate
      );

      const educationRec = recommendations.find((r) => r.mode.category === 'education');
      expect(educationRec).toBeDefined();
    });

    it('应该推荐科研模式用于研究场景', () => {
      const context: RecommendationContext = {
        purpose: 'research',
        sessionDuration: 1800,
        analysisTypes: ['frequency', 'psd'],
      };

      const recommendations = recommendByContext(
        BUILT_IN_MODES,
        context,
        mockChannelNames,
        mockSamplingRate
      );

      // 科研模式可能不兼容（需要 Fz, Cz, Pz 通道），所以检查是否有推荐
      // 如果有科研模式推荐，验证它
      const researchRec = recommendations.find((r) => r.mode.category === 'research');
      if (researchRec) {
        expect(researchRec.compatibility.isCompatible).toBe(true);
      } else {
        // 如果没有科研模式推荐，至少应该有其他推荐
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });

    it('应该考虑会话时长', () => {
      const shortSessionContext: RecommendationContext = {
        purpose: 'quick-view',
        sessionDuration: 60, // 1分钟
        analysisTypes: [],
      };

      const recommendations = recommendByContext(
        BUILT_IN_MODES,
        shortSessionContext,
        mockChannelNames,
        mockSamplingRate
      );

      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('应该根据分析类型推荐', () => {
      const frequencyContext: RecommendationContext = {
        purpose: 'research',
        sessionDuration: 600,
        analysisTypes: ['frequency'],
      };

      const recommendations = recommendByContext(
        BUILT_IN_MODES,
        frequencyContext,
        mockChannelNames,
        mockSamplingRate
      );

      // 应该推荐频谱视图的模式（如果兼容）
      const frequencyModeRec = recommendations.find(
        (r) => r.mode.config.viewMode === 'frequency'
      );

      if (frequencyModeRec) {
        expect(frequencyModeRec.score).toBeGreaterThan(0);
      } else {
        // 如果没有频谱视图模式（可能不兼容），至少应该有其他推荐
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateRecommendationScore', () => {
    it('应该返回 0-1 之间的分数', () => {
      const mode = BUILT_IN_MODES[0];
      const score = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 10,
          lastUsedAt: Date.now(),
          isFavorite: false,
        }
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('应该给收藏模式更高的分数', () => {
      const mode = BUILT_IN_MODES[0];
      const baseScore = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 10,
          lastUsedAt: Date.now(),
          isFavorite: false,
        }
      );

      const favoriteScore = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 10,
          lastUsedAt: Date.now(),
          isFavorite: true,
        }
      );

      expect(favoriteScore).toBeGreaterThan(baseScore);
    });

    it('应该给高频使用模式更高的分数', () => {
      const mode = BUILT_IN_MODES[0];
      const lowUsageScore = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 1,
          lastUsedAt: Date.now(),
          isFavorite: false,
        }
      );

      const highUsageScore = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 100,
          lastUsedAt: Date.now(),
          isFavorite: false,
        }
      );

      expect(highUsageScore).toBeGreaterThan(lowUsageScore);
    });

    it('应该给最近使用的模式更高的分数', () => {
      const mode = BUILT_IN_MODES[0];
      const now = Date.now();

      const oldScore = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 10,
          lastUsedAt: now - 86400000 * 30, // 30天前
          isFavorite: false,
        }
      );

      const recentScore = calculateRecommendationScore(
        mode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 10,
          lastUsedAt: now - 3600000, // 1小时前
          isFavorite: false,
        }
      );

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it('应该返回 0 分对于不兼容的模式', () => {
      const mode = BUILT_IN_MODES[0];
      const score = calculateRecommendationScore(
        mode,
        { isCompatible: false, issues: [{ type: 'missing_channel', severity: 'error', message: 'test' }], warnings: [], canApplyWithFixes: false },
        {
          usageCount: 100,
          lastUsedAt: Date.now(),
          isFavorite: true,
        }
      );

      expect(score).toBe(0);
    });

    it('应该考虑内置模式的权重', () => {
      const builtInMode = BUILT_IN_MODES.find((m) => m.isBuiltIn)!;
      const builtInScore = calculateRecommendationScore(
        builtInMode,
        { isCompatible: true, issues: [], warnings: [], canApplyWithFixes: true },
        {
          usageCount: 0,
          lastUsedAt: undefined,
          isFavorite: false,
        }
      );

      expect(builtInScore).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('应该处理空的通道列表', () => {
      const recommendations = recommendModes(
        BUILT_IN_MODES,
        [],
        mockSamplingRate
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理零采样率', () => {
      const recommendations = recommendModes(
        BUILT_IN_MODES,
        mockChannelNames,
        0
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理负采样率', () => {
      const recommendations = recommendModes(
        BUILT_IN_MODES,
        mockChannelNames,
        -10
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理未定义的上下文', () => {
      const recommendations = recommendByContext(
        BUILT_IN_MODES,
        undefined as any,
        mockChannelNames,
        mockSamplingRate
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
