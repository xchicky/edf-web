import React from 'react';
import type { AnalysisResult } from '../types/analysis';

interface StatsViewProps {
  results: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  hideCloseButton?: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const formatValue = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals);
};

export const StatsView: React.FC<StatsViewProps> = ({
  results,
  isLoading,
  error,
  onClose,
  hideCloseButton = false,
}) => {
  if (isLoading) {
    return (
      <div className="stats-view">
        <div className="stats-view-header">
          <h4>分析中...</h4>
        </div>
        <div className="stats-view-content">
          <div className="stats-loading">正在计算统计量...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-view">
        <div className="stats-view-header">
          <h4>分析错误</h4>
          {!hideCloseButton && (
            <button className="stats-view-close" onClick={onClose} aria-label="关闭">
              ×
            </button>
          )}
        </div>
        <div className="stats-view-content">
          <div className="stats-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!results || !results.timeDomain) {
    return null;
  }

  const channels = Object.keys(results.timeDomain);

  return (
    <div className="stats-view">
      <div className="stats-view-header">
        <h4>选区分析</h4>
        {!hideCloseButton && (
          <button className="stats-view-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        )}
      </div>
      <div className="stats-view-content">
        {/* 选区信息 */}
        <div className="stats-section">
          <div className="stats-section-title">选区信息</div>
          <div className="stats-info-grid">
            <div className="stats-info-item">
              <span className="stats-info-label">起始:</span>
              <span className="stats-info-value">{formatTime(results.selectionStart)}</span>
            </div>
            <div className="stats-info-item">
              <span className="stats-info-label">结束:</span>
              <span className="stats-info-value">{formatTime(results.selectionEnd)}</span>
            </div>
            <div className="stats-info-item">
              <span className="stats-info-label">时长:</span>
              <span className="stats-info-value">{results.duration.toFixed(3)} s</span>
            </div>
            <div className="stats-info-item">
              <span className="stats-info-label">通道:</span>
              <span className="stats-info-value">{channels.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* 通道统计 */}
        <div className="stats-section">
          <div className="stats-section-title">通道统计</div>
          <div className="channel-stats-list">
            {channels.map((ch) => {
              const stats = results.timeDomain![ch];
              return (
                <div key={ch} className="channel-stat-card">
                  <div className="channel-stat-header">{ch}</div>
                  <div className="channel-stat-grid">
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">最小:</span>
                      <span className="channel-stat-value">{formatValue(stats.min)} µV</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">最大:</span>
                      <span className="channel-stat-value">{formatValue(stats.max)} µV</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">平均:</span>
                      <span className="channel-stat-value">{formatValue(stats.mean)} µV</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">标准差:</span>
                      <span className="channel-stat-value">{formatValue(stats.std)} µV</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">RMS:</span>
                      <span className="channel-stat-value">{formatValue(stats.rms)} µV</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">峰峰值:</span>
                      <span className="channel-stat-value">{formatValue(stats.peakToPeak)} µV</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">峰度:</span>
                      <span className="channel-stat-value">{formatValue(stats.kurtosis)}</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">偏度:</span>
                      <span className="channel-stat-value">{formatValue(stats.skewness)}</span>
                    </div>
                    <div className="channel-stat-row">
                      <span className="channel-stat-label">样本数:</span>
                      <span className="channel-stat-value">{stats.nSamples}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
