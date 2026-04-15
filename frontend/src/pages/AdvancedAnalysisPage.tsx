/**
 * AdvancedAnalysisPage - 高级分析独立页面
 *
 * 在新窗口中打开的高级分析页面，支持原始信号和预处理后信号的对比分析
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { AnalysisType, PreprocessConfig, PreprocessMethod } from '../types/analysis';
import { PREPROCESS_METHODS } from '../types/analysis';
import { analyzeTimeDomain, analyzeBandPower } from '../api/edf';
import type { AnalysisResult } from '../types/analysis';
import { StatsView } from '../components/StatsView';
import { FrequencyView } from '../components/FrequencyView';
import { SignalComparisonView } from '../components/advanced-analysis/SignalComparisonView';
import './AdvancedAnalysisPage.module.css';

// 页面参数接口
interface PageParams {
  fileId: string;
  selectionStart: number;
  selectionEnd: number;
  channels: string[];
  analysisType: AnalysisType;
  preprocessConfig: PreprocessConfig;
}

// 从 URL 参数解析配置
function parseUrlParams(): PageParams | null {
  const params = new URLSearchParams(window.location.search);

  const fileId = params.get('fileId');
  const selectionStart = params.get('selectionStart');
  const selectionEnd = params.get('selectionEnd');
  const channels = params.get('channels');
  const analysisType = params.get('analysisType') as AnalysisType;
  const preprocessMethod = params.get('preprocessMethod');
  const preprocessParameters = params.get('preprocessParameters');

  if (!fileId || !selectionStart || !selectionEnd || !channels || !analysisType) {
    console.error('[AdvancedAnalysisPage] 缺少必要参数');
    return null;
  }

  let parsedChannels: string[] = [];
  try {
    parsedChannels = JSON.parse(channels);
  } catch (e) {
    console.error('[AdvancedAnalysisPage] 无法解析通道列表:', e);
    return null;
  }

  let parsedPreprocessParameters: Record<string, number> | null = null;
  if (preprocessParameters) {
    try {
      parsedPreprocessParameters = JSON.parse(preprocessParameters);
    } catch (e) {
      console.error('[AdvancedAnalysisPage] 无法解析预处理参数:', e);
    }
  }

  const preprocessConfig: PreprocessConfig = {
    method: (preprocessMethod as any) || 'none',
    parameters: parsedPreprocessParameters,
  };

  return {
    fileId,
    selectionStart: parseFloat(selectionStart),
    selectionEnd: parseFloat(selectionEnd),
    channels: parsedChannels,
    analysisType,
    preprocessConfig,
  };
}

export function AdvancedAnalysisPage() {
  const [params, setParams] = useState<PageParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 视图类型状态 (波形/统计)
  type ViewType = 'waveform' | 'statistics';
  const [viewType, setViewType] = useState<ViewType>('statistics');

  // 分析状态
  const [analysisType, setAnalysisType] = useState<AnalysisType>('frequency');

  // 原始信号分析结果
  const [originalResults, setOriginalResults] = useState<AnalysisResult | null>(null);
  const [originalLoading, setOriginalLoading] = useState(false);
  const [originalError, setOriginalError] = useState<string | null>(null);

  // 预处理后信号分析结果
  const [preprocessConfig, setPreprocessConfig] = useState<PreprocessConfig>({ method: 'none', parameters: null });
  const [preprocessedResults, setPreprocessedResults] = useState<AnalysisResult | null>(null);
  const [preprocessedLoading, setPreprocessedLoading] = useState(false);
  const [preprocessedError, setPreprocessedError] = useState<string | null>(null);

  // 当前激活的面板（用于响应式布局）
  const [_activePanel, _setActivePanel] = useState<'original' | 'preprocessed'>('original');

  // 解析 URL 参数
  useEffect(() => {
    const parsedParams = parseUrlParams();
    if (!parsedParams) {
      setError('无法解析页面参数，请从主应用打开此页面。');
      return;
    }
    setParams(parsedParams);
    setAnalysisType(parsedParams.analysisType);
    setPreprocessConfig(parsedParams.preprocessConfig);
  }, []);

  // 运行原始信号分析
  const runOriginalAnalysis = useCallback(async () => {
    if (!params) return;

    setOriginalLoading(true);
    setOriginalError(null);
    try {
      const start = Math.min(params.selectionStart, params.selectionEnd);
      const end = Math.max(params.selectionStart, params.selectionEnd);
      const duration = end - start;

      console.log('[AdvancedAnalysisPage] 运行原始信号分析', {
        fileId: params.fileId,
        start,
        end,
        duration,
        channels: params.channels,
        analysisType,
      });

      let result: AnalysisResult;

      if (analysisType === 'stats') {
        const response = await analyzeTimeDomain(
          params.fileId,
          start,
          duration,
          params.channels.length > 0 ? params.channels : undefined,
          { method: 'none' }
        );

        console.log('[AdvancedAnalysisPage] 时域分析响应:', response);

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
          params.channels.length > 0 ? params.channels : undefined,
          undefined,
          { method: 'none' }
        );

        console.log('[AdvancedAnalysisPage] 频域分析响应:', response);

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
      console.log('[AdvancedAnalysisPage] 原始分析结果已设置:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分析失败';
      console.error('[AdvancedAnalysisPage] 原始分析失败:', err);
      setOriginalError(errorMessage);
    } finally {
      setOriginalLoading(false);
    }
  }, [params, analysisType]);

  // 运行预处理后信号分析
  const runPreprocessedAnalysis = useCallback(async () => {
    if (!params) return;

    setPreprocessedLoading(true);
    setPreprocessedError(null);
    try {
      const start = Math.min(params.selectionStart, params.selectionEnd);
      const end = Math.max(params.selectionStart, params.selectionEnd);
      const duration = end - start;

      // 确保预处理配置类型正确
      const configToSend: PreprocessConfig = preprocessConfig.method !== 'none'
        ? preprocessConfig
        : { method: 'none', parameters: null };

      console.log('[AdvancedAnalysisPage] 运行预处理后信号分析', {
        fileId: params.fileId,
        start,
        end,
        duration,
        channels: params.channels,
        analysisType,
        preprocessConfig: configToSend,
      });

      let result: AnalysisResult;

      if (analysisType === 'stats') {
        const response = await analyzeTimeDomain(
          params.fileId,
          start,
          duration,
          params.channels.length > 0 ? params.channels : undefined,
          configToSend
        );

        console.log('[AdvancedAnalysisPage] 预处理后时域分析响应:', response);

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
          params.channels.length > 0 ? params.channels : undefined,
          undefined,
          configToSend
        );

        console.log('[AdvancedAnalysisPage] 预处理后频域分析响应:', response);

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
      console.log('[AdvancedAnalysisPage] 预处理后分析结果已设置:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分析失败';
      console.error('[AdvancedAnalysisPage] 预处理后分析失败:', err);
      setPreprocessedError(errorMessage);
    } finally {
      setPreprocessedLoading(false);
    }
  }, [params, analysisType, preprocessConfig]);

  // 初始加载时运行分析
  useEffect(() => {
    if (params) {
      runOriginalAnalysis();
      runPreprocessedAnalysis();
    }
  }, [params, runOriginalAnalysis, runPreprocessedAnalysis]);

  // 分析类型变化时重新运行
  useEffect(() => {
    if (params) {
      runOriginalAnalysis();
      runPreprocessedAnalysis();
    }
  }, [analysisType, params, runOriginalAnalysis, runPreprocessedAnalysis]);

  // 预处理配置变化时重新运行预处理分析
  useEffect(() => {
    if (params && preprocessConfig.method !== 'none') {
      runPreprocessedAnalysis();
    }
  }, [preprocessConfig, params, runPreprocessedAnalysis]);

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
              [key]: (param as { default: number; min: number; max: number; description: string }).default,
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
  const hasParameters = currentMethodConfig?.parameters !== undefined;

  // 参数解析错误显示
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">参数错误</h1>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => window.close()}
            className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            关闭窗口
          </button>
        </div>
      </div>
    );
  }

  // 加载中状态
  if (!params) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-700">加载参数中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">EEG 高级分析</h1>
            <p className="text-sm text-gray-500 mt-1">
              选区: {params.selectionStart.toFixed(2)}s - {params.selectionEnd.toFixed(2)}s ({(params.selectionEnd - params.selectionStart).toFixed(2)}s)
            </p>
            <p className="text-sm text-gray-500">
              通道: {params.channels.length} 个
            </p>
          </div>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            关闭
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="p-6">
        <div className="bg-white rounded-lg shadow-lg">
          {/* 预处理配置区域 */}
          <div className="border-b border-gray-200 px-6 py-4">
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
              {hasParameters && currentMethodConfig?.parameters && (
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

              {/* 视图类型切换 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">视图:</label>
                <div className="inline-flex rounded-md shadow-sm" role="group">
                  <button
                    onClick={() => setViewType('waveform')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-l-md border ${
                      viewType === 'waveform'
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    波形
                  </button>
                  <button
                    onClick={() => setViewType('statistics')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-r-md border-t border-b border-r ${
                      viewType === 'statistics'
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    统计
                  </button>
                </div>
              </div>

              {/* 分析类型切换 (仅在统计视图时显示) */}
              {viewType === 'statistics' && (
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
              )}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-auto">
            {viewType === 'waveform' ? (
              /* 波形视图 */
              <SignalComparisonView
                fileId={params.fileId}
                selectionStart={params.selectionStart}
                selectionEnd={params.selectionEnd}
                channels={params.channels}
                preprocessConfig={preprocessConfig}
                height={500}
              />
            ) : (
              /* 统计视图 */
              <div className="flex h-[calc(100vh-280px)]">
                {/* 原始信号面板 */}
                <div className="flex-1 border-r border-gray-200 overflow-auto p-4">
                  <div className="mb-4 pb-2 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-700">原始信号</h3>
                  </div>
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

                {/* 预处理后信号面板 */}
                <div className="flex-1 overflow-auto p-4">
                  <div className="mb-4 pb-2 border-b border-blue-200">
                    <h3 className="font-semibold text-blue-700">预处理后信号</h3>
                    <span className="text-xs text-gray-500 ml-2">{currentMethodConfig?.name}</span>
                  </div>
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdvancedAnalysisPage;
