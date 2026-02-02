import React, { useMemo } from 'react';
import type { AnalysisResult } from '../types/analysis';
import { EEG_BANDS, type EEGBandName } from '../types/analysis';

interface FrequencyViewProps {
  results: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const formatPower = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}k`;
  }
  if (value >= 100) {
    return value.toFixed(1);
  }
  if (value >= 10) {
    return value.toFixed(2);
  }
  return value.toFixed(3);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// 计算跨通道平均功率
interface BandPowerSummary {
  absolute: number;
  relative: number;
  count: number;
}

export const FrequencyView: React.FC<FrequencyViewProps> = ({
  results,
  isLoading,
  error,
  onClose,
}) => {
  // 计算汇总统计（跨通道平均）
  const bandSummary = useMemo<Record<EEGBandName, BandPowerSummary>>(() => {
    if (!results?.frequency?.bandPowers) {
      return {
        delta: { absolute: 0, relative: 0, count: 0 },
        theta: { absolute: 0, relative: 0, count: 0 },
        alpha: { absolute: 0, relative: 0, count: 0 },
        beta: { absolute: 0, relative: 0, count: 0 },
        gamma: { absolute: 0, relative: 0, count: 0 },
      };
    }

    const summary: Record<string, { absolute: number; relative: number; count: number }> = {};

    // 初始化
    for (const band of Object.keys(EEG_BANDS)) {
      summary[band] = { absolute: 0, relative: 0, count: 0 };
    }

    // 累加各通道数据
    for (const channelData of Object.values(results.frequency.bandPowers)) {
      for (const [band, data] of Object.entries(channelData)) {
        if (summary[band]) {
          summary[band].absolute += data.absolute;
          summary[band].relative += data.relative;
          summary[band].count += 1;
        }
      }
    }

    // 计算平均
    for (const band of Object.keys(summary)) {
      if (summary[band].count > 0) {
        summary[band].absolute /= summary[band].count;
        summary[band].relative /= summary[band].count;
      }
    }

    return summary as Record<EEGBandName, BandPowerSummary>;
  }, [results]);

  if (isLoading) {
    return (
      <div className="stats-view">
        <div className="stats-view-header">
          <h4>分析中...</h4>
        </div>
        <div className="stats-view-content">
          <div className="stats-loading">正在计算频带功率...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-view">
        <div className="stats-view-header">
          <h4>分析错误</h4>
          <button className="stats-view-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="stats-view-content">
          <div className="stats-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!results || !results.frequency?.bandPowers) {
    return null;
  }

  const channels = Object.keys(results.frequency.bandPowers);
  const bands: EEGBandName[] = ['delta', 'theta', 'alpha', 'beta', 'gamma'];

  return (
    <div className="stats-view">
      <div className="stats-view-header">
        <h4>频带功率分析</h4>
        <button className="stats-view-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
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
              <span className="stats-info-value">{channels.length}</span>
            </div>
          </div>
        </div>

        {/* 汇总频带功率（跨通道平均） */}
        <div className="stats-section">
          <div className="stats-section-title">平均频带功率 (跨通道)</div>
          <div className="freq-bands-summary">
            {bands.map((band) => {
              const bandInfo = EEG_BANDS[band];
              const summary = bandSummary[band];
              const relativePercent = summary.relative * 100;

              return (
                <div key={band} className="freq-band-summary-item">
                  <div className="freq-band-header">
                    <span className="freq-band-name" style={{ color: bandInfo.color }}>
                      {bandInfo.label}
                    </span>
                    <span className="freq-band-range">
                      {bandInfo.range[0]}-{bandInfo.range[1]} Hz
                    </span>
                  </div>
                  <div className="freq-band-bar-container">
                    <div
                      className="freq-band-bar-fill"
                      style={{
                        width: `${relativePercent}%`,
                        backgroundColor: bandInfo.color,
                      }}
                    />
                  </div>
                  <div className="freq-band-values">
                    <span className="freq-band-absolute">{formatPower(summary.absolute)} µV²</span>
                    <span className="freq-band-relative">{formatPercent(summary.relative)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 各通道频带功率 */}
        <div className="stats-section">
          <div className="stats-section-title">通道频带功率</div>
          <div className="channel-freq-list">
            {channels.map((ch) => {
              const channelData = results.frequency!.bandPowers[ch];

              // 计算该通道所有频带功率的总和（用于缩放）
              const channelTotalPower = bands.reduce(
                (sum, band) => sum + (channelData[band]?.absolute || 0),
                0
              );

              return (
                <div key={ch} className="channel-freq-card">
                  <div className="channel-freq-header">{ch}</div>
                  <div className="channel-freq-bands">
                    {bands.map((band) => {
                      const bandInfo = EEG_BANDS[band];
                      const data = channelData[band];

                      if (!data) return null;

                      // 使用总和进行缩放，所有比例条加起来 = 100%
                      const barWidth = channelTotalPower > 0
                        ? (data.absolute / channelTotalPower) * 100
                        : 0;

                      return (
                        <div key={band} className="channel-freq-band">
                          <div className="channel-freq-band-label">
                            <span
                              className="channel-freq-band-name"
                              style={{ color: bandInfo.color }}
                            >
                              {bandInfo.label}
                            </span>
                            <span className="channel-freq-band-range">
                              {bandInfo.range[0]}-{bandInfo.range[1]} Hz
                            </span>
                          </div>
                          <div className="channel-freq-bar-container">
                            <div
                              className="channel-freq-bar-fill"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: bandInfo.color,
                              }}
                            />
                          </div>
                          <div className="channel-freq-values">
                            <span className="channel-freq-absolute">
                              {formatPower(data.absolute)} µV²
                            </span>
                            <span className="channel-freq-relative">
                              {formatPercent(data.relative)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
