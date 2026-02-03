/**
 * Mode API Client
 * 模式管理 API 客户端
 */

import axios from 'axios';
import { getApiUrl } from '../env';
import type {
  Mode,
  ModeCreateRequest,
  ModeListResponse,
  ModeCategory,
  CompatibilityCheckResult,
  ModeUsageStats,
} from '../types/mode';

const API_BASE = () => getApiUrl('');

/**
 * 查询参数
 */
export interface ModeQueryParams {
  category?: ModeCategory;
  includeBuiltIn?: boolean;
  includeCustom?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 获取所有模式
 */
export async function getAllModes(params?: ModeQueryParams): Promise<ModeListResponse> {
  const response = await axios.get(`${API_BASE()}/modes/`, {
    params: params
      ? {
          category: params.category,
          include_built_in: params.includeBuiltIn,
          include_custom: params.includeCustom,
          limit: params.limit,
          offset: params.offset,
        }
      : undefined,
  });

  return response.data;
}

/**
 * 获取单个模式
 */
export async function getModeById(modeId: string): Promise<Mode> {
  const response = await axios.get(`${API_BASE()}/modes/${modeId}`);
  return response.data;
}

/**
 * 创建模式
 */
export async function createMode(request: ModeCreateRequest): Promise<Mode> {
  const response = await axios.post(`${API_BASE()}/modes/`, request);
  return response.data;
}

/**
 * 更新模式
 */
export async function updateMode(modeId: string, updates: Partial<Mode>): Promise<Mode> {
  const response = await axios.put(`${API_BASE()}/modes/${modeId}`, updates);
  return response.data;
}

/**
 * 删除模式
 */
export async function deleteMode(modeId: string): Promise<{ success: boolean }> {
  const response = await axios.delete(`${API_BASE()}/modes/${modeId}`);
  return response.data;
}

/**
 * 兼容性检查请求
 */
export interface CompatibilityCheckRequest {
  mode_id: string;
  channel_names: string[];
  sampling_rate: number;
  duration?: number;
}

/**
 * 检查模式兼容性
 */
export async function checkModeCompatibility(
  modeId: string,
  channelNames: string[],
  samplingRate: number,
  duration?: number
): Promise<CompatibilityCheckResult> {
  const request: CompatibilityCheckRequest = {
    mode_id: modeId,
    channel_names: channelNames,
    sampling_rate: samplingRate,
    duration,
  };

  const response = await axios.post(`${API_BASE()}/modes/check-compatibility`, request);

  // 转换后端命名到前端命名
  return {
    isCompatible: response.data.is_compatible,
    issues: response.data.issues,
    warnings: response.data.warnings,
    canApplyWithFixes: response.data.can_apply_with_fixes,
  };
}

/**
 * 记录模式使用
 */
export async function recordModeUsage(modeId: string): Promise<void> {
  try {
    await axios.post(`${API_BASE()}/modes/${modeId}/use`);
  } catch (error) {
    // 静默处理记录使用失败，不影响用户体验
    console.warn('Failed to record mode usage:', error);
  }
}

/**
 * 获取模式使用统计
 */
export async function getModeStats(modeId: string): Promise<ModeUsageStats> {
  const response = await axios.get(`${API_BASE()}/modes/${modeId}/stats`);

  // 转换后端命名到前端命名
  return {
    modeId: response.data.mode_id,
    modeName: response.data.mode_name,
    totalUses: response.data.total_uses,
    lastUsedAt: response.data.last_used_at,
    firstUsedAt: response.data.first_used_at,
    avgSessionDuration: response.data.avg_session_duration,
  };
}

/**
 * 获取所有模式分类
 */
export async function getModeCategories(): Promise<ModeCategory[]> {
  const response = await axios.get(`${API_BASE()}/modes/categories`);
  return response.data.categories;
}

/**
 * 批量检查兼容性
 */
export async function batchCheckCompatibility(
  requests: CompatibilityCheckRequest[]
): Promise<Array<{ mode_id: string } & CompatibilityCheckResult>> {
  const response = await axios.post(`${API_BASE()}/modes/batch-check-compatibility`, {
    requests,
  });

  return response.data.results.map((r: any) => ({
    modeId: r.mode_id,
    isCompatible: r.is_compatible,
    issues: r.issues,
    warnings: r.warnings,
    canApplyWithFixes: r.can_apply_with_fixes,
  }));
}

/**
 * 应用模式到当前文件
 */
export async function applyMode(
  modeId: string,
  fileId: string,
  options?: {
    autoLoadData?: boolean;
    preserveBookmarks?: boolean;
  }
): Promise<{
  success: boolean;
  mode: Mode;
  appliedConfig: unknown;
  issues: unknown[];
}> {
  const response = await axios.post(`${API_BASE()}/modes/${modeId}/apply`, {
    file_id: fileId,
    auto_load_data: options?.autoLoadData ?? true,
    preserve_bookmarks: options?.preserveBookmarks ?? true,
  });

  return response.data;
}

/**
 * 收藏/取消收藏模式
 */
export async function toggleModeFavorite(modeId: string): Promise<Mode> {
  const response = await axios.post(`${API_BASE()}/modes/${modeId}/favorite`);
  return response.data;
}

/**
 * 复制模式
 */
export async function duplicateMode(modeId: string, newName?: string): Promise<Mode> {
  const response = await axios.post(`${API_BASE()}/modes/${modeId}/duplicate`, {
    new_name: newName,
  });
  return response.data;
}

/**
 * 导出模式
 */
export async function exportMode(modeId: string): Promise<string> {
  const response = await axios.get(`${API_BASE()}/modes/${modeId}/export`, {
    responseType: 'text',
  });
  return response.data;
}

/**
 * 导入模式
 */
export async function importMode(modeData: string): Promise<Mode> {
  const response = await axios.post(`${API_BASE()}/modes/import`, modeData, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.data;
}

/**
 * 获取推荐模式
 */
export async function getRecommendedModes(
  channelNames: string[],
  samplingRate: number,
  context?: {
    purpose?: string;
    sessionDuration?: number;
    userLevel?: string;
  }
): Promise<Mode[]> {
  const response = await axios.post(`${API_BASE()}/modes/recommend`, {
    channel_names: channelNames,
    sampling_rate: samplingRate,
    context,
  });

  return response.data.modes;
}

/**
 * 重置模式为默认配置
 */
export async function resetMode(modeId: string): Promise<Mode> {
  const response = await axios.post(`${API_BASE()}/modes/${modeId}/reset`);
  return response.data;
}
