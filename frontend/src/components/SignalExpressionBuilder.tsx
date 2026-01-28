/**
 * Signal Expression Builder Component
 * 用于可视化构建信号表达式
 */

import React, { useState, useMemo } from 'react';
import { validateExpression } from '../utils/expressionParser';
import styles from './SignalExpressionBuilder.module.css';

interface SignalExpressionBuilderProps {
  expression: string;
  channelNames: string[];
  onExpressionChange: (expression: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export const SignalExpressionBuilder: React.FC<SignalExpressionBuilderProps> = ({
  expression,
  channelNames,
  onExpressionChange,
  onValidationChange,
}) => {
  const [showBuilder, setShowBuilder] = useState(false);

  // 验证表达式
  const validation = useMemo(() => {
    if (!expression.trim()) {
      return { isValid: false, error: '表达式为空' };
    }
    return validateExpression(expression, channelNames);
  }, [expression, channelNames]);

  React.useEffect(() => {
    onValidationChange?.(validation.isValid);
  }, [validation.isValid, onValidationChange]);

  const handleAddChannel = (channelName: string) => {
    if (!expression.trim()) {
      onExpressionChange(channelName);
    } else {
      onExpressionChange(`${expression} + ${channelName}`);
    }
  };

  const handleAddOperator = (operator: string) => {
    if (expression.trim()) {
      onExpressionChange(`${expression} ${operator} `);
    }
  };

  const handleAddParentheses = () => {
    if (!expression.trim()) {
      onExpressionChange('()');
    } else {
      onExpressionChange(`(${expression})`);
    }
  };

  const handleClear = () => {
    onExpressionChange('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.expressionDisplay}>
        <input
          type="text"
          value={expression}
          onChange={(e) => onExpressionChange(e.target.value)}
          placeholder="输入表达式或使用下方按钮构建"
          className={styles.expressionInput}
        />
        {validation.isValid ? (
          <span className={styles.validIcon}>✓</span>
        ) : (
          <span className={styles.invalidIcon}>✗</span>
        )}
      </div>

      {!validation.isValid && validation.error && (
        <div className={styles.errorMessage}>{validation.error}</div>
      )}

      {validation.isValid && (
        <div className={styles.validationInfo}>
          <div className={styles.referencedChannels}>
            <strong>通道:</strong> {validation.referencedChannels?.join(', ') || '无'}
          </div>
          {validation.constants && validation.constants.length > 0 && (
            <div className={styles.constants}>
              <strong>常数:</strong> {validation.constants.join(', ')}
            </div>
          )}
        </div>
      )}

      <button
        className={styles.toggleButton}
        onClick={() => setShowBuilder(!showBuilder)}
      >
        {showBuilder ? '隐藏构建器' : '显示构建器'}
      </button>

      {showBuilder && (
        <div className={styles.builder}>
          <div className={styles.section}>
            <h4>通道</h4>
            <div className={styles.buttonGroup}>
              {channelNames.map((channel) => (
                <button
                  key={channel}
                  className={styles.channelButton}
                  onClick={() => handleAddChannel(channel)}
                >
                  {channel}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h4>操作符</h4>
            <div className={styles.buttonGroup}>
              <button
                className={styles.operatorButton}
                onClick={() => handleAddOperator('+')}
              >
                +
              </button>
              <button
                className={styles.operatorButton}
                onClick={() => handleAddOperator('-')}
              >
                −
              </button>
              <button
                className={styles.operatorButton}
                onClick={() => handleAddOperator('*')}
              >
                ×
              </button>
              <button
                className={styles.operatorButton}
                onClick={() => handleAddOperator('/')}
              >
                ÷
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h4>括号</h4>
            <div className={styles.buttonGroup}>
              <button
                className={styles.parenButton}
                onClick={handleAddParentheses}
              >
                ( )
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <button className={styles.clearButton} onClick={handleClear}>
              清空
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
