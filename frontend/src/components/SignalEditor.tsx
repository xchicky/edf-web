/**
 * Signal Editor Component
 * 用于创建和编辑派生信号的模态框
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Signal } from '../types/signal';
import { extractOperands, validateExpression } from '../utils/expressionParser';
import { SignalExpressionBuilder } from './SignalExpressionBuilder';
import styles from './SignalEditor.module.css';

interface SignalEditorProps {
  isOpen: boolean;
  signal?: Signal;
  channelNames: string[];
  onSave: (signal: Signal) => void;
  onCancel: () => void;
}

export const SignalEditor: React.FC<SignalEditorProps> = ({
  isOpen,
  signal,
  channelNames,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2196f3');
  const [isExpressionValid, setIsExpressionValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化表单
  useEffect(() => {
    if (signal) {
      setName(signal.name);
      setExpression(signal.expression);
      setDescription(signal.description || '');
      setColor(signal.color || '#2196f3');
    } else {
      setName('');
      setExpression('');
      setDescription('');
      setColor('#2196f3');
    }
    setError(null);
  }, [signal, isOpen]);

  // 验证表达式
  const validation = useMemo(() => {
    if (!expression.trim()) {
      return { isValid: false };
    }
    return validateExpression(expression, channelNames);
  }, [expression, channelNames]);

  const handleSave = () => {
    setError(null);

    // 验证名称
    if (!name.trim()) {
      setError('请输入信号名称');
      return;
    }

    // 验证表达式
    if (!validation.isValid) {
      setError('表达式无效');
      return;
    }

    try {
      // 提取操作数
      const operands = extractOperands(expression, channelNames);

      // 创建或更新信号
      const newSignal: Signal = {
        id: signal?.id || `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        expression,
        operands,
        description: description || undefined,
        color: color || undefined,
        enabled: signal?.enabled ?? true,
        createdAt: signal?.createdAt || Date.now(),
        modifiedAt: Date.now(),
      };

      onSave(newSignal);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{signal ? '编辑信号' : '创建新信号'}</h2>
          <button className={styles.closeButton} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="name">信号名称 *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: Fp1-F7"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expression">表达式 *</label>
            <SignalExpressionBuilder
              expression={expression}
              channelNames={channelNames}
              onExpressionChange={setExpression}
              onValidationChange={setIsExpressionValid}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">描述</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选的信号描述"
              className={styles.textarea}
              rows={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="color">颜色</label>
            <div className={styles.colorPicker}>
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={styles.colorInput}
              />
              <span
                className={styles.colorPreview}
                style={{ backgroundColor: color }}
              />
            </div>
          </div>

          {validation.isValid && (
            <div className={styles.validationInfo}>
              <div className={styles.infoItem}>
                <strong>通道:</strong> {validation.referencedChannels?.join(', ')}
              </div>
              {validation.constants && validation.constants.length > 0 && (
                <div className={styles.infoItem}>
                  <strong>常数:</strong> {validation.constants.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onCancel}>
            取消
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={!isExpressionValid || !name.trim()}
          >
            {signal ? '更新' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};
