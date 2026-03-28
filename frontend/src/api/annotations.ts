import axios from 'axios';
import { getApiUrl } from '../env';
import type {
  AnnotationSetResponse,
  GenerateAnnotationsRequest,
  UserAnnotationRequest,
  Annotation,
} from '../types/annotation';

const API_BASE = () => getApiUrl('');

/**
 * 生成标注数据（触发完整分析流水线）
 */
export async function generateAnnotations(
  fileId: string,
  options?: GenerateAnnotationsRequest
): Promise<AnnotationSetResponse> {
  const response = await axios.post(
    `${API_BASE()}/annotations/${fileId}/generate`,
    options ?? {}
  );
  return response.data;
}

/**
 * 获取标注数据（支持过滤，未缓存时自动生成）
 */
export async function getAnnotations(
  fileId: string,
  filters?: {
    start?: number;
    end?: number;
    types?: string[];
    channels?: string[];
  }
): Promise<AnnotationSetResponse> {
  const params: Record<string, string> = {};
  if (filters?.start !== undefined) params.start = String(filters.start);
  if (filters?.end !== undefined) params.end = String(filters.end);
  if (filters?.types?.length) params.types = filters.types.join(',');
  if (filters?.channels?.length) params.channels = filters.channels.join(',');

  const response = await axios.get(`${API_BASE()}/annotations/${fileId}`, { params });
  return response.data;
}

/**
 * 添加用户标注
 */
export async function addUserAnnotation(
  fileId: string,
  request: UserAnnotationRequest
): Promise<Annotation> {
  const response = await axios.post(
    `${API_BASE()}/annotations/${fileId}/user`,
    request
  );
  return response.data;
}

/**
 * 删除用户标注
 */
export async function deleteUserAnnotation(
  fileId: string,
  annotationId: string
): Promise<void> {
  await axios.delete(
    `${API_BASE()}/annotations/${fileId}/user/${annotationId}`
  );
}

/**
 * 清除指定文件的标注缓存
 */
export async function clearAnnotationCache(
  fileId: string
): Promise<void> {
  await axios.delete(`${API_BASE()}/annotations/${fileId}/cache`);
}
