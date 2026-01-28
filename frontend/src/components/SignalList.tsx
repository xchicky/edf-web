/**
 * Signal List Component
 * 用于显示和管理派生信号列表
 */

import React, { useState } from 'react';
import type { Signal } from '../types/signal';
import styles from './SignalList.module.css';

interface SignalListProps {
  signals: Signal[];
  onEdit: (signal: Signal) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onAddNew: () => void;
}

export const SignalList: React.FC<SignalListProps> = ({
  signals,
  onEdit,
  onDelete,
  onToggle,
  onAddNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 过滤信号
  const filteredSignals = signals.filter(
    (signal) =>
      signal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signal.expression.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = (id: string) => {
    onDelete(id);
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>派生信号</h3>
        <button className={styles.addButton} onClick={onAddNew}>
          + 添加信号
        </button>
      </div>

      <div className={styles.searchBox}>
        <input
          type="text"
          placeholder="搜索信号..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {filteredSignals.length === 0 ? (
        <div className={styles.emptyState}>
          {signals.length === 0 ? (
            <>
              <p>还没有派生信号</p>
              <button className={styles.emptyAddButton} onClick={onAddNew}>
                创建第一个信号
              </button>
            </>
          ) : (
            <p>没有匹配的信号</p>
          )}
        </div>
      ) : (
        <div className={styles.signalList}>
          {filteredSignals.map((signal) => (
            <div key={signal.id} className={styles.signalItem}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <input
                    type="checkbox"
                    checked={signal.enabled}
                    onChange={() => onToggle(signal.id)}
                    className={styles.checkbox}
                    title={signal.enabled ? '禁用信号' : '启用信号'}
                  />
                  <div
                    className={styles.colorIndicator}
                    style={{ backgroundColor: signal.color || '#2196f3' }}
                    title="信号颜色"
                  />
                  <div className={styles.nameAndExpression}>
                    <div className={styles.name}>{signal.name}</div>
                    <div className={styles.expression}>{signal.expression}</div>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.editButton}
                    onClick={() => onEdit(signal)}
                    title="编辑信号"
                  >
                    编辑
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteClick(signal.id)}
                    title="删除信号"
                  >
                    删除
                  </button>
                </div>
              </div>

              {signal.description && (
                <div className={styles.description}>{signal.description}</div>
              )}

              {deleteConfirmId === signal.id && (
                <div className={styles.deleteConfirm}>
                  <p>确定要删除此信号吗？</p>
                  <div className={styles.confirmButtons}>
                    <button
                      className={styles.confirmButton}
                      onClick={() => handleConfirmDelete(signal.id)}
                    >
                      确定
                    </button>
                    <button
                      className={styles.cancelButton}
                      onClick={handleCancelDelete}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.metadata}>
                <span className={styles.metaItem}>
                  创建: {new Date(signal.createdAt).toLocaleString()}
                </span>
                <span className={styles.metaItem}>
                  修改: {new Date(signal.modifiedAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
