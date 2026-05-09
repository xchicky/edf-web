import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { detectAnomalies } from '../api/edf';
import {
  ANOMALY_LABELS,
  ANOMALY_COLORS,
} from '../types/analysis';
import type {
  AnomalyType,
  AnomalyEvent,
  AnomalyDetectionRequest,
} from '../types/analysis';
import styles from './AnomalyDetectionPanel.module.css';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return mins > 0
    ? `${mins}:${parseFloat(secs).toFixed(1).padStart(4, '0')}`
    : `${secs}s`;
};

// 灵敏度选项映射
const SENSITIVITY_OPTIONS = [
  { value: 0.5, label: '低灵敏度' },
  { value: 1.0, label: '中等灵敏度' },
  { value: 1.5, label: '高灵敏度' },
] as const;

interface AnomalyDetectionPanelProps {
  fileId: string | null;
  channels: string[];
  duration: number;
  onJumpToTime?: (time: number) => void;
}

export function AnomalyDetectionPanel({
  fileId,
  channels,
  duration,
  onJumpToTime,
}: AnomalyDetectionPanelProps) {
  // 配置状态
  const [start, setStart] = useState(0);
  const [analysisDuration, setAnalysisDuration] = useState(10);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [runPreprocess, setRunPreprocess] = useState(true);

  // 结果过滤状态
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [collapsedChannels, setCollapsedChannels] = useState<Record<string, boolean>>({});

  // 异常检测 mutation
  const {
    mutate: runDetection,
    isPending,
    data: result,
    error,
    reset,
  } = useMutation({
    mutationFn: (request: AnomalyDetectionRequest) => {
      if (!fileId) throw new Error('No file loaded');
      return detectAnomalies(fileId, request);
    },
  });

  // 执行检测
  const handleDetect = useCallback(() => {
    const request: AnomalyDetectionRequest = {
      start,
      duration: analysisDuration,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
      sensitivity,
      run_preprocess: runPreprocess,
    };
    runDetection(request);
  }, [start, analysisDuration, selectedChannels, sensitivity, runPreprocess, runDetection]);

  // 切换通道选择
  const toggleChannel = useCallback((channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  }, []);

  // 全选/取消全选通道
  const toggleAllChannels = useCallback(() => {
    if (selectedChannels.length === channels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels([...channels]);
    }
  }, [channels, selectedChannels.length]);

  // 切换通道折叠状态
  const toggleChannelCollapse = useCallback((channel: string) => {
    setCollapsedChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  }, []);

  // 过滤后的结果
  const filteredResult = useMemo(() => {
    if (!result) return null;

    const filteredChannels = result.channels.map((ch) => ({
      ...ch,
      anomalies: typeFilter === 'all'
        ? ch.anomalies
        : ch.anomalies.filter((a) => a.type === typeFilter),
    })).filter((ch) => ch.anomalies.length > 0);

    const totalAnomalies = filteredChannels.reduce(
      (sum, ch) => sum + ch.anomalies.length,
      0
    );

    return {
      ...result,
      channels: filteredChannels,
      totalAnomalies,
    };
  }, [result, typeFilter]);

  // 统计各类型异常数量
  const anomalyTypeStats = useMemo(() => {
    if (!result) return null;

    const stats: Record<AnomalyType, number> = {
      spike: 0,
      sharp_wave: 0,
      spike_and_slow: 0,
      slow_wave: 0,
      rhythmic: 0,
    };

    result.channels.forEach((ch) => {
      ch.anomalies.forEach((a) => {
        stats[a.type]++;
      });
    });

    return stats;
  }, [result]);

  if (!fileId) {
    return (
      <div className={styles.container} data-testid="anomaly-detection-panel">
        <div className={styles.header}>异常检测</div>
        <div className={styles.emptyState}>
          请先加载 EDF 文件
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="anomaly-detection-panel">
      <div className={styles.header}>异常波形检测</div>

      {/* 配置区域 */}
      <div className={styles.configSection}>
        <div className={styles.configRow}>
          <label className={styles.configLabel}>
            起始时间 (秒)
            <input
              type="number"
              className={styles.configInput}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              min={0}
              max={Math.max(0, duration - analysisDuration)}
              step={1}
            />
          </label>
          <label className={styles.configLabel}>
            分析时长 (秒)
            <input
              type="number"
              className={styles.configInput}
              value={analysisDuration}
              onChange={(e) => setAnalysisDuration(Number(e.target.value))}
              min={1}
              max={duration}
              step={1}
            />
          </label>
        </div>

        <div className={styles.configRow}>
          <label className={styles.configLabel}>
            检测灵敏度
            <select
              className={styles.configSelect}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
            >
              {SENSITIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={runPreprocess}
              onChange={(e) => setRunPreprocess(e.target.checked)}
            />
            自动预处理
          </label>
        </div>

        {/* 通道选择 */}
        <div className={styles.channelSection}>
          <div className={styles.channelHeader}>
            <span>选择通道</span>
            <button
              className={styles.toggleAllButton}
              onClick={toggleAllChannels}
            >
              {selectedChannels.length === channels.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className={styles.channelGrid}>
            {channels.map((channel) => (
              <label key={channel} className={styles.channelCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
                <span>{channel}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 执行按钮 */}
        <div className={styles.actionRow}>
          <button
            className={styles.detectButton}
            onClick={handleDetect}
            disabled={isPending}
            data-testid="anomaly-detect-btn"
          >
            {isPending ? (
              <>
                <span className={styles.spinner} />
                检测中...
              </>
            ) : (
              '开始检测'
            )}
          </button>
          {result && (
            <button
              className={styles.resetButton}
              onClick={reset}
              data-testid="anomaly-reset-btn"
              disabled={isPending}
            >
              重置
            </button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorBox}>
          检测失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {/* 结果区域 */}
      {filteredResult && (
        <div className={styles.resultSection}>
          <div className={styles.resultSummary}>
            检测完成 · 共发现 <strong>{filteredResult.total_anomalies}</strong> 个异常
            <span className={styles.processingTime}>
              耗时 {filteredResult.processing_time.toFixed(2)}s
            </span>
          </div>

          {/* 类型过滤器 */}
          {anomalyTypeStats && (
            <div className={styles.typeFilterBar}>
              <button
                className={`${styles.typeFilterBtn} ${typeFilter === 'all' ? styles.active : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                全部 ({Object.values(anomalyTypeStats).reduce((a, b) => a + b, 0)})
              </button>
              {(Object.keys(anomalyTypeStats) as AnomalyType[]).map((type) => {
                const count = anomalyTypeStats[type];
                if (count === 0) return null;
                return (
                  <button
                    key={type}
                    className={`${styles.typeFilterBtn} ${typeFilter === type ? styles.active : ''}`}
                    onClick={() => setTypeFilter(type)}
                    style={{ '--type-color': ANOMALY_COLORS[type] } as React.CSSProperties}
                  >
                    <span
                      className={styles.typeDot}
                      style={{ backgroundColor: ANOMALY_COLORS[type] }}
                    />
                    {ANOMALY_LABELS[type]} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* 按通道分组的结果列表 */}
          <div className={styles.channelList}>
            {filteredResult.channels.length === 0 ? (
              <div className={styles.noResults}>
                {typeFilter === 'all'
                  ? '未检测到异常波形'
                  : `未检测到 ${ANOMALY_LABELS[typeFilter]}`}
              </div>
            ) : (
              filteredResult.channels.map((ch) => {
                const isCollapsed = collapsedChannels[ch.channel] ?? false;
                return (
                  <div key={ch.channel} className={styles.channelGroup}>
                    <div
                      className={styles.channelGroupHeader}
                      onClick={() => toggleChannelCollapse(ch.channel)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          toggleChannelCollapse(ch.channel);
                      }}
                    >
                      <span className={styles.collapseIcon}>
                        {isCollapsed ? '▶' : '▼'}
                      </span>
                      <span className={styles.channelName}>{ch.channel}</span>
                      <span className={styles.anomalyCount}>
                        {ch.anomalies.length} 个异常
                      </span>
                      <span className={styles.anomalyRate}>
                        异常率: {(ch.anomaly_rate * 100).toFixed(1)}%
                      </span>
                    </div>

                    {!isCollapsed && (
                      <div className={styles.anomalyList}>
                        {ch.anomalies.map((anomaly, idx) => (
                          <AnomalyItem
                            key={`${anomaly.onset}-${idx}`}
                            anomaly={anomaly}
                            onJumpToTime={onJumpToTime}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 单个异常事件组件
 */
interface AnomalyItemProps {
  anomaly: AnomalyEvent;
  onJumpToTime?: (time: number) => void;
}

function AnomalyItem({ anomaly, onJumpToTime }: AnomalyItemProps) {
  const handleClick = useCallback(() => {
    onJumpToTime?.(anomaly.onset);
  }, [anomaly.onset, onJumpToTime]);

  return (
    <div
      className={styles.anomalyItem}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      <span
        className={styles.anomalyTypeDot}
        style={{ backgroundColor: ANOMALY_COLORS[anomaly.type] }}
      />
      <span className={styles.anomalyType}>
        {ANOMALY_LABELS[anomaly.type]}
      </span>
      <span className={styles.anomalyTime}>
        {formatTime(anomaly.onset)} - {formatTime(anomaly.onset + anomaly.duration)}
      </span>
      <span className={styles.anomalyConfidence}>
        {(anomaly.confidence * 100).toFixed(0)}%
      </span>
      <span className={styles.anomalyDesc}>
        {anomaly.description}
      </span>
    </div>
  );
}

export default AnomalyDetectionPanel;
