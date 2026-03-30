/**
 * edf-demo.test.ts
 * Tests for fetchDemoMetadata() API function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { fetchDemoMetadata, type EDFMetadata } from '../edf';

// Mock axios
vi.mock('axios');

// Mock getApiUrl
vi.mock('../../env', () => ({
  getApiUrl: (path: string) => `http://localhost:8000${path}`,
}));

const mockedAxios = vi.mocked(axios);

describe('fetchDemoMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch demo metadata with correct endpoint', async () => {
    const mockResponse: EDFMetadata = {
      file_id: 'dev-demo',
      filename: 'demo.edf',
      file_size_mb: 1.0,
      n_channels: 19,
      channel_names: ['Fp1', 'Fp2', 'F3', 'F4'],
      sfreq: 256,
      duration_seconds: 600,
      duration_minutes: 10,
    };

    mockedAxios.get.mockResolvedValue({ data: mockResponse });

    const result = await fetchDemoMetadata();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://localhost:8000/upload/dev/demo-metadata'
    );
    expect(result.file_id).toBe('dev-demo');
    expect(result.filename).toBe('demo.edf');
    expect(result.n_channels).toBe(19);
  });

  it('should return metadata with fixed file_id', async () => {
    const mockResponse: EDFMetadata = {
      file_id: 'dev-demo',
      filename: 'demo.edf',
      file_size_mb: 2.5,
      n_channels: 10,
      channel_names: ['Ch1', 'Ch2'],
      sfreq: 500,
      duration_seconds: 120,
      duration_minutes: 2,
    };

    mockedAxios.get.mockResolvedValue({ data: mockResponse });

    const result = await fetchDemoMetadata();

    expect(result.file_id).toBe('dev-demo');
  });

  it('should handle network errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));

    await expect(fetchDemoMetadata()).rejects.toThrow('Network Error');
  });

  it('should handle 404 when demo file not found', async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 404, data: { detail: 'Demo EDF file not found' } },
    });

    await expect(fetchDemoMetadata()).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          status: 404,
        }),
      })
    );
  });
});
