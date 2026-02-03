/**
 * CompatibilityWarning 组件
 * 兼容性警告弹窗
 */

import { useEffect, useRef } from 'react';
import type { CompatibilityIssue } from '../types/mode';
import styles from './CompatibilityWarning.module.css';

export interface CompatibilityWarningProps {
  /**
   * 是否显示弹窗
   */
  isOpen: boolean;

  /**
   * 兼容性问题列表
   */
  issues: CompatibilityIssue[];

  /**
   * 可用信号数量
   */
  availableSignalCount: number;

  /**
   * 模式名称
   */
  modeName: string;

  /**
   * 确认回调
   */
  onConfirm: () => void;

  /**
   * 取消回调
   */
  onCancel: () => void;

  /**
   * 自定义类名
   */
  className?: string;
}

export function CompatibilityWarning({
  isOpen,
  issues,
  availableSignalCount,
  modeName,
  onConfirm,
  onCancel,
  className = '',
}: CompatibilityWarningProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // 处理 ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 点击遮罩层关闭
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  const hasErrors = issues.some((issue) => issue.severity === 'error');
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  // 格式化问题类型名称
  const formatIssueType = (type: string): string => {
    const typeMap: Record<string, string> = {
      missing_channel: '缺失通道',
      low_sampling_rate: '采样率不足',
      config_conflict: '配置冲突',
      other: '其他',
    };
    return typeMap[type] || type;
  };

  return (
    <div
      className={`${styles.backdrop} ${className}`}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compatibility-warning-title"
      >
        <div className={styles.header}>
          <h2 id="compatibility-warning-title" className={styles.title}>
            兼容性警告
          </h2>
          <button
            className={styles.closeButton}
            onClick={onCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.modeInfo}>
            <span className={styles.modeName}>{modeName}</span>
            <span className={styles.separator}>·</span>
            <span className={styles.signalCount}>
              {availableSignalCount} 个可用信号
            </span>
          </div>

          {issues.length === 0 ? (
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>✓</div>
              <p>该模式与当前文件完全兼容</p>
            </div>
          ) : (
            <div className={styles.issuesList}>
              <div className={styles.issuesSummary}>
                {hasErrors && (
                  <span className={styles.errorCount}>
                    {errorCount} 个错误
                  </span>
                )}
                {warningCount > 0 && (
                  <span className={styles.warningCount}>
                    {warningCount} 个警告
                  </span>
                )}
              </div>

              {issues.map((issue, index) => (
                <div
                  key={index}
                  className={`${styles.issueItem} ${styles[issue.severity]}`}
                >
                  <div className={styles.issueHeader}>
                    {issue.severity === 'error' ? (
                      <span className={styles.errorIcon}>⚠</span>
                    ) : (
                      <span className={styles.warningIcon}>⚠</span>
                    )}
                    <span className={styles.issueType}>
                      {formatIssueType(issue.type)}
                    </span>
                  </div>
                  <p className={styles.issueMessage}>{issue.message}</p>
                  {issue.suggestion && (
                    <p className={styles.issueSuggestion}>
                      建议: {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`${styles.button} ${styles.confirmButton}`}
            onClick={onConfirm}
            type="button"
            autoFocus
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
