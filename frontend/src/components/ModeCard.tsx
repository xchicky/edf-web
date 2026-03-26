/**
 * ModeCard 组件
 * 模式卡片，显示模式信息
 */

import type { Mode } from '../types/mode';
import { MODE_CATEGORIES } from '../types/mode';
import styles from './ModeCard.module.css';

export interface ModeCardProps {
  /**
   * 模式对象
   */
  mode: Mode;

  /**
   * 是否可交互（显示编辑/删除按钮）
   */
  interactive?: boolean;

  /**
   * 点击回调
   */
  onClick?: () => void;

  /**
   * 编辑回调
   */
  onEdit?: () => void;

  /**
   * 删除回调
   */
  onDelete?: () => void;

  /**
   * 复制回调
   */
  onDuplicate?: () => void;

  /**
   * 自定义类名
   */
  className?: string;
}

export function ModeCard({
  mode,
  interactive = false,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  className = '',
}: ModeCardProps) {
  const categoryInfo = MODE_CATEGORIES[mode.category];
  const hasRequiredChannels = mode.requiredChannels && mode.requiredChannels.length > 0;

  return (
    <div
      className={`${styles.card} ${className} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.header}>
        <h3 className={styles.name}>{mode.name}</h3>
        {mode.isBuiltIn && <span className={styles.builtinBadge}>内置</span>}
        {mode.isFavorite && <span className={styles.favoriteBadge}>★</span>}
      </div>

      <p className={styles.description}>{mode.description}</p>

      <div className={styles.metadata}>
        <div className={styles.category}>
          <span className={styles.categoryIcon}>{categoryInfo?.icon}</span>
          <span>{categoryInfo?.label}</span>
        </div>

        {hasRequiredChannels && (
          <div className={styles.requiredChannels}>
            <span>必需通道:</span>
            <span className={styles.channelList}>
              {mode.requiredChannels?.join(', ')}
            </span>
          </div>
        )}

        {mode.usageCount > 0 && (
          <div className={styles.usage}>
            已使用 {mode.usageCount} 次
          </div>
        )}
      </div>

      {interactive && (
        <div className={styles.actions}>
          {onEdit && (
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label="编辑模式"
            >
              编辑
            </button>
          )}
          {onDuplicate && (
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              aria-label="复制模式"
            >
              复制
            </button>
          )}
          {onDelete && !mode.isBuiltIn && (
            <button
              className={`${styles.actionButton} ${styles.deleteButton}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="删除模式"
            >
              删除
            </button>
          )}
        </div>
      )}

      {mode.tags.length > 0 && (
        <div className={styles.tags}>
          {mode.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
