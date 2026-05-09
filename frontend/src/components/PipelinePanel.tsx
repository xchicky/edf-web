import React, { useState } from 'react';
import { usePipelineStore, pipelineAnnotationToAnnotation } from '../store/pipelineStore';
import { useEDFStore } from '../store/edfStore';
import { useAnnotationStore } from '../store/annotationStore';
import {
  PREPROCESS_STEP_DEFINITIONS,
  ANALYSIS_STEP_DEFINITIONS,
  type PipelineStep,
  type StepLog,
} from '../types/pipeline';
import styles from './PipelinePanel.module.css';

interface StepDef {
  name: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    default: number;
    min: number;
    max: number;
    description: string;
  }>;
}

const ALL_STEP_DEFS: Record<string, StepDef> = {
  ...PREPROCESS_STEP_DEFINITIONS,
  ...ANALYSIS_STEP_DEFINITIONS,
};

export function PipelinePanel() {
  const steps = usePipelineStore((s) => s.steps);
  const isProcessing = usePipelineStore((s) => s.isProcessing);
  const error = usePipelineStore((s) => s.error);
  const isVisible = usePipelineStore((s) => s.isVisible);
  const showOverlay = usePipelineStore((s) => s.showProcessedOverlay);
  const stepLogs = usePipelineStore((s) => s.stepLogs);
  const processedWaveform = usePipelineStore((s) => s.processedWaveform);
  const pipelineAnnotations = usePipelineStore((s) => s.pipelineAnnotations);

  const addStep = usePipelineStore((s) => s.addStep);
  const removeStep = usePipelineStore((s) => s.removeStep);
  const updateStep = usePipelineStore((s) => s.updateStep);
  const reorderSteps = usePipelineStore((s) => s.reorderSteps);
  const toggleStep = usePipelineStore((s) => s.toggleStep);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const toggleVisibility = usePipelineStore((s) => s.toggleVisibility);
  const toggleOverlay = usePipelineStore((s) => s.toggleOverlay);
  const clearPipeline = usePipelineStore((s) => s.clearPipeline);
  const resetToDefault = usePipelineStore((s) => s.resetToDefault);

  const metadata = useEDFStore((s) => s.metadata);
  const selectionStart = useEDFStore((s) => s.selectionStart);
  const selectionEnd = useEDFStore((s) => s.selectionEnd);
  const hasSelection = useEDFStore((s) => s.hasSelection);

  const addAnnotationsToStore = useAnnotationStore((s) => s.addAnnotationsToStore);

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleRun = async () => {
    if (!metadata) return;
    const start = hasSelection && selectionStart !== null ? selectionStart : 0;
    const duration = hasSelection && selectionStart !== null && selectionEnd !== null
      ? selectionEnd - selectionStart
      : Math.min(10, metadata.duration_seconds);

    try {
      const annotations = await runPipeline(
        metadata.file_id,
        start,
        duration,
        metadata.channel_names,
      );
      if (annotations.length > 0) {
        const converted = annotations.map(pipelineAnnotationToAnnotation);
        addAnnotationsToStore(converted);
      }
    } catch (e) {
      console.error('Pipeline run failed:', e);
    }
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    reorderSteps(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  if (!isVisible) return null;

  const totalTime = stepLogs.reduce(
    (acc: number, log: StepLog) => acc + log.duration_ms,
    0,
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>处理流水线</h3>
        <button onClick={toggleVisibility} className={styles.closeBtn} title="关闭">✕</button>
      </div>

      <div className={styles.toolbar}>
        <button
          onClick={handleRun}
          disabled={isProcessing}
          className={`${styles.runBtn} ${isProcessing ? styles.running : ''}`}
        >
          {isProcessing ? '运行中...' : '▶ 运行'}
        </button>
        <button
          onClick={toggleOverlay}
          className={`${styles.overlayBtn} ${showOverlay ? styles.overlayActive : ''}`}
          title="切换处理后波形叠加显示"
        >
          👁 {showOverlay ? '叠加' : '隐藏'}
        </button>
        <button onClick={clearPipeline} className={styles.clearBtn} title="清除结果">清除</button>
        <button onClick={resetToDefault} className={styles.resetBtn} title="重置步骤">重置</button>
      </div>

      <AddStepMenu onAdd={addStep} />

      <div className={styles.stepsList}>
        {steps.map((step: PipelineStep, index: number) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onRemove={() => removeStep(step.id)}
            onToggle={() => toggleStep(step.id)}
            onUpdate={(updates) => updateStep(step.id, updates)}
            log={stepLogs.find((l: StepLog) => l.step_id === step.id)}
          />
        ))}
      </div>

      {error && <div className={styles.error}>错误: {error}</div>}

      {processedWaveform && (
        <div className={styles.results}>
          <div>处理后波形 ✓</div>
          <div>标注 {pipelineAnnotations.length} 条</div>
          {stepLogs.length > 0 && <div>耗时 {totalTime}ms</div>}
        </div>
      )}
    </div>
  );
}

function AddStepMenu({ onAdd }: { onAdd: (category: 'preprocess' | 'analysis', method: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const preprocessEntries = (Object.entries(PREPROCESS_STEP_DEFINITIONS) as [string, StepDef][])
    .filter(([key]) => key !== 'none');

  const analysisEntries = (Object.entries(ANALYSIS_STEP_DEFINITIONS) as [string, StepDef][]);

  return (
    <div className={styles.addStepMenu}>
      <button onClick={() => setIsOpen(!isOpen)} className={styles.addStepBtn}>
        + 添加步骤 ▾
      </button>
      {isOpen && (
        <div className={styles.addStepDropdown}>
          <div className={styles.category}>预处理</div>
          {preprocessEntries.map(([key, def]) => (
            <button
              key={key}
              onClick={() => { onAdd('preprocess', key); setIsOpen(false); }}
              className={styles.stepOption}
              title={def.description}
            >
              {def.name}
            </button>
          ))}
          <div className={styles.category}>分析</div>
          {analysisEntries.map(([key, def]) => (
            <button
              key={key}
              onClick={() => { onAdd('analysis', key); setIsOpen(false); }}
              className={styles.stepOption}
              title={def.description}
            >
              {def.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRemove,
  onToggle,
  onUpdate,
  log,
}: {
  step: PipelineStep;
  index: number;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onToggle: () => void;
  onUpdate: (updates: Partial<PipelineStep>) => void;
  log?: StepLog;
}) {
  const def = ALL_STEP_DEFS[step.method];
  if (!def) return null;

  return (
    <div
      className={`${styles.stepCard} ${!step.enabled ? styles.disabled : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      <div className={styles.stepHeader}>
        <span className={styles.dragHandle}>≡</span>
        <span className={styles.stepNumber}>{index + 1}.</span>
        <span className={styles.stepName}>{def.name}</span>
        <div className={styles.stepActions}>
          <input
            type="checkbox"
            checked={step.enabled}
            onChange={onToggle}
            className={styles.enabledCheck}
          />
          <button onClick={onRemove} className={styles.removeBtn} title="删除">✕</button>
        </div>
      </div>

      {def.parameters && step.enabled && (
        <div className={styles.stepParams}>
          {(Object.entries(def.parameters) as [string, StepDef['parameters'] extends infer P ? P extends Record<string, infer V> ? V : never : never][]).map(([paramKey, paramDef]) => (
            <ParamSlider
              key={paramKey}
              label={paramDef.description}
              value={step.parameters[paramKey] ?? paramDef.default}
              min={paramDef.min}
              max={paramDef.max}
              step={paramDef.type === 'int' ? 1 : 0.1}
              onChange={(v) => onUpdate({ parameters: { ...step.parameters, [paramKey]: v } })}
            />
          ))}
        </div>
      )}

      {log && (
        <div className={`${styles.stepLog} ${log.status === 'success' ? styles.success : log.status === 'error' ? styles.error : styles.skipped}`}>
          {log.message}
        </div>
      )}
    </div>
  );
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.paramRow}>
      <span className={styles.paramLabel}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={styles.paramSlider}
      />
      <span className={styles.paramValue}>{value.toFixed(step < 1 ? 1 : 0)}</span>
    </div>
  );
}
