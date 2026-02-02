import React, { useMemo } from 'react';
import type { WaveformData } from '../store/edfStore';

interface SelectionInfoProps {
  selectionStart: number | null;
  selectionEnd: number | null;
  waveformData: WaveformData | null;
  onClose: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// 找到最接近目标时间的索引
function findClosestIndex(times: number[], targetTime: number): number {
  let left = 0;
  let right = times.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (times[mid] < targetTime) {
      left = mid + 1;
    } else if (times[mid] > targetTime) {
      right = mid - 1;
    } else {
      return mid;
    }
  }

  // 返回最接近的索引
  if (left === 0) return 0;
  if (left === times.length) return times.length - 1;
  return Math.abs(times[left] - targetTime) < Math.abs(times[left - 1] - targetTime) ? left : left - 1;
}

interface ChannelStats {
  channel: string;
  min: number;
  max: number;
  mean: number;
  range: number;
}

export const SelectionInfo: React.FC<SelectionInfoProps> = ({
  selectionStart,
  selectionEnd,
  waveformData,
  onClose,
}) => {
  const selectionStats = useMemo(() => {
    if (!selectionStart || !selectionEnd || !waveformData) return null;

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const duration = end - start;

    // 为每个通道计算统计信息
    const channelStats: ChannelStats[] = waveformData.channels.map((channel, i) => {
      const data = waveformData.data[i];
      const times = waveformData.times;

      // 找到选区对应的数据点
      const startIndex = findClosestIndex(times, start);
      const endIndex = findClosestIndex(times, end);
      const selectedData = data.slice(startIndex, endIndex + 1);

      if (selectedData.length === 0) {
        return { channel, min: 0, max: 0, mean: 0, range: 0 };
      }

      const min = Math.min(...selectedData);
      const max = Math.max(...selectedData);
      const sum = selectedData.reduce((a, b) => a + b, 0);
      const mean = sum / selectedData.length;

      return {
        channel,
        min,
        max,
        mean,
        range: max - min,
      };
    });

    return {
      start,
      end,
      duration,
      channelStats,
    };
  }, [selectionStart, selectionEnd, waveformData]);

  if (!selectionStats) return null;

  return (
    <div className="selection-info">
      <div className="selection-info-header">
        <h4>选区统计</h4>
        <button
          className="selection-info-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="selection-info-content">
        <div className="selection-info-row">
          <span className="selection-info-label">起始时间:</span>
          <span className="selection-info-value">{formatTime(selectionStats.start)}</span>
        </div>
        <div className="selection-info-row">
          <span className="selection-info-label">结束时间:</span>
          <span className="selection-info-value">{formatTime(selectionStats.end)}</span>
        </div>
        <div className="selection-info-row">
          <span className="selection-info-label">选区时长:</span>
          <span className="selection-info-value">{selectionStats.duration.toFixed(3)} s</span>
        </div>
        <div className="selection-info-divider"></div>
        <div className="channel-stats-list">
          {selectionStats.channelStats.map((stat) => (
            <div key={stat.channel} className="channel-stat">
              <div className="channel-stat-name">{stat.channel}</div>
              <div className="channel-stat-details">
                <div className="channel-stat-item">
                  <span className="channel-stat-label">最小:</span>
                  <span className="channel-stat-value">{stat.min.toFixed(1)} µV</span>
                </div>
                <div className="channel-stat-item">
                  <span className="channel-stat-label">最大:</span>
                  <span className="channel-stat-value">{stat.max.toFixed(1)} µV</span>
                </div>
                <div className="channel-stat-item">
                  <span className="channel-stat-label">平均:</span>
                  <span className="channel-stat-value">{stat.mean.toFixed(1)} µV</span>
                </div>
                <div className="channel-stat-item">
                  <span className="channel-stat-label">范围:</span>
                  <span className="channel-stat-value">{stat.range.toFixed(1)} µV</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
