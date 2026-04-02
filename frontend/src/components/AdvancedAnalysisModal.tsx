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

      console.log('[AdvancedAnalysisModal] 运行原始信号分析', {
        fileId: params.fileId,
        start,
        end,
        duration,
        channelNames: params.channelNames,
        analysisType: params.analysisType,
      });

      let result: AnalysisResult;

      if (params.analysisType === 'stats') {
        const response = await analyzeTimeDomain(
          params.fileId,
          start,
          duration,
          params.channelNames.length > 0 ? params.channelNames : undefined,
          { method: 'none' }
        );

        console.log('[AdvancedAnalysisModal] 时域分析响应:', response);

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
      console.log('[AdvancedAnalysisModal] 原始分析结果已设置:', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      console.error('[AdvancedAnalysisModal] 原始分析失败:', error);
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

      console.log('[AdvancedAnalysisModal] 运行预处理后信号分析', {
        fileId: params.fileId,
        start,
        end,
        duration,
        channelNames: params.channelNames,
        analysisType: params.analysisType,
        preprocessConfig: configToSend,
      });

      let result: AnalysisResult;

      if (params.analysisType === 'stats') {
        const response = await analyzeTimeDomain(
          params.fileId,
          start,
          duration,
          params.channelNames.length > 0 ? params.channelNames : undefined,
          configToSend
        );

        console.log('[AdvancedAnalysisModal] 预处理后时域分析响应:', response);

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

        console.log('[AdvancedAnalysisModal] 预处理后频域分析响应:', response);

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
      console.log('[AdvancedAnalysisModal] 预处理后分析结果已设置:', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      console.error('[AdvancedAnalysisModal] 预处理后分析失败:', error);
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

  // 调试日志 - 记录渲染状态
  React.useEffect(() => {
    console.log('[AdvancedAnalysisModal] 渲染状态:', {
      isOpen,
      fileId,
      selectionStart,
      selectionEnd,
      channelNames,
      analysisType,
      originalLoading,
      originalError,
      hasOriginalResults: !!originalResults,
      preprocessedLoading,
      preprocessedError,
      hasPreprocessedResults: !!preprocessedResults,
      preprocessConfig,
    });
  }, [isOpen, originalLoading, originalError, originalResults, preprocessedLoading, preprocessedError, preprocessedResults, analysisType, preprocessConfig]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] max-w-7xl flex flex-col">
        {/* 头部 */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">高级分析</h2>
            <p className="text-sm text-gray-500 mt-1">
              选区: {selectionStart.toFixed(2)}s - {selectionEnd.toFixed(2)}s ({(selectionEnd - selectionStart).toFixed(2)}s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 预处理配置区域 */}
          <div className="border-b border-gray-200 px-6 py-3 bg-white">
            <div className="flex items-center gap-6 flex-wrap">
              {/* 预处理方法选择 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">预处理方法:</label>
                <select
                  value={preprocessConfig.method}
                  onChange={handlePreprocessMethodChange}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <div className="flex items-center gap-4 flex-wrap">
                  {Object.entries(currentMethodConfig.parameters).map(([paramName, paramConfig]) => {
                    const currentValue = preprocessConfig.parameters?.[paramName] as number | undefined;
                    return (
                      <div key={paramName} className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">
                          {paramConfig.description}:
                        </label>
                        <input
                          type="range"
                          min={paramConfig.min}
                          max={paramConfig.max}
                          step={paramConfig.max - paramConfig.min > 10 ? 0.5 : 0.1}
                          value={currentValue ?? paramConfig.default}
                          onChange={(e) => handleParameterChange(paramName, parseFloat(e.target.value))}
                          className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 w-10">
                          {(currentValue ?? paramConfig.default).toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 分析类型切换 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">分析类型:</label>
                <div className="inline-flex rounded-md shadow-sm" role="group">
                  <button
                    onClick={() => setAnalysisType('stats')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-l-md border ${
                      analysisType === 'stats'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    时域
                  </button>
                  <button
                    onClick={() => setAnalysisType('frequency')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-r-md border-t border-b border-r ${
                      analysisType === 'frequency'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    频域
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 双面板对比区域 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 原始信号面板 */}
            <div
              className={`flex-1 border-r border-gray-200 flex flex-col overflow-hidden ${
                activePanel === 'original' ? '' : 'hidden md:flex'
              }`}
            >
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">原始信号</h3>
                <span className="text-xs px-2 py-0.5 bg-gray-200 rounded text-gray-600">
                  无预处理
                </span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {originalLoading && <div className="text-center py-8 text-gray-500">分析中...</div>}
                {originalError && <div className="text-center py-8 text-red-500">{originalError}</div>}
                {!originalLoading && !originalError && !originalResults && (
                  <div className="text-center py-8 text-gray-400">等待分析...</div>
                )}
                {!originalLoading && !originalError && originalResults && (
                  analysisType === 'stats' ? (
                    <StatsView
                      results={originalResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                    />
                  ) : (
                    <FrequencyView
                      results={originalResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                    />
                  )
                )}
              </div>
            </div>

            {/* 预处理后信号面板 */}
            <div
              className={`flex-1 flex flex-col overflow-hidden ${
                activePanel === 'preprocessed' ? '' : 'hidden md:flex'
              }`}
            >
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                <h3 className="font-semibold text-blue-700">预处理后信号</h3>
                <span className="text-xs px-2 py-0.5 bg-blue-200 rounded text-blue-700">
                  {currentMethodConfig.name}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {preprocessedLoading && <div className="text-center py-8 text-gray-500">分析中...</div>}
                {preprocessedError && <div className="text-center py-8 text-red-500">{preprocessedError}</div>}
                {!preprocessedLoading && !preprocessedError && !preprocessedResults && (
                  <div className="text-center py-8 text-gray-400">等待分析...</div>
                )}
                {!preprocessedLoading && !preprocessedError && preprocessedResults && (
                  analysisType === 'stats' ? (
                    <StatsView
                      results={preprocessedResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                    />
                  ) : (
                    <FrequencyView
                      results={preprocessedResults}
                      isLoading={false}
                      error={null}
                      onClose={() => {}}
                    />
                  )
                )}
              </div>
            </div>
          </div>

          {/* 移动端面板切换 */}
          <div className="md:hidden border-t border-gray-200 px-6 py-3 bg-gray-50 flex justify-center">
            <div className="inline-flex rounded-md shadow-sm">
              <button
                onClick={() => setActivePanel('original')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                  activePanel === 'original'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                原始信号
              </button>
              <button
                onClick={() => setActivePanel('preprocessed')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                  activePanel === 'preprocessed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                预处理后
              </button>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
