/**
 * ModeEditor 组件
 * 用于创建和编辑自定义 EEG 分析模式
 */

import { useState, useEffect, useCallback } from 'react';
import { useEDFStore } from '../store/edfStore';
import { SignalExpressionBuilder } from './SignalExpressionBuilder';
import type { Mode, ModeCategory, ModeSignalConfig, ModeConfig, Operand } from '../types/mode';
import { MODE_CATEGORIES, DEFAULT_MODE_CONFIG, DEFAULT_BANDS } from '../types/mode';
import { createMode, updateMode, deleteMode } from '../api/mode';
import { extractOperands } from '../utils/expressionParser';
import styles from './ModeEditor.module.css';

export interface ModeEditorProps {
  /**
   * 是否显示编辑器
   */
  isOpen: boolean;

  /**
   * 要编辑的模式（null 表示创建新模式）
   */
  mode: Mode | null;

  /**
   * 可用通道名称列表
   */
  availableChannels: string[];

  /**
   * 保存回调
   */
  onSave: (mode: Mode) => void;

  /**
   * 取消回调
   */
  onCancel: () => void;

  /**
   * 删除回调
   */
  onDelete?: (modeId: string) => void;

  /**
   * 自定义类名
   */
  className?: string;
}

export function ModeEditor({
  isOpen,
  mode,
  availableChannels,
  onSave,
  onCancel,
  onDelete,
  className = '',
}: ModeEditorProps) {
  const { metadata } = useEDFStore();

  // 表单状态
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ModeCategory>('custom');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // 视图配置状态
  const [timeWindow, setTimeWindow] = useState(10);
  const [amplitudeScale, setAmplitudeScale] = useState(1.0);
  const [showGrid, setShowGrid] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // 通道配置状态
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set());

  // 派生信号状态
  const [signals, setSignals] = useState<ModeSignalConfig[]>([]);

  // 编辑中的信号
  const [editingSignalIndex, setEditingSignalIndex] = useState<number | null>(null);
  const [signalName, setSignalName] = useState('');
  const [signalExpression, setSignalExpression] = useState('');
  const [signalOperands, setSignalOperands] = useState<Operand[]>([]);
  const [signalColor, setSignalColor] = useState('#ef4444');
  const [signalEnabled, setSignalEnabled] = useState(true);
  const [isExpressionValid, setIsExpressionValid] = useState(false);

  // 错误状态
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // 删除相关状态
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 初始化表单数据
  useEffect(() => {
    if (mode) {
      setName(mode.name);
      setCategory(mode.category);
      setDescription(mode.description || '');
      setTags(mode.tags || []);

      const config = mode.config;
      setTimeWindow(config.timeWindow);
      setAmplitudeScale(config.amplitudeScale);
      setShowGrid(config.showGrid);
      setShowAnnotations(config.showAnnotations);

      // 通道配置
      const channelSet = new Set(
        config.displayChannels
          .filter((dc) => dc.visible)
          .map((dc) => dc.channelIndex)
      );
      setSelectedChannels(channelSet);

      // 派生信号配置
      setSignals(config.signals || []);
    } else {
      // 默认值
      setName('');
      setCategory('custom');
      setDescription('');
      setTags([]);
      setTimeWindow(10);
      setAmplitudeScale(1.0);
      setShowGrid(true);
      setShowAnnotations(true);
      setSelectedChannels(new Set());
      setSignals([]);
    }
  }, [mode, isOpen]);

  // 验证表单
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '请输入模式名称';
    }

    if (selectedChannels.size === 0) {
      newErrors.channels = '请至少选择一个通道';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, selectedChannels.size]);

  // 保存模式
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // 构建模式配置
      const config: ModeConfig = {
        viewMode: 'waveform',
        timeWindow,
        amplitudeScale,
        showGrid,
        showAnnotations,
        displayChannels: Array.from(selectedChannels).map((idx) => ({
          channelName: availableChannels[idx] || `Ch${idx}`,
          channelIndex: idx,
          visible: true,
        })),
        enableFilter: false,
        bands: DEFAULT_BANDS,
        signals,
        analysis: {
          enabled: false,
          type: 'stats',
          autoUpdate: false,
        },
        autoSave: true,
        maxBookmarks: 50,
      };

      let savedMode: Mode;

      if (mode) {
        // 更新现有模式
        savedMode = await updateMode(mode.id, {
          name,
          category,
          description,
          config,
          tags,
        });
      } else {
        // 创建新模式
        savedMode = await createMode({
          name,
          category,
          description,
          config,
          tags,
        });
      }

      onSave(savedMode);
    } catch (error) {
      console.error('Failed to save mode:', error);
      setErrors({ general: '保存模式失败，请稍后重试' });
    } finally {
      setIsLoading(false);
    }
  };

  // 添加派生信号
  const handleAddSignal = () => {
    setEditingSignalIndex(-1); // -1 表示新建
    setSignalName('');
    setSignalExpression('');
    setSignalOperands([]);
    setSignalColor('#ef4444');
    setSignalEnabled(true);
    setIsExpressionValid(false);
  };

  // 编辑派生信号
  const handleEditSignal = (index: number) => {
    const signal = signals[index];
    setEditingSignalIndex(index);
    setSignalName(signal.name);
    setSignalExpression(signal.expression);
    setSignalOperands(signal.operands);
    setSignalColor(signal.color || '#ef4444');
    setSignalEnabled(signal.enabled);
    // 初始化验证状态（假设已保存的信号都是有效的）
    setIsExpressionValid(true);
  };

  // 保存派生信号
  const handleSaveSignal = () => {
    if (!signalName.trim() || !signalExpression.trim() || !isExpressionValid) {
      return;
    }

    // 提取操作数
    let operands: Operand[] = [];
    try {
      operands = extractOperands(signalExpression, availableChannels);
    } catch (error) {
      console.error('Failed to extract operands:', error);
      return;
    }

    const newSignal: ModeSignalConfig = {
      id: editingSignalIndex === -1
        ? `sig-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
        : signals[editingSignalIndex!].id,
      name: signalName,
      expression: signalExpression,
      operands,
      color: signalColor,
      enabled: signalEnabled,
    };

    if (editingSignalIndex === -1) {
      setSignals([...signals, newSignal]);
    } else {
      const newSignals = [...signals];
      newSignals[editingSignalIndex!] = newSignal;
      setSignals(newSignals);
    }

    setEditingSignalIndex(null);
    setIsExpressionValid(false);
  };

  // 处理表达式变更
  const handleExpressionChange = (newExpression: string) => {
    setSignalExpression(newExpression);
  };

  // 处理表达式验证状态变更
  const handleValidationChange = (isValid: boolean) => {
    setIsExpressionValid(isValid);
  };

  // 删除派生信号
  const handleDeleteSignal = (index: number) => {
    setSignals(signals.filter((_, i) => i !== index));
  };

  // 取消编辑信号
  const handleCancelEditSignal = () => {
    setEditingSignalIndex(null);
  };

  // 删除模式
  const handleDeleteMode = async () => {
    if (!mode) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteMode(mode.id);
      // 删除成功，调用 onDelete 回调
      onDelete?.(mode.id);
      onCancel();
    } catch (error) {
      console.error('Failed to delete mode:', error);
      const errorMessage = error instanceof Error ? error.message : '删除模式失败，请稍后重试';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 切换通道选中状态
  const toggleChannel = (index: number) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedChannels(newSelected);
  };

  // 全选/取消全选通道
  const toggleAllChannels = () => {
    if (selectedChannels.size === availableChannels.length) {
      setSelectedChannels(new Set());
    } else {
      setSelectedChannels(new Set(availableChannels.map((_, i) => i)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`${styles.backdrop} ${className}`}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {mode ? '编辑模式' : '创建新模式'}
          </h2>
          <button
            className={styles.closeButton}
            onClick={onCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {errors.general && (
            <div className={styles.errorMessage}>{errors.general}</div>
          )}

          {/* 基本信息 */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>基本信息</h3>
            <div className={styles.formGroup}>
              <label htmlFor="mode-name" className={styles.label}>
                模式名称 <span className={styles.required}>*</span>
              </label>
              <input
                id="mode-name"
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入模式名称"
              />
              {errors.name && <span className={styles.error}>{errors.name}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="mode-category" className={styles.label}>
                分类
              </label>
              <select
                id="mode-category"
                className={styles.select}
                value={category}
                onChange={(e) => setCategory(e.target.value as ModeCategory)}
              >
                {Object.entries(MODE_CATEGORIES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="mode-description" className={styles.label}>
                描述
              </label>
              <textarea
                id="mode-description"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入模式描述"
                rows={2}
              />
            </div>
          </section>

          {/* 视图配置 */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>视图配置</h3>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="time-window" className={styles.label}>
                  时间窗口 (秒)
                </label>
                <input
                  id="time-window"
                  type="number"
                  className={styles.input}
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(Number(e.target.value))}
                  min={1}
                  max={300}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="amplitude-scale" className={styles.label}>
                  振幅缩放
                </label>
                <input
                  id="amplitude-scale"
                  type="number"
                  className={styles.input}
                  value={amplitudeScale}
                  onChange={(e) => setAmplitudeScale(Number(e.target.value))}
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                显示网格
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showAnnotations}
                  onChange={(e) => setShowAnnotations(e.target.checked)}
                />
                显示标注
              </label>
            </div>
          </section>

          {/* 通道配置 */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              通道配置
              <button
                type="button"
                className={styles.textButton}
                onClick={toggleAllChannels}
              >
                {selectedChannels.size === availableChannels.length
                  ? '取消全选'
                  : '全选'}
              </button>
            </h3>
            {errors.channels && <span className={styles.error}>{errors.channels}</span>}
            <div className={styles.channelGrid}>
              {availableChannels.map((channel, index) => (
                <label key={index} className={styles.channelCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(index)}
                    onChange={() => toggleChannel(index)}
                  />
                  <span>{channel}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 派生信号配置 */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              派生信号
              <button
                type="button"
                className={styles.addButton}
                onClick={handleAddSignal}
              >
                + 添加信号
              </button>
            </h3>

            {/* 信号编辑器 */}
            {editingSignalIndex !== null && (
              <div className={styles.signalEditor}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>信号名称</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={signalName}
                    onChange={(e) => setSignalName(e.target.value)}
                    placeholder="如: Fp1-F3 差值"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>表达式</label>
                  <SignalExpressionBuilder
                    expression={signalExpression}
                    channelNames={availableChannels}
                    onExpressionChange={handleExpressionChange}
                    onValidationChange={handleValidationChange}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>颜色</label>
                    <input
                      type="color"
                      value={signalColor}
                      onChange={(e) => setSignalColor(e.target.value)}
                    />
                  </div>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={signalEnabled}
                      onChange={(e) => setSignalEnabled(e.target.checked)}
                    />
                    启用
                  </label>
                </div>
                <div className={styles.buttonGroup}>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={handleSaveSignal}
                    disabled={!signalName.trim() || !signalExpression.trim() || !isExpressionValid}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={handleCancelEditSignal}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 信号列表 */}
            <div className={styles.signalList}>
              {signals.map((signal, index) => (
                <div key={signal.id} className={styles.signalItem}>
                  <div className={styles.signalInfo}>
                    <span
                      className={styles.signalColor}
                      style={{ backgroundColor: signal.color }}
                    />
                    <div>
                      <div className={styles.signalName}>{signal.name}</div>
                      <div className={styles.signalExpression}>{signal.expression}</div>
                    </div>
                    {!signal.enabled && (
                      <span className={styles.signalDisabled}>(已禁用)</span>
                    )}
                  </div>
                  <div className={styles.signalActions}>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => handleEditSignal(index)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => handleDeleteSignal(index)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {signals.length === 0 && editingSignalIndex === null && (
                <div className={styles.emptyText}>
                  暂无派生信号，点击上方"添加信号"按钮创建
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {deleteError && (
            <div className={styles.deleteErrorMessage}>{deleteError}</div>
          )}
          <div className={styles.footerButtons}>
            {mode && !mode.isBuiltIn && (
              <button
                type="button"
                className={`${styles.button} ${styles.deleteButton}`}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading || isDeleting}
                title="删除此模式"
              >
                删除
              </button>
            )}
            <button
              type="button"
              className={`${styles.button} ${styles.cancelButton}`}
              onClick={onCancel}
              disabled={isLoading || isDeleting}
            >
              取消
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.saveButton}`}
              onClick={handleSave}
              disabled={isLoading || isDeleting}
            >
              {isLoading ? '保存中...' : mode ? '保存' : '创建'}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmDialog}>
              <h3 className={styles.confirmTitle}>确认删除</h3>
              <p className={styles.confirmMessage}>
                确定要删除模式 <strong>{mode?.name}</strong> 吗？此操作无法撤销。
              </p>
              <div className={styles.confirmButtons}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.cancelButton}`}
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.deleteButton}`}
                  onClick={handleDeleteMode}
                  disabled={isDeleting}
                >
                  {isDeleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
