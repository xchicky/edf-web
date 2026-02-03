/**
 * Mode Compatibility Checker
 * 检查模式与 EDF 文件的兼容性
 */

import type {
  Mode,
  CompatibilityCheckResult,
  CompatibilityIssue,
} from '../types/mode';

/**
 * 检查模式与给定 EDF 文件的兼容性
 */
export function checkModeCompatibility(
  mode: Mode,
  channelNames: string[],
  samplingRate: number
): CompatibilityCheckResult {
  const issues: CompatibilityIssue[] = [];
  const warnings: string[] = [];

  // 检查必需通道
  if (mode.requiredChannels && mode.requiredChannels.length > 0) {
    const missingChannels = getMissingChannels(mode.requiredChannels, channelNames);
    if (missingChannels.length > 0) {
      issues.push({
        type: 'missing_channel',
        severity: 'error',
        message: `缺失必需通道: ${missingChannels.join(', ')}`,
        suggestion: `请确保文件包含以下通道: ${missingChannels.join(', ')}`,
      });
    }
  }

  // 检查采样率
  if (mode.minSamplingRate && mode.minSamplingRate > 0) {
    if (!checkSamplingRate(samplingRate, mode.minSamplingRate)) {
      issues.push({
        type: 'low_sampling_rate',
        severity: 'error',
        message: `采样率不足: ${samplingRate} Hz < ${mode.minSamplingRate} Hz`,
        suggestion: `该模式需要至少 ${mode.minSamplingRate} Hz 的采样率`,
      });
    }
  }

  // 生成警告
  if (channelNames.length === 0) {
    warnings.push('没有可用的通道数据');
  }

  if (samplingRate <= 0) {
    warnings.push('无效的采样率');
  }

  const hasErrors = issues.filter((i) => i.severity === 'error').length > 0;
  const isCompatible = !hasErrors;
  const canApplyWithFixes = !hasErrors;

  return {
    isCompatible,
    issues,
    warnings,
    canApplyWithFixes,
  };
}

/**
 * 获取缺失的通道列表
 */
export function getMissingChannels(
  requiredChannels: string[] | undefined,
  availableChannels: string[]
): string[] {
  if (!requiredChannels || requiredChannels.length === 0) {
    return [];
  }

  const availableSet = new Set(availableChannels);
  const missing: string[] = [];

  for (const channel of requiredChannels) {
    if (!channel || channel.trim() === '') {
      continue; // 跳过空通道名
    }
    if (!availableSet.has(channel)) {
      missing.push(channel);
    }
  }

  return missing;
}

/**
 * 检查采样率是否满足要求
 */
export function checkSamplingRate(
  actualRate: number,
  minRequiredRate: number | undefined
): boolean {
  if (!minRequiredRate || minRequiredRate <= 0) {
    return true; // 无要求或无效要求
  }

  return actualRate >= minRequiredRate;
}

/**
 * 过滤出所有兼容的模式
 */
export function filterCompatibleModes(
  modes: Mode[],
  channelNames: string[],
  samplingRate: number
): Array<{ mode: Mode; result: CompatibilityCheckResult }> {
  const results: Array<{ mode: Mode; result: CompatibilityCheckResult }> = [];

  for (const mode of modes) {
    const compatibility = checkModeCompatibility(mode, channelNames, samplingRate);
    if (compatibility.isCompatible) {
      results.push({ mode, result: compatibility });
    }
  }

  return results;
}

/**
 * 获取兼容性问题的本地化消息
 */
export function getCompatibilityIssueMessage(issue: CompatibilityIssue): string {
  switch (issue.type) {
    case 'missing_channel':
      return `缺失通道: ${issue.message}`;
    case 'low_sampling_rate':
      return `采样率不足: ${issue.message}`;
    case 'config_conflict':
      return `配置冲突: ${issue.message}`;
    case 'other':
    default:
      return issue.message;
  }
}

/**
 * 检查是否可以自动修复兼容性问题
 */
export function canAutoFix(issue: CompatibilityIssue): boolean {
  // 目前所有问题都需要手动修复
  return false;
}

/**
 * 生成兼容性报告摘要
 */
export function generateCompatibilitySummary(
  results: Array<{ mode: Mode; result: CompatibilityCheckResult }>
): {
  totalModes: number;
  compatibleModes: number;
  incompatibleModes: number;
  categories: Record<string, { total: number; compatible: number }>;
} {
  const summary = {
    totalModes: results.length,
    compatibleModes: 0,
    incompatibleModes: 0,
    categories: {} as Record<string, { total: number; compatible: number }>,
  };

  for (const { mode, result } of results) {
    if (result.isCompatible) {
      summary.compatibleModes++;
    } else {
      summary.incompatibleModes++;
    }

    // 按分类统计
    const category = mode.category;
    if (!summary.categories[category]) {
      summary.categories[category] = { total: 0, compatible: 0 };
    }
    summary.categories[category].total++;
    if (result.isCompatible) {
      summary.categories[category].compatible++;
    }
  }

  return summary;
}
