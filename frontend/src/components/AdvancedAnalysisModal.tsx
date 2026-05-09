/**
 * AdvancedAnalysisModal - 高级分析模态框
 *
 * 提供双面板对比视图，用于比较原始信号与预处理后信号的分析结果
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, AnalysisType, PreprocessConfig, PreprocessMethod } from '../types/analysis';
import { PREPROCESS_METHODS } from '../types/analysis';
import { StatsView } from './StatsView';
import { FrequencyView } from './FrequencyView';
import { analyzeTimeDomain, analyzeBandPower } from '../api/edf';
import styles from './AdvancedAnalysisModal.module.css';

interface AdvancedAnalysisModalProps {
  isOpen: boolean;
  fileId: string;
  selectionStart: number;
  selectionEnd: number;
  channelNames: string[];
  initialAnalysisType?: AnalysisType;
  initialPreprocessConfig?: PreprocessConfig;
  onClose: () => void;
}

type PanelType = 'original' | 'preprocessed';

export const AdvancedAnalysisModal: React.FC<AdvancedAnalysisModalProps> = ({
  isOpen,
  fileId,
  selectionStart,
  selectionEnd,
  channelNames,
  initialAnalysisType = 'frequency',
  initialPreprocessConfig = { method: 'none', parameters: null },
  onClose,
}) => {
  // 分析类型（时域/频域）
  const [analysisType, setAnalysisType] = useState<AnalysisType>(initialAnalysisType);

  // 原始信号分析结果
  const [originalResults, setOriginalResults] = useState<AnalysisResult | null>(null);
  const [originalLoading, setOriginalLoading] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);

  // 预处理后信号分析结果
  const [preprocessedResults, setPreprocessedResults] = useState<AnalysisResult | null>(null);
  const [preprocessedLoading, setPreprocessedLoading] = useState(false);
  const [preprocessedError, setPreprocessedError] = useState<string | null>(null);

  // 当前激活的面板（用于响应式布局）
  const [activePanel, setActivePanel] = useState<PanelType>('original');

  // 预处理配置
  const [preprocessConfig, setPreprocessConfig] = useState<PreprocessConfig>(initialPreprocessConfig);

  // 重置状态当模态框打开时
  useEffect(() => {
    if (isOpen) {
      setAnalysisType(initialAnalysisType);
      setPreprocessConfig(initialPreprocessConfig);
      setOriginalResults(null);
      setPreprocessedResults(null);
      setOriginalError(null);
      setPreprocessedError(null);
      setActivePanel('original');
    }
  }, [isOpen, initialAnalysisType, initialPreprocessConfig]);

  // 运行原始信号分析 - 使用 ref 存储最新值，避免 useCallback 依赖导致循环
  const analysisParamsRef = React.useRef({
    fileId,
    selectionStart,
    selectionEnd,
    channelNames,
    analysisType,
    preprocessConfig,
  });

  // 更新 ref
  React.useEffect(() => {
    analysisParamsRef.current = {
      fileId,
      selectionStart,
      selectionEnd,
      channelNames,
      analysisType,
      preprocessConfig,
    };
  }, [fileId, selectionStart, selectionEnd, channelNames, analysisType, preprocessConfig]);

  const runOriginalAnalysis = useCallback(async () => {
    const params = analysisParamsRef.current;
    setOriginalLoading(true);
    setOriginalError(null);
    try {
      const start = Math.min(params.selectionStart, params.selectionEnd);
      const end = Math.max(params.selectionStart, params.selectionEnd);
      const duration = end - start;

      let result: AnalysisResult;

      if (params.analysisType === 'stats') {
        const response = await analyzeTimeDomain(
          params.fileId,
          start,
          duration,
          params.channelNames.length > 0 ? params.channelNames : undefined,
          { method: 'none' }
        );

        const timeDomain: Record<string, any> = {};
        for (const [ch, stats] of Object.entries(response.statistics)) {
          timeDomain[ch] = {
            mean: stats.mean,
            std: stats.std,
            min: stats.min,
            max: stats.max,
            rms: stats.rms,
            peakToPeak: stats.peak_to_peak,
            kurtosis: stats.kurtosis,
            skewness: stats.skewness,
            nSamples: stats.n_samples,
          };
        }

        result = {
          fileId: response.file_id,
          type: 'stats',
          selectionStart: start,
          selectionEnd: end,
          duration,
          timeDomain,
          timestamp: Date.now(),
        };
      } else {
        const response = await analyzeBandPower(
          params.fileId,
          start,
          duration,
          params.channelNames.length > 0 ? params.channelNames : undefined,
          undefined,
          { method: 'none' }
        );

        const bandPowers: Record<string, Record<string, any>> = {};
        for (const [ch, bands] of Object.entries(response.band_powers)) {
          bandPowers[ch] = {};
          for (const [band, data] of Object.entries(bands)) {
            bandPowers[ch][band] = {
              absolute: data.absolute,
              relative: data.relative,
              range: data.range as [number, number],
            };
          }
        }

        result = {
          fileId: response.file_id,
          type: 'frequency',
          selectionStart: start,
          selectionEnd: end,
          duration,
          frequency: {
            channels: [...response.channels],
            bandPowers,
          },
          timestamp: Date.now(),
        };
      }

      setOriginalResults(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      setOriginalError(errorMessage);
    } finally {
      setOriginalLoading(false);
    }
  }, []);

  // 运行预处理后信号分析
  const runPreprocessedAnalysis = useCallback(async () => {
    const params = analysisParamsRef.current;
    setPreprocessedLoading(true);
    setPreprocessedError(null);
    try {
      const start = Math.min(params.selectionStart, params.selectionEnd);
      const end = Math.max(params.selectionStart, params.selectionEnd);
      const duration = end - start;

      // 确保预处理配置类型正确
      const configToSend: PreprocessConfig = params.preprocessConfig.method !== 'none'
        ? params.preprocessConfig
        : { method: 'none', parameters: null };

      let result: AnalysisResult;

      if (params.analysisType === 'stats') {
        const response = await analyzeTimeDomain(
          params.fileId,
          start,
          duration,
          params.channelNames.length > 0 ? params.channelNames : undefined,
          configToSend
        );

        const timeDomain: Record<string, any> = {};
        for (const [ch, stats] of Object.entries(response.statistics)) {
          timeDomain[ch] = {
            mean: stats.mean,
            std: stats.std,
            min: stats.min,
            max: stats.max,
            rms: stats.rms,
            peakToPeak: stats.peak_to_peak,
            kurtosis: stats.kurtosis,
            skewness: stats.skewness,
            nSamples: stats.n_samples,
          };
        }

        result = {
          fileId: response.file_id,
          type: 'stats',
          selectionStart: start,
          selectionEnd: end,
          duration,
          timeDomain,
          timestamp: Date.now(),
        };
      } else {
        const response = await analyzeBandPower(
          params.fileId,
          start,
          duration,
          params.channelNames.length > 0 ? params.channelNames : undefined,
          undefined,
          configToSend
        );

        const bandPowers: Record<string, Record<string, any>> = {};
        for (const [ch, bands] of Object.entries(response.band_powers)) {
          bandPowers[ch] = {};
          for (const [band, data] of Object.entries(bands)) {
            bandPowers[ch][band] = {
              absolute: data.absolute,
              relative: data.relative,
              range: data.range as [number, number],
            };
          }
        }

        result = {
          fileId: response.file_id,
          type: 'frequency',
          selectionStart: start,
          selectionEnd: end,
          duration,
          frequency: {
            channels: [...response.channels],
            bandPowers,
          },
          timestamp: Date.now(),
        };
      }

      setPreprocessedResults(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      setPreprocessedError(errorMessage);
    } finally {
      setPreprocessedLoading(false);
    }
  }, []);

  // 统一的分析触发逻辑 - 使用 ref 避免依赖导致的循环
  const lastAnalysisParamsRef = React.useRef<string>('');

  useEffect(() => {
    if (!isOpen) {
      // 模态框关闭时重置追踪
      lastAnalysisParamsRef.current = '';
      return;
    }

    // 生成当前参数的标识
    const currentParams = JSON.stringify({
      analysisType,
      preprocessConfig,
      fileId,
      selectionStart,
      selectionEnd,
      channelNames,
    });

    // 只有参数变化时才重新运行分析
    if (currentParams !== lastAnalysisParamsRef.current) {
      runOriginalAnalysis();
      runPreprocessedAnalysis();
      lastAnalysisParamsRef.current = currentParams;
    }
  }, [isOpen, analysisType, preprocessConfig, fileId, selectionStart, selectionEnd, channelNames, runOriginalAnalysis, runPreprocessedAnalysis]);

  // 处理预处理方法变化
  const handlePreprocessMethodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newMethod = event.target.value as PreprocessMethod;
    const methodConfig = PREPROCESS_METHODS[newMethod];

    const newConfig: PreprocessConfig = {
      method: newMethod,
      parameters: methodConfig.parameters
        ? Object.entries(methodConfig.parameters).reduce(
            (acc, [key, param]) => ({
              ...acc,
              [key]: param.default,
            }),
            {} as Record<string, number>
          )
        : null,
    };

    setPreprocessConfig(newConfig);
  };

  // 处理预处理参数变化
  const handleParameterChange = (paramName: string, value: number) => {
    setPreprocessConfig({
      ...preprocessConfig,
      parameters: {
        ...preprocessConfig.parameters,
        [paramName]: value,
      },
    });
  };

  const currentMethodConfig = PREPROCESS_METHODS[preprocessConfig.method as keyof typeof PREPROCESS_METHODS];
  const hasParameters = currentMethodConfig.parameters !== undefined;

  // ESC 键关闭模态框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 防止页面滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // 点击背景关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modal}>
        {/* 头部 */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 id="modal-title" className={styles.title}>高级分析</h2>
            <p className={styles.selectionInfo}>
              选区: {selectionStart.toFixed(2)}s - {selectionEnd.toFixed(2)}s ({(selectionEnd - selectionStart).toFixed(2)}s)
            </p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="关闭高级分析"
          >
            ×
          </button>
        </div>

        {/* 内容区域 */}
        <div className={styles.content}>
          {/* 预处理配置区域 */}
          <div className={styles.configBar}>
            <div className={styles.configRow}>
              {/* 预处理方法选择 */}
              <div className={styles.configItem}>
                <label className={styles.configLabel}>预处理方法:</label>
                <select
                  value={preprocessConfig.method}
                  onChange={handlePreprocessMethodChange}
                  className={styles.configSelect}
                >
                  {Object.entries(PREPROCESS_METHODS).map(([value, method]) => (
                    <option key={value} value={value}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 参数配置 */}
              {hasParameters && currentMethodConfig.parameters && (
                <>
                  {Object.entries(currentMethodConfig.parameters).map(([paramName, paramConfig]) => {
                    const currentValue = preprocessConfig.parameters?.[paramName] as number | undefined;
                    return (
                      <div key={paramName} className={styles.configItem}>
                        <label className={styles.configLabel}>
                          {paramConfig.description}:
                        </label>
                        <div className={styles.paramSlider}>
                          <input
                            type="range"
                            min={paramConfig.min}
                            max={paramConfig.max}
                            step={paramConfig.max - paramConfig.min > 10 ? 0.5 : 0.1}
                            value={currentValue ?? paramConfig.default}
                            onChange={(e) => handleParameterChange(paramName, parseFloat(e.target.value))}
                          />
                          <span className={styles.paramValue}>
                            {(currentValue ?? paramConfig.default).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* 分析类型切换 */}
              <div className={styles.configItem}>
                <label className={styles.configLabel}>分析类型:</label>
                <div className={styles.typeSwitcher} role="group">
                  <button
                    onClick={() => setAnalysisType('stats')}
                    className={`${styles.typeButton} ${analysisType === 'stats' ? styles.active : ''}`}
                  >
                    时域
                  </button>
                  <button
                    onClick={() => setAnalysisType('frequency')}
                    className={`${styles.typeButton} ${analysisType === 'frequency' ? styles.active : ''}`}
                  >
                    频域
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 双面板对比区域 */}
          <div className={styles.panels}>
            {/* 原始信号面板 */}
            <div className={`${styles.panel} ${activePanel === 'original' ? styles.active : ''}`}>
              <div className={`${styles.panelHeader} ${styles.panelHeaderOriginal}`}>
                <h3 className={styles.panelTitle}>原始信号</h3>
                <span className={`${styles.panelBadge} ${styles.badgeDefault}`}>
                  无预处理
                </span>
              </div>
              <div className={styles.panelContent}>
                {originalLoading && <div className={styles.panelStatus}>分析中...</div>}
                {originalError && <div className={styles.panelError}>{originalError}</div>}
                {!originalLoading && !originalError && !originalResults && (
                  <div className={styles.panelStatus}>等待分析...</div>
                )}
                {!originalLoading && !originalError && originalResults && (
                  analysisType === 'stats' ? (
                    <StatsView
                      results={originalResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                      hideCloseButton
                    />
                  ) : (
                    <FrequencyView
                      results={originalResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                      hideCloseButton
                    />
                  )
                )}
              </div>
            </div>

            {/* 预处理后信号面板 */}
            <div className={`${styles.panel} ${activePanel === 'preprocessed' ? styles.active : ''}`}>
              <div className={`${styles.panelHeader} ${styles.panelHeaderPreprocessed}`}>
                <h3 className={`${styles.panelTitle} ${styles.panelTitlePreprocessed}`}>预处理后信号</h3>
                <span className={`${styles.panelBadge} ${styles.badgePrimary}`}>
                  {currentMethodConfig.name}
                </span>
              </div>
              <div className={styles.panelContent}>
                {preprocessedLoading && <div className={styles.panelStatus}>分析中...</div>}
                {preprocessedError && <div className={styles.panelError}>{preprocessedError}</div>}
                {!preprocessedLoading && !preprocessedError && !preprocessedResults && (
                  <div className={styles.panelStatus}>等待分析...</div>
                )}
                {!preprocessedLoading && !preprocessedError && preprocessedResults && (
                  analysisType === 'stats' ? (
                    <StatsView
                      results={preprocessedResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                      hideCloseButton
                    />
                  ) : (
                    <FrequencyView
                      results={preprocessedResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                      hideCloseButton
                    />
                  )
                )}
              </div>
            </div>
          </div>

          {/* 移动端面板切换 */}
          <div className={styles.mobileTabs}>
            <button
              onClick={() => setActivePanel('original')}
              className={`${styles.mobileTab} ${activePanel === 'original' ? styles.active : ''}`}
            >
              原始信号
            </button>
            <button
              onClick={() => setActivePanel('preprocessed')}
              className={`${styles.mobileTab} ${activePanel === 'preprocessed' ? styles.active : ''}`}
            >
              预处理后
            </button>
          </div>

          {/* 底部按钮 */}
          <div className={styles.footer}>
            <button
              onClick={onClose}
              className={`${styles.footerButton} ${styles.footerButtonSecondary}`}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
