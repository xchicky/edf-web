import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline } from '../pipeline';
import axios from 'axios';
import type { PipelineResponse } from '../../types/pipeline';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('pipeline API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call pipeline endpoint with correct params', async () => {
    const mockResponse: PipelineResponse = {
      processed_waveform: null,
      annotations: [],
      step_logs: [],
      total_processing_time_ms: 100,
    };
    mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

    const result = await runPipeline('test-file', {
      steps: [
        { id: 's1', category: 'preprocess', method: 'highpass_filter', parameters: { cutoff: 0.5 }, enabled: true, order: 0 },
      ],
      start: 0,
      duration: 10,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/processing/pipeline/test-file'),
      expect.objectContaining({ start: 0, duration: 10 }),
      expect.objectContaining({ timeout: 180_000 }),
    );
    expect(result.total_processing_time_ms).toBe(100);
  });

  it('should return processed waveform when available', async () => {
    const mockResponse: PipelineResponse = {
      processed_waveform: {
        data: [[1.0, 2.0, 3.0]],
        times: [0, 0.001, 0.002],
        channels: ['Fp1'],
        sfreq: 1000,
        n_samples: 3,
      },
      annotations: [],
      step_logs: [{ step_id: 's1', status: 'success', duration_ms: 50, message: 'ok' }],
      total_processing_time_ms: 50,
    };
    mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

    const result = await runPipeline('test-file', {
      steps: [],
      start: 0,
      duration: 5,
    });

    expect(result.processed_waveform).not.toBeNull();
    expect(result.processed_waveform!.channels).toEqual(['Fp1']);
    expect(result.step_logs).toHaveLength(1);
  });
});
