/**
 * Mode Recommender
 * 智能模式推荐系统
 */

import type {
  Mode,
  ModeRecommendation,
  ModeCategory,
  CompatibilityCheckResult,
} from '../types/mode';
import { checkModeCompatibility } from './modeCompatibilityChecker';

/**
 * 推荐上下文
 */
export interface RecommendationContext {
  purpose?: 'clinical-diagnosis' | 'research' | 'education' | 'quick-view' | 'general';
  sessionDuration?: number; // 会话时长（秒）
  analysisTypes?: Array<'time-domain' | 'frequency' | 'psd' | 'comprehensive'>;
  userLevel?: 'beginner' | 'intermediate' | 'expert';
  preferredCategories?: ModeCategory[];
}

/**
 * 使用统计上下文
 */
interface UsageStats {
  usageCount: number;
  lastUsedAt?: number;
  isFavorite: boolean;
}

/**
 * 推荐模式（综合推荐）
 */
export function recommendModes(
  modes: Mode[],
  channelNames: string[],
  samplingRate: number,
  context?: RecommendationContext
): ModeRecommendation[] {
  const recommendations: ModeRecommendation[] = [];

  for (const mode of modes) {
    const compatibility = checkModeCompatibility(mode, channelNames, samplingRate);

    if (!compatibility.isCompatible) {
      continue; // 跳过不兼容的模式
    }

    const usageStats: UsageStats = {
      usageCount: mode.usageCount,
      lastUsedAt: mode.lastUsedAt,
      isFavorite: mode.isFavorite,
    };

    const score = calculateRecommendationScore(mode, compatibility, usageStats, context);
    const reason = generateRecommendationReasons(mode, usageStats, context, compatibility);

    recommendations.push({
      mode,
      score,
      reason,
      compatibility,
    });
  }

  // 按分数降序排序
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}

/**
 * 按分类推荐模式
 */
export function recommendByCategory(
  modes: Mode[],
  category: ModeCategory,
  channelNames: string[],
  samplingRate: number,
  limit?: number
): ModeRecommendation[] {
  const filteredModes = modes.filter((m) => m.category === category);
  const recommendations = recommendModes(filteredModes, channelNames, samplingRate);

  return limit ? recommendations.slice(0, limit) : recommendations;
}

/**
 * 按使用历史推荐模式
 */
