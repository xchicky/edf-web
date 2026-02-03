/**
 * ModeSelector 组件
 * 智能模式选择器，显示兼容/部分兼容模式
 */

import { useCallback, useMemo } from 'react';
import { useEDFStore } from '../store/edfStore';
import { checkModeCompatibility } from '../utils/modeCompatibilityChecker';
import { MODE_CATEGORIES } from '../types/mode';
import styles from './ModeSelector.module.css';

export interface ModeSelectorProps {
  /**
   * 是否显示兼容性标记
   */
  showCompatibility?: boolean;

  /**
   * 是否显示分类标签
   */
  showCategory?: boolean;

  /**
   * 是否禁用选择器
   */
  disabled?: boolean;

  /**
   * 自定义类名
   */
  className?: string;

  /**
   * 模式变更回调
   */
  onModeChange?: (modeId: string | null) => void;

  /**
   * 创建模式回调
   */
  onCreateMode?: () => void;

  /**
   * 编辑当前模式回调
   */
  onEditMode?: () => void;
}

export function ModeSelector({
  showCompatibility = true,
  showCategory = false,
  disabled = false,
  className = '',
  onModeChange,
  onCreateMode,
  onEditMode,
}: ModeSelectorProps) {
  const {
    modes,
    currentModeId,
    metadata,
    applyMode,
    clearMode,
    isLoadingModes,
  } = useEDFStore();

  // 计算每个模式的兼容性
  const modesWithCompatibility = useMemo(() => {
    if (!metadata) {
      return modes.map((mode) => ({ mode, isCompatible: true, hasWarnings: false }));
    }

    return modes.map((mode) => {
      const compatibility = checkModeCompatibility(
        mode,
        metadata.channel_names,
        metadata.sfreq
      );

      return {
        mode,
        isCompatible: compatibility.isCompatible,
        hasWarnings: compatibility.warnings.length > 0,
      };
    });
  }, [modes, metadata]);

  // 处理模式选择
  const handleModeChange = useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedModeId = event.target.value;

      try {
        if (selectedModeId === '') {
          // 选择"无模式"
          clearMode();
          onModeChange?.(null);
        } else {
          // 应用选中的模式
          await applyMode(selectedModeId);
          onModeChange?.(selectedModeId);
        }
      } catch (error) {
        console.error('Failed to apply mode:', error);
        // 可以在这里显示错误提示
      }
    },
    [applyMode, clearMode, onModeChange]
  );

  // 获取模式分类标签
  const getCategoryLabel = (category: string) => {
    return MODE_CATEGORIES[category as keyof typeof MODE_CATEGORIES]?.label ?? category;
  };

  // 获取模式显示文本
  const getModeLabel = (modeName: string, category: string, isCompatible: boolean, isBuiltIn: boolean) => {
    let label = modeName;

    if (showCategory) {
      label += ` (${getCategoryLabel(category)})`;
    }

    if (isBuiltIn) {
      label += ' *';
    }

    if (showCompatibility && !isCompatible) {
      label += ' [不兼容]';
    }

    return label;
  };

  const isDisabled = disabled || isLoadingModes || !metadata;

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <label htmlFor="mode-selector" className={styles.label}>
          分析模式
        </label>
        {(onCreateMode || onEditMode) && (
          <div className={styles.actionButtons}>
            {onCreateMode && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={onCreateMode}
                title="创建新模式"
                disabled={isDisabled}
              >
                +
              </button>
            )}
            {onEditMode && currentModeId && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={onEditMode}
                title="编辑当前模式"
                disabled={isDisabled}
              >
                ✎
              </button>
            )}
          </div>
        )}
      </div>
      <select
        id="mode-selector"
        className={styles.selector}
        value={currentModeId ?? ''}
        onChange={handleModeChange}
        disabled={isDisabled}
        aria-label="选择分析模式"
        aria-busy={isLoadingModes}
      >
        <option value="">无模式</option>
        {modesWithCompatibility.map(({ mode, isCompatible, hasWarnings }) => (
          <option
            key={mode.id}
            value={mode.id}
            className={
              !isCompatible
                ? styles.incompatible
                : hasWarnings
                ? styles.hasWarnings
                : styles.compatible
            }
            disabled={!isCompatible}
          >
            {getModeLabel(mode.name, mode.category, isCompatible, mode.isBuiltIn)}
          </option>
        ))}
      </select>
      {isLoadingModes && (
        <span className={styles.loadingText}>加载中...</span>
      )}
      {!isLoadingModes && modes.length === 0 && (
        <span className={styles.emptyText}>无可用模式</span>
      )}
    </div>
  );
}
