/**
 * SignalComparisonView - 信号波形对比视图
 *
 * 并排显示原始信号和预处理后信号的波形，支持同步缩放和平移
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PreprocessConfig } from '../../types/analysis';
import { getWaveform } from '../../api/edf';
import type { WaveformData } from '../../api/edf';
import styles from './SignalComparisonView.module.css';

interface SignalComparisonViewProps {
  fileId: string;
  selectionStart: number;
  selectionEnd: number;
  channels: string[];
  preprocessConfig: PreprocessConfig;
  height?: number;
}

export const SignalComparisonView: React.FC<SignalComparisonViewProps> = ({
  fileId,
  selectionStart,
  selectionEnd,
  channels,
  preprocessConfig,
  height = 400,
}) => {
  const [originalWaveform, setOriginalWaveform] = useState<WaveformData | null>(null);
  const [preprocessedWaveform, setPreprocessedWaveform] = useState<WaveformData | null>(null);
  const [originalLoading, setOriginalLoading] = useState(true);
  const [preprocessedLoading, setPreprocessedLoading] = useState(true);
  const [originalError, setOriginalError] = useState<string | null>(null);
  const [preprocessedError, setPreprocessedError] = useState<string | null>(null);

  // 缩放和平移状态
  const [amplitudeScale, setAmplitudeScale] = useState(1);
  const [timeOffset, setTimeOffset] = useState(0);

  // Canvas 引用
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const preprocessedCanvasRef = useRef<HTMLCanvasElement>(null);

  // 获取原始波形数据
  const fetchOriginalWaveform = useCallback(async () => {
    setOriginalLoading(true);
    setOriginalError(null);
    try {
      const duration = selectionEnd - selectionStart;
      const channelIndices = channels.map((_, i) => i);

      const data = await getWaveform(fileId, selectionStart, duration, channelIndices);
      setOriginalWaveform(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取原始波形失败';
      setOriginalError(errorMessage);
    } finally {
      setOriginalLoading(false);
    }
  }, [fileId, selectionStart, selectionEnd, channels]);

  // 获取预处理后波形数据
  // 注意：当前 API 可能不支持直接获取预处理后的波形
  // 这里我们先使用相同的原始数据，后续需要扩展后端 API
  const fetchPreprocessedWaveform = useCallback(async () => {
    setPreprocessedLoading(true);
    setPreprocessedError(null);
    try {
      const duration = selectionEnd - selectionStart;
      const channelIndices = channels.map((_, i) => i);

      // TODO: 需要后端支持在波形 API 中传递预处理配置
      // 目前使用原始数据作为占位符
      const data = await getWaveform(fileId, selectionStart, duration, channelIndices);

      // 如果有预处理方法，对数据进行简单的前端预处理
      let processedData = data;
      if (preprocessConfig.method !== 'none') {
        processedData = applyPreprocessing(data, preprocessConfig);
      }

      setPreprocessedWaveform(processedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取预处理后波形失败';
      setPreprocessedError(errorMessage);
    } finally {
      setPreprocessedLoading(false);
    }
  }, [fileId, selectionStart, selectionEnd, channels, preprocessConfig]);

  // 应用前端预处理（临时方案）
  const applyPreprocessing = (data: WaveformData, config: PreprocessConfig): WaveformData => {
    const processed = { ...data };
    processed.data = data.data.map((channelData) => {
      let result = [...channelData];

      switch (config.method) {
        case 'linear_detrend':
          // 简单的线性去漂移
          result = removeLinearTrend(result);
          break;
        case 'polynomial_detrend':
          // 多项式去漂移
          const order = (config.parameters?.order as number) ?? 2;
          result = removePolynomialTrend(result, order);
          break;
        case 'highpass_filter':
          // 高通滤波 - 简化版本，实际应使用更复杂的滤波算法
          const cutoff = (config.parameters?.cutoff as number) ?? 0.5;
          result = simpleHighpassFilter(result, data.sfreq, cutoff);
          break;
        case 'baseline_correction':
          // 基线校正
          result = removeBaseline(result);
          break;
        default:
          break;
      }

      return result;
    });

    return processed;
  };

  // 移除线性趋势
  const removeLinearTrend = (data: number[]): number[] => {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return data.map((y, i) => y - (slope * i + intercept));
  };

  // 移除多项式趋势
  const removePolynomialTrend = (data: number[], order: number): number[] => {
    // 简化版本：使用 Savitzky-Golay 滤波器进行平滑
    // 实际实现应使用更精确的多项式拟合
    return removeBaseline(data); // 临时使用基线校正
  };

  // 简单高通滤波器
  const simpleHighpassFilter = (data: number[], sfreq: number, cutoff: number): number[] => {
    // 简化的高通滤波实现
    // 实际应使用 scipy.signal.butter 等专业滤波器
    const rc = 1.0 / (2 * Math.PI * cutoff);
    const dt = 1.0 / sfreq;
    const alpha = rc / (rc + dt);

    const result = [...data];
    for (let i = 1; i < result.length; i++) {
      result[i] = alpha * (result[i - 1] + result[i] - data[i - 1]);
    }
    return result;
  };

  // 移除基线
  const removeBaseline = (data: number[]): number[] => {
    // 计算移动平均作为基线
    const windowSize = Math.max(10, Math.floor(data.length / 10));
    const baseline: number[] = [];

    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - windowSize); j < Math.min(data.length, i + windowSize); j++) {
        sum += data[j];
        count++;
      }

      baseline.push(sum / count);
    }

    return data.map((val, i) => val - baseline[i]);
  };

  // 初始加载
  useEffect(() => {
    fetchOriginalWaveform();
    fetchPreprocessedWaveform();
  }, [fetchOriginalWaveform, fetchPreprocessedWaveform]);

  // 绘制波形
  useEffect(() => {
    if (originalWaveform && originalCanvasRef.current) {
      drawWaveform(originalCanvasRef.current, originalWaveform, amplitudeScale, timeOffset, false);
    }
  }, [originalWaveform, amplitudeScale, timeOffset]);

  useEffect(() => {
    if (preprocessedWaveform && preprocessedCanvasRef.current) {
      drawWaveform(preprocessedCanvasRef.current, preprocessedWaveform, amplitudeScale, timeOffset, true);
    }
  }, [preprocessedWaveform, amplitudeScale, timeOffset]);

  // 绘制波形函数
  const drawWaveform = (
    canvas: HTMLCanvasElement,
    waveformData: WaveformData,
    scale: number,
    offset: number,
    isPreprocessed: boolean
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const channelCount = waveformData.channels.length;
    const channelHeight = height / channelCount;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制背景
    ctx.fillStyle = isPreprocessed ? '#f0f9ff' : '#fafafa';
    ctx.fillRect(0, 0, width, height);

    // 绘制每个通道
    waveformData.data.forEach((channelData, channelIndex) => {
      const yOffset = channelIndex * channelHeight;
      const centerY = yOffset + channelHeight / 2;

      // 绘制通道分隔线
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yOffset + channelHeight);
      ctx.lineTo(width, yOffset + channelHeight);
      ctx.stroke();

      // 绘制通道标签
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.fillText(waveformData.channels[channelIndex], 5, yOffset + 15);

      // 计算数据范围
      const minVal = Math.min(...channelData);
      const maxVal = Math.max(...channelData);
      const range = maxVal - minVal || 1;

      // 绘制波形
      ctx.strokeStyle = isPreprocessed ? '#3b82f6' : '#1f2937';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const samplesPerPixel = Math.max(1, Math.floor(channelData.length / width));

      for (let x = 0; x < width; x++) {
        const startIndex = Math.floor((x / width) * channelData.length);
        const endIndex = Math.min(channelData.length, startIndex + samplesPerPixel);

        // 计算该像素位置的平均值
        let sum = 0;
        let count = 0;
        for (let i = startIndex; i < endIndex; i++) {
          sum += channelData[i];
          count++;
        }

        if (count > 0) {
          const avgValue = sum / count;
          const normalizedValue = (avgValue - minVal) / range;
          const y = centerY - (normalizedValue - 0.5) * channelHeight * scale;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.stroke();
    });
  };

  // 处理缩放
  const handleZoomIn = () => {
    setAmplitudeScale((prev) => Math.min(10, prev + 0.5));
  };

  const handleZoomOut = () => {
    setAmplitudeScale((prev) => Math.max(0.1, prev - 0.5));
  };

  const handleReset = () => {
    setAmplitudeScale(1);
    setTimeOffset(0);
  };

  return (
    <div className={styles.container}>
      {/* 控制栏 */}
      <div className={styles.controls}>
        <button onClick={handleZoomIn} className={styles.controlButton} title="放大">
          +
        </button>
        <button onClick={handleZoomOut} className={styles.controlButton} title="缩小">
          -
        </button>
        <span className={styles.scaleLabel}>
          缩放: {amplitudeScale.toFixed(1)}x
        </span>
        <button onClick={handleReset} className={styles.controlButton} title="重置">
          重置
        </button>
      </div>

      {/* 波形对比区域 */}
      <div className={styles.waveforms}>
        {/* 原始信号 */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>原始信号</h3>
            <span className={`${styles.badge} ${styles.badgeOriginal}`}>无预处理</span>
          </div>
          <div className={styles.panelContent}>
            {originalLoading && <div className={styles.loading}>加载中...</div>}
            {originalError && <div className={styles.error}>{originalError}</div>}
            {!originalLoading && !originalError && !originalWaveform && (
              <div className={styles.empty}>无数据</div>
            )}
            {!originalLoading && !originalError && originalWaveform && (
              <canvas
                ref={originalCanvasRef}
                width={600}
                height={height}
                className={styles.canvas}
              />
            )}
          </div>
        </div>

        {/* 预处理后信号 */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>预处理后信号</h3>
            <span className={`${styles.badge} ${styles.badgePreprocessed}`}>
              {preprocessConfig.method === 'none' ? '无预处理' : '已应用预处理'}
            </span>
          </div>
          <div className={styles.panelContent}>
            {preprocessedLoading && <div className={styles.loading}>加载中...</div>}
            {preprocessedError && <div className={styles.error}>{preprocessedError}</div>}
            {!preprocessedLoading && !preprocessedError && !preprocessedWaveform && (
              <div className={styles.empty}>无数据</div>
            )}
            {!preprocessedLoading && !preprocessedError && preprocessedWaveform && (
              <canvas
                ref={preprocessedCanvasRef}
                width={600}
                height={height}
                className={styles.canvas}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalComparisonView;