export function recommendByUsage(
  modes: Mode[],
  channelNames: string[],
  samplingRate: number,
  limit?: number
): ModeRecommendation[] {
  const recommendations: ModeRecommendation[] = [];

  for (const mode of modes) {
    const compatibility = checkModeCompatibility(mode, channelNames, samplingRate);

    if (!compatibility.isCompatible) {
      continue;
    }

    const usageStats: UsageStats = {
      usageCount: mode.usageCount,
      lastUsedAt: mode.lastUsedAt,
      isFavorite: mode.isFavorite,
    };

    // 主要基于使用历史计算分数
    const score = calculateUsageScore(usageStats);
    const reason = generateUsageReasons(mode, usageStats);

    recommendations.push({
      mode,
      score,
      reason,
      compatibility,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);

  return limit ? recommendations.slice(0, limit) : recommendations;
}

/**
 * 根据上下文推荐模式
 */
export function recommendByContext(
  modes: Mode[],
  context: RecommendationContext | undefined,
  channelNames: string[],
  samplingRate: number,
  limit?: number
): ModeRecommendation[] {
  if (!context) {
    return recommendModes(modes, channelNames, samplingRate);
  }

  const recommendations: ModeRecommendation[] = [];

  for (const mode of modes) {
    const compatibility = checkModeCompatibility(mode, channelNames, samplingRate);

    if (!compatibility.isCompatible) {
      continue;
    }

    const usageStats: UsageStats = {
      usageCount: mode.usageCount,
      lastUsedAt: mode.lastUsedAt,
      isFavorite: mode.isFavorite,
    };

    const score = calculateContextualScore(mode, usageStats, context, compatibility);
    const reason = generateContextualReasons(mode, context, compatibility);

    recommendations.push({
      mode,
      score,
      reason,
      compatibility,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);

  return limit ? recommendations.slice(0, limit) : recommendations;
}

/**
 * 计算推荐分数（0-1）
 */
export function calculateRecommendationScore(
  mode: Mode,
  compatibility: CompatibilityCheckResult,
  usageStats: UsageStats,
  context?: RecommendationContext
): number {
  if (!compatibility.isCompatible) {
    return 0;
  }

  let score = 0;

  // 兼容性分数（40%）
  const compatibilityScore = compatibility.warnings.length === 0 ? 0.4 : 0.3;
  score += compatibilityScore;

  // 使用分数（30%）
  score += calculateUsageScore(usageStats) * 0.3;

  // 内置模式加分（10%）
  if (mode.isBuiltIn) {
    score += 0.1;
  }

  // 上下文分数（20%）
  if (context) {
    score += calculateContextualScore(mode, usageStats, context, compatibility) * 0.2;
  } else {
    score += 0.1; // 无上下文时的默认分数
  }

  return Math.min(score, 1.0);
}

/**
 * 计算使用分数（0-1）
 */
function calculateUsageScore(stats: UsageStats): number {
  let score = 0;

  // 使用频率分数（0-0.5）
  const maxUsage = 100; // 假设100次使用为最大值
  const usageScore = Math.min(stats.usageCount / maxUsage, 1) * 0.5;
  score += usageScore;

  // 收藏加分（0-0.3）
  if (stats.isFavorite) {
    score += 0.3;
  }

  // 最近使用加分（0-0.2）
  if (stats.lastUsedAt) {
    const now = Date.now();
    const daysSinceLastUse = (now - stats.lastUsedAt) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceLastUse / 30) * 0.2; // 30天内线性衰减
    score += recencyScore;
  }

  return Math.min(score, 1.0);
}

/**
 * 计算上下文分数（0-1）
 */
function calculateContextualScore(
  mode: Mode,
  _usageStats: UsageStats,
  context: RecommendationContext,
  _compatibility: CompatibilityCheckResult
): number {
  let score = 0;

  // 目的匹配（0-0.4）
  if (context.purpose) {
    const purposeMatch = getPurposeMatchScore(mode.category, context.purpose);
    score += purposeMatch * 0.4;
  } else {
    score += 0.2; // 无目的时的默认分数
  }

  // 分析类型匹配（0-0.3）
  if (context.analysisTypes && context.analysisTypes.length > 0) {
    const analysisMatch = getAnalysisMatchScore(mode, context.analysisTypes);
    score += analysisMatch * 0.3;
  } else {
    score += 0.15;
  }

  // 用户级别匹配（0-0.2）
  if (context.userLevel) {
    const levelMatch = getLevelMatchScore(mode.category, context.userLevel);
    score += levelMatch * 0.2;
  } else {
    score += 0.1;
  }

  // 分类偏好匹配（0-0.1）
  if (context.preferredCategories && context.preferredCategories.length > 0) {
    const categoryMatch = context.preferredCategories.includes(mode.category) ? 0.1 : 0;
    score += categoryMatch;
  } else {
    score += 0.05;
  }

  return Math.min(score, 1.0);
}

/**
 * 获取目的匹配分数
 */
function getPurposeMatchScore(category: ModeCategory, purpose: string): number {
  const matches: Record<string, Record<ModeCategory, number>> = {
    'clinical-diagnosis': { clinical: 1.0, research: 0.7, education: 0.3, custom: 0.5 },
    'research': { clinical: 0.6, research: 1.0, education: 0.2, custom: 0.7 },
    'education': { clinical: 0.4, research: 0.5, education: 1.0, custom: 0.3 },
    'quick-view': { clinical: 0.5, research: 0.3, education: 0.8, custom: 0.6 },
    'general': { clinical: 0.7, research: 0.7, education: 0.7, custom: 0.7 },
  };

  return matches[purpose]?.[category] ?? 0.5;
}

/**
 * 获取分析类型匹配分数
 */
function getAnalysisMatchScore(mode: Mode, analysisTypes: string[]): number {
  let matchCount = 0;

  for (const type of analysisTypes) {
    if (type === 'time-domain' || type === 'comprehensive') {
      // 时域分析适用于大多数模式
      matchCount += 0.3;
    }
    if (type === 'frequency' || type === 'psd') {
      // 频域分析需要 frequency 视图模式
      if (mode.config.viewMode === 'frequency') {
        matchCount += 0.5;
      } else if (mode.config.analysis.type === 'frequency' || mode.config.analysis.type === 'comprehensive') {
        matchCount += 0.3;
      }
    }
  }

  return Math.min(matchCount, 1.0);
}

/**
 * 获取用户级别匹配分数
 */
function getLevelMatchScore(category: ModeCategory, userLevel: string): number {
  const matches: Record<string, Record<ModeCategory, number>> = {
    beginner: { clinical: 0.5, research: 0.2, education: 1.0, custom: 0.3 },
    intermediate: { clinical: 0.8, research: 0.7, education: 0.6, custom: 0.7 },
    expert: { clinical: 0.9, research: 1.0, education: 0.4, custom: 1.0 },
  };

  return matches[userLevel]?.[category] ?? 0.5;
}

/**
 * 生成推荐理由
 */
function generateRecommendationReasons(
  mode: Mode,
  usageStats: UsageStats,
  context?: RecommendationContext,
  compatibility?: CompatibilityCheckResult
): string[] {
  const reasons: string[] = [];

  if (mode.isBuiltIn) {
    reasons.push('内置推荐模式');
  }

  if (usageStats.isFavorite) {
    reasons.push('您收藏的模式');
  }

  if (usageStats.usageCount > 0) {
    reasons.push(`已使用 ${usageStats.usageCount} 次`);
  }

  if (usageStats.lastUsedAt) {
    const daysSinceLastUse = Math.floor((Date.now() - usageStats.lastUsedAt) / (1000 * 60 * 60 * 24));
    if (daysSinceLastUse <= 7) {
      reasons.push('最近使用过');
    }
  }

  if (context?.purpose) {
    const categoryLabels: Record<ModeCategory, string> = {
      clinical: '临床诊断',
      research: '科学研究',
      education: '教学演示',
      custom: '自定义',
    };
    reasons.push(`${categoryLabels[mode.category]}模式`);
  }

  if (compatibility?.warnings.length === 0) {
    reasons.push('完全兼容当前文件');
  }

  return reasons.length > 0 ? reasons : ['推荐模式'];
}

/**
 * 生成使用历史理由
 */
function generateUsageReasons(_mode: Mode, usageStats: UsageStats): string[] {
  const reasons: string[] = [];

  if (usageStats.isFavorite) {
    reasons.push('您收藏的模式');
  }

  if (usageStats.usageCount > 0) {
    reasons.push(`已使用 ${usageStats.usageCount} 次`);
  }

  if (usageStats.lastUsedAt) {
    const daysSinceLastUse = Math.floor((Date.now() - usageStats.lastUsedAt) / (1000 * 60 * 60 * 24));
    if (daysSinceLastUse === 0) {
      reasons.push('今天使用过');
    } else if (daysSinceLastUse <= 7) {
      reasons.push(`${daysSinceLastUse} 天前使用过`);
    }
  }

  return reasons.length > 0 ? reasons : ['基于使用历史推荐'];
}

/**
 * 生成上下文理由
 */
function generateContextualReasons(
  mode: Mode,
  context: RecommendationContext,
  compatibility: CompatibilityCheckResult
): string[] {
  const reasons: string[] = [];

  if (context.purpose) {
    const purposeLabels: Record<string, string> = {
      'clinical-diagnosis': '适合临床诊断',
      'research': '适合科学研究',
      'education': '适合教学演示',
      'quick-view': '适合快速查看',
      'general': '通用模式',
    };
    reasons.push(purposeLabels[context.purpose] || '适合当前场景');
  }

  if (context.analysisTypes && context.analysisTypes.length > 0) {
    if (mode.config.viewMode === 'frequency' && context.analysisTypes.includes('frequency')) {
      reasons.push('支持频谱分析');
    }
    if (mode.config.analysis.enabled) {
      reasons.push('启用自动分析');
    }
  }

  if (compatibility.warnings.length === 0) {
    reasons.push('完全兼容');
  }

  return reasons.length > 0 ? reasons : ['符合当前场景'];
}
