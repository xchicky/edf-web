import axios from "axios";
import { getApiUrl } from "../env";
import type { AnnotationSet, Annotation } from "../types/annotation";

const API_BASE = () => getApiUrl("");

export async function generateAnnotations(
  fileId: string
): Promise<AnnotationSet> {
  const response = await axios.post(
    `${API_BASE()}/annotations/${fileId}/generate`,
    {
      run_band_analysis: true,
      run_anomaly_detection: true,
    }
  );
  return response.data;
}

export async function getAnnotations(
  fileId: string,
  params?: {
    types?: string[];
    channels?: string[];
    start?: number;
    end?: number;
  }
): Promise<AnnotationSet> {
  const query: Record<string, string> = {};
  if (params?.types?.length) query.types = params.types.join(",");
  if (params?.channels?.length) query.channels = params.channels.join(",");
  if (params?.start != null) query.start = String(params.start);
  if (params?.end != null) query.end = String(params.end);
  const response = await axios.get(`${API_BASE()}/annotations/${fileId}`, {
    params: query,
  });
  return response.data;
}

export async function addUserAnnotation(
  fileId: string,
  data: {
    annotation_type: string;
    channel: string;
    start_time: number;
    end_time: number;
    label: string;
    note?: string;
  }
): Promise<Annotation> {
  const response = await axios.post(
    `${API_BASE()}/annotations/${fileId}/user`,
    data
  );
  return response.data;
}

export async function deleteUserAnnotation(
  fileId: string,
  annotationId: string
): Promise<void> {
  await axios.delete(`${API_BASE()}/annotations/${fileId}/user/${annotationId}`);
}
