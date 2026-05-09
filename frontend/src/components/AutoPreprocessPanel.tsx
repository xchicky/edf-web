/**
 * AutoPreprocessPanel.tsx
 *
 * 自动预处理流水线面板组件
 *
 * 功能：
 * - 配置预处理参数（重参考、Notch滤波、带通滤波、伪迹检测）
 * - 执行自动预处理
 * - 展示预处理结果（通道类型、伪迹摘要、伪迹详情）
 */

import { useState } from 'react';
import {
  DEFAULT_AUTO_PREPROCESS_CONFIG,
  ARTIFACT_LABELS,
  ARTIFACT_COLORS,
} from '../types/analysis';
import type {
  AutoPreprocessConfig,
  AutoPreprocessResponse,
  ArtifactType,
} from '../types/analysis';
import { runAutoPreprocess } from '../api/edf';
import styles from './AutoPreprocessPanel.module.css';

interface AutoPreprocessPanelProps {
  fileId: string | null;
  channelNames: string[];
}

export function AutoPreprocessPanel({ fileId, channelNames }: AutoPreprocessPanelProps) {
  const [config, setConfig] = useState<AutoPreprocessConfig>(DEFAULT_AUTO_PREPROCESS_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AutoPreprocessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 空状态
  if (!fileId) {
    return (
      <div className={styles.container} data-testid="auto-preprocess-panel">
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>⚙️</span>
          <span className={styles.emptyText}>请先加载 EDF 文件</span>
        </div>
      </div>
    );
  }

  const handleConfigChange = <K extends keyof AutoPreprocessConfig>(
    key: K,
    value: AutoPreprocessConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await runAutoPreprocess(fileId, config);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预处理失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setConfig(DEFAULT_AUTO_PREPROCESS_CONFIG);
  };

  // 通道类型统计
  const channelTypeStats = result?.channel_types
    ? Object.values(result.channel_types).reduce(
        (acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

  return (
    <div className={styles.container} data-testid="auto-preprocess-panel">
      <div className={styles.header}>
        <h3 className={styles.title}>自动预处理</h3>
        <span className={styles.channelInfo}>{channelNames.length} 个通道</span>
      </div>

      <div className={styles.content}>
        {/* 配置区域 */}
        <div className={styles.configSection}>
          <h4 className={styles.sectionTitle}>预处理配置</h4>

          {/* 重参考 */}
          <div className={styles.configRow}>
            <label className={styles.label}>重参考:</label>
            <select
              className={styles.select}
              value={config.reference}
              onChange={(e) => handleConfigChange('reference', e.target.value as AutoPreprocessConfig['reference'])}
              aria-label="重参考方法"
            >
              <option value="average">平均参考</option>
              <option value="linked-mastoid">乳突参考</option>
            </select>
          </div>

          {/* Notch 滤波 */}
          <div className={styles.configRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.notch_filter}
                onChange={(e) => handleConfigChange('notch_filter', e.target.checked)}
                aria-label="Notch 滤波"
              />
              Notch 滤波 (50Hz)
            </label>
          </div>

          {/* 带通滤波 */}
          <div className={styles.configRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.bandpass_enabled}
                onChange={(e) => handleConfigChange('bandpass_enabled', e.target.checked)}
              />
              带通滤波
            </label>
          </div>
          {config.bandpass_enabled && (
            <div className={styles.subConfig}>
              <label className={styles.inlineLabel}>
                低截止 (Hz):
                <input
                  type="number"
                  className={styles.numberInput}
                  value={config.bandpass_low}
                  onChange={(e) => handleConfigChange('bandpass_low', parseFloat(e.target.value))}
                  min={0.1}
                  max={10}
                  step={0.1}
                  aria-label="低截止频率"
                />
              </label>
              <label className={styles.inlineLabel}>
                高截止 (Hz):
                <input
                  type="number"
                  className={styles.numberInput}
                  value={config.bandpass_high}
                  onChange={(e) => handleConfigChange('bandpass_high', parseFloat(e.target.value))}
                  min={10}
                  max={100}
                  step={1}
                  aria-label="高截止频率"
                />
              </label>
            </div>
          )}

          {/* 伪迹检测 */}
          <div className={styles.configRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.artifact_detection}
                onChange={(e) => handleConfigChange('artifact_detection', e.target.checked)}
                aria-label="伪迹检测"
              />
              伪迹检测
            </label>
          </div>

          {/* 可选分析 */}
          <div className={styles.divider} />
          <h5 className={styles.subTitle}>可选分析</h5>

          <div className={styles.configRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.run_band_analysis}
                onChange={(e) => handleConfigChange('run_band_analysis', e.target.checked)}
              />
              频段分析
            </label>
          </div>

          <div className={styles.configRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={config.run_anomaly_detection}
                onChange={(e) => handleConfigChange('run_anomaly_detection', e.target.checked)}
                aria-label="异常检测"
              />
              异常检测
            </label>
          </div>
          {config.run_anomaly_detection && (
            <div className={styles.subConfig}>
              <label className={styles.inlineLabel}>
                灵敏度:
                <input
                  type="number"
                  className={styles.numberInput}
                  value={config.anomaly_sensitivity}
                  onChange={(e) => handleConfigChange('anomaly_sensitivity', parseFloat(e.target.value))}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  aria-label="灵敏度"
                />
              </label>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className={styles.actions}>
          <button
            className={styles.executeButton}
            onClick={handleExecute}
            disabled={isLoading}
            data-testid="preprocess-execute-btn"
          >
            {isLoading ? '处理中...' : '执行预处理'}
          </button>
          {result && (
            <button className={styles.resetButton} onClick={handleReset}>
              重置
            </button>
          )}
        </div>

        {/* 错误显示 */}
        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}

        {/* 结果展示 */}
        {result && (
          <div className={styles.result}>
            <div className={styles.resultHeader}>
              <h4 className={styles.resultTitle}>✓ 预处理完成</h4>
              <span className={styles.processingTime}>{result.processing_time.toFixed(2)} 秒</span>
            </div>

            {/* 通道类型 */}
            <div className={styles.resultSection}>
              <h5 className={styles.resultSectionTitle}>通道类型</h5>
              <div className={styles.channelTypeList}>
                {Object.entries(channelTypeStats).map(([type, count]) => (
                  <span key={type} className={styles.channelTypeBadge}>
                    {type.toUpperCase()}: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* 伪迹摘要 */}
            <div className={styles.resultSection}>
              <h5 className={styles.resultSectionTitle}>伪迹摘要</h5>
              {Object.keys(result.artifact_summary).length > 0 ? (
                <div className={styles.artifactSummary}>
                  {Object.entries(result.artifact_summary).map(([type, count]) => (
                    <span
                      key={type}
                      className={styles.artifactBadge}
                      style={{
                        backgroundColor: `${ARTIFACT_COLORS[type as ArtifactType]}20`,
                        borderColor: ARTIFACT_COLORS[type as ArtifactType],
                      }}
                    >
                      {ARTIFACT_LABELS[type as ArtifactType] || type}: {count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.noArtifact}>未检测到伪迹</p>
              )}
            </div>

            {/* 伪迹详情 */}
            {result.artifacts.length > 0 && (
              <div className={styles.resultSection}>
                <h5 className={styles.resultSectionTitle}>伪迹详情</h5>
                <ul className={styles.artifactList}>
                  {result.artifacts.map((artifact, index) => (
                    <li key={index} className={styles.artifactItem}>
                      <span
                        className={styles.artifactType}
                        style={{ color: ARTIFACT_COLORS[artifact.artifact_type as ArtifactType] }}
                      >
                        {ARTIFACT_LABELS[artifact.artifact_type as ArtifactType] || artifact.artifact_type}
                      </span>
                      <span className={styles.artifactChannel}>{artifact.channel}</span>
                      <span className={styles.artifactTime}>
                        {artifact.start_time.toFixed(1)}s - {artifact.end_time.toFixed(1)}s
                      </span>
                      <span className={styles.artifactSeverity}>
                        {(artifact.severity * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
