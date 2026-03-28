import axios from 'axios';
import { getApiUrl } from '../env';
import type {
  AnnotationSet,
  GenerateAnnotationsRequest,
  UserAnnotationRequest,
  GetAnnotationsParams,
  Annotation,
} from '../types/annotation';

const API_BASE = () => getApiUrl('');

/**
 * 生成标注（触发后端分析流水线）
 */
export async function generateAnnotations(
  fileId: string,
  params?: GenerateAnnotationsRequest
): Promise<AnnotationSet> {
  const response = await axios.post(
    `${API_BASE()}/annotations/${fileId}/generate`,
    {
      run_band_analysis: params?.run_band_analysis ?? true,
      run_anomaly_detection: params?.run_anomaly_detection ?? true,
      anomaly_sensitivity: params?.anomaly_sensitivity ?? 1.0,
    }
  );

  return response.data;
}

/**
 * 获取标注（支持过滤）
 */
export async function getAnnotations(
  fileId: string,
  params?: GetAnnotationsParams
): Promise<AnnotationSet> {
  const queryParams: Record<string, string> = {};

  if (params?.start !== undefined) {
    queryParams.start = String(params.start);
  }
  if (params?.end !== undefined) {
    queryParams.end = String(params.end);
  }
  if (params?.types && params.types.length > 0) {
    queryParams.types = params.types.join(',');
  }
  if (params?.channels && params.channels.length > 0) {
    queryParams.channels = params.channels.join(',');
  }

  const response = await axios.get(`${API_BASE()}/annotations/${fileId}`, {
    params: queryParams,
  });

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
    {
      annotation_type: request.annotation_type ?? 'user_note',
      channel: request.channel,
      start_time: request.start_time,
      end_time: request.end_time,
      label: request.label,
      note: request.note ?? '',
    }
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
