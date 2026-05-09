import axios from 'axios';
import { getApiUrl } from '../env';
import type { PipelineRequest, PipelineResponse } from '../types/pipeline';

const API_BASE = () => getApiUrl('');

export async function runPipeline(
  fileId: string,
  request: PipelineRequest,
): Promise<PipelineResponse> {
  const response = await axios.post<PipelineResponse>(
    `${API_BASE()}/processing/pipeline/${fileId}`,
    request,
    { timeout: 180_000 },
  );
  return response.data;
}
