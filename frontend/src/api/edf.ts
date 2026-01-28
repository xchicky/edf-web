import axios from 'axios';
import { getApiUrl } from '../env';
import type { SignalValidation, SignalComputationResult } from '../types/signal';

const API_BASE = () => getApiUrl('');

export interface EDFMetadata {
  file_id: string;
  filename: string;
  file_size_mb: number;
  n_channels: number;
  channel_names: string[];
  sfreq: number;
  duration_seconds: number;
  duration_minutes: number;
}

export interface WaveformData {
  file_id: string;
  data: number[][];
  times: number[];
  channels: string[];
  sfreq: number;
  n_samples: number;
  start_time: number;
  duration: number;
}

export async function uploadEDF(file: File): Promise<EDFMetadata> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_BASE()}/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function getMetadata(fileId: string): Promise<EDFMetadata> {
  const response = await axios.get(`${API_BASE()}/metadata/${fileId}`);
  return response.data;
}

export async function getWaveform(
  fileId: string,
  start: number,
  duration: number,
  channels?: number[]
): Promise<WaveformData> {
  const channelsParam = channels ? channels.join(',') : undefined;
  const response = await axios.get(`${API_BASE()}/waveform/${fileId}`, {
    params: { start, duration, channels: channelsParam },
  });

  return response.data;
}

export async function getWaveformOverview(
  fileId: string,
  samplesPerSecond: number = 1.0,
  channels?: number[]
): Promise<WaveformData> {
  const channelsParam = channels ? channels.join(',') : undefined;
  const response = await axios.get(`${API_BASE()}/waveform_overview/${fileId}`, {
    params: { samples_per_second: samplesPerSecond, channels: channelsParam },
  });

  return response.data;
}

/**
 * 验证信号表达式
 */
export async function validateSignalExpression(
  expression: string,
  channelNames: string[]
): Promise<SignalValidation> {
  const response = await axios.post(`${API_BASE()}/signals/validate`, {
    expression,
    channel_names: channelNames,
  });

  return response.data;
}

/**
 * 计算派生信号
 */
export async function calculateSignals(
  fileId: string,
  signals: Array<{
    id: string;
    expression: string;
    operands: Array<{
      id: string;
      channelName: string;
      channelIndex: number;
      coefficient?: number;
    }>;
  }>,
  start: number,
  duration: number
): Promise<SignalComputationResult[]> {
  const response = await axios.post(`${API_BASE()}/signals/calculate`, {
    file_id: fileId,
    signals,
    start,
    duration,
  });

  return response.data.results;
}

