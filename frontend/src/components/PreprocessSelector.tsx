/**
 * PreprocessSelector - 预处理方法选择器
 *
 * 允许用户选择信号预处理方法，如去漂移、滤波等
 */

import { PREPROCESS_METHODS, type PreprocessMethod, type PreprocessConfig } from '../types/analysis';

interface PreprocessSelectorProps {
  config: PreprocessConfig;
  onConfigChange: (config: PreprocessConfig) => void;
  disabled?: boolean;
  className?: string;
}

export function PreprocessSelector({
  config,
  onConfigChange,
  disabled = false,
  className = '',
}: PreprocessSelectorProps) {
  const handleMethodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newMethod = event.target.value as PreprocessMethod;
    const methodConfig = PREPROCESS_METHODS[newMethod];

    // 为新方法设置默认参数
    const newConfig: PreprocessConfig = {
      method: newMethod,
      parameters: methodConfig.parameters
        ? Object.entries(methodConfig.parameters).reduce(
            (acc, [key, param]) => ({
              ...acc,
              [key]: param.default,
            }),
            {}
          )
        : null,
    };

    onConfigChange(newConfig);
  };

  const handleParameterChange = (paramName: string, value: number) => {
    onConfigChange({
      ...config,
      parameters: {
        ...config.parameters,
        [paramName]: value,
      },
    });
  };

  const currentMethodConfig = PREPROCESS_METHODS[config.method];
  const hasParameters = currentMethodConfig.parameters !== undefined;

  return (
    <div className={`preprocess-selector ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        信号预处理
      </label>

      <select
        value={config.method}
        onChange={handleMethodChange}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
      >
        {Object.entries(PREPROCESS_METHODS).map(([value, method]) => (
          <option key={value} value={value}>
            {method.name} - {method.description}
          </option>
        ))}
      </select>

      {hasParameters && currentMethodConfig.parameters && (
        <div className="mt-3 space-y-2">
          {Object.entries(currentMethodConfig.parameters).map(([paramName, paramConfig]) => {
            const currentValue = config.parameters?.[paramName] as number | undefined;
            return (
              <div key={paramName} className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-24 flex-shrink-0">
                  {paramConfig.description}:
                </label>
                <input
                  type="range"
                  min={paramConfig.min}
                  max={paramConfig.max}
                  step={paramConfig.max - paramConfig.min > 10 ? 0.5 : 0.1}
                  value={currentValue ?? paramConfig.default}
                  onChange={(e) => handleParameterChange(paramName, parseFloat(e.target.value))}
                  disabled={disabled}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-700 w-12 text-right">
                  {(currentValue ?? paramConfig.default).toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500">
        {currentMethodConfig.description}
      </p>
    </div>
  );
}
