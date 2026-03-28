import { useState, useCallback } from "react";
import { useAnnotationStore } from "../store/annotationStore";
import {
  ANNOTATION_TYPES_BY_SOURCE,
  ANNOTATION_RENDER_CONFIG,
} from "../types/annotation";
import type { Annotation } from "../types/annotation";
import styles from "./AnnotationPanel.module.css";

const TYPE_LABELS: Record<string, string> = {
  artifact_eog: "EOG 眼电伪迹",
  artifact_emg: "EMG 肌电伪迹",
  artifact_flat: "平坦信号",
  artifact_drift: "信号漂移",
  artifact_jump: "信号跳变",
  band_dominant: "优势频段",
  anomaly_spike: "棘波",
  anomaly_sharp_wave: "尖波",
  anomaly_spike_and_slow: "棘慢复合波",
  anomaly_slow_wave: "慢波异常",
  anomaly_rhythmic: "节律异常",
  user_note: "用户标注",
};

const SOURCE_LABELS: Record<string, string> = {
  preprocess: "伪迹检测",
  band_analysis: "频段分析",
  anomaly_detection: "异常检测",
  user: "用户标注",
};

const SOURCE_ORDER = [
  "preprocess",
  "band_analysis",
  "anomaly_detection",
  "user",
];

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return mins > 0
    ? `${mins}:${parseFloat(secs).toFixed(1).padStart(4, "0")}`
    : `${secs}s`;
};

interface AnnotationPanelProps {
  fileId: string | null;
  channels: string[];
  onJumpToTime?: (time: number) => void;
}

export function AnnotationPanel({
  fileId,
  channels,
  onJumpToTime,
}: AnnotationPanelProps) {
  const annotationSet = useAnnotationStore((s) => s.annotationSet);
  const visibilityFilter = useAnnotationStore((s) => s.visibilityFilter);
  const isLoading = useAnnotationStore((s) => s.isLoading);
  const toggleTypeVisibility = useAnnotationStore(
    (s) => s.toggleTypeVisibility
  );
  const addUserAnnotation = useAnnotationStore((s) => s.addUserAnnotation);
  const deleteUserAnnotation = useAnnotationStore(
    (s) => s.deleteUserAnnotation
  );
  const getVisibleAnnotations = useAnnotationStore(
    (s) => s.getVisibleAnnotations
  );

  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    channel: "",
    startTime: "",
    endTime: "",
    label: "",
  });

  const toggleGroup = useCallback((source: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [source]: !prev[source],
    }));
  }, []);

  const visibleAnnotations = getVisibleAnnotations();

  const handleAddAnnotation = useCallback(async () => {
    if (!fileId) return;

    const startTime = parseFloat(newAnnotation.startTime);
    const endTime = parseFloat(newAnnotation.endTime);

    if (
      !newAnnotation.channel ||
      isNaN(startTime) ||
      isNaN(endTime) ||
      !newAnnotation.label
    ) {
      return;
    }

    await addUserAnnotation(fileId, {
      annotation_type: "user_note",
      channel: newAnnotation.channel,
      start_time: startTime,
      end_time: endTime,
      label: newAnnotation.label,
      note: "",
    });

    setNewAnnotation({ channel: "", startTime: "", endTime: "", label: "" });
    setShowAddForm(false);
  }, [fileId, newAnnotation, addUserAnnotation]);

  const handleDeleteAnnotation = useCallback(
    (annotationId: string) => {
      if (!fileId) return;
      deleteUserAnnotation(fileId, annotationId);
    },
    [fileId, deleteUserAnnotation]
  );

  if (!annotationSet) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>标注分析</div>
        <div className={styles.emptyState}>
          {isLoading ? (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              加载中...
            </div>
          ) : (
            "暂无标注数据，请先加载 EDF 文件"
          )}
        </div>
      </div>
    );
  }

  const totalAnnotations = annotationSet.annotations.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>标注分析</div>
      <div className={styles.summary}>共 {totalAnnotations} 条标注</div>

      {SOURCE_ORDER.map((source) => {
        const types = ANNOTATION_TYPES_BY_SOURCE[source];
        if (!types) return null;

        const isCollapsed = collapsedGroups[source] ?? false;
        const sourceAnnotations = visibleAnnotations.filter(
          (a: Annotation) => a.source === source
        );

        return (
          <div key={source} className={styles.sourceGroup}>
            <div
              className={styles.sourceHeader}
              onClick={() => toggleGroup(source)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggleGroup(source);
              }}
            >
              <span className={styles.collapseIcon}>
                {isCollapsed ? "▶" : "▼"}
              </span>
              <span className={styles.sourceLabel}>
                {SOURCE_LABELS[source]}
              </span>
              <span className={styles.sourceCount}>
                {sourceAnnotations.length}
              </span>
            </div>

            {!isCollapsed && (
              <div className={styles.sourceContent}>
                <div className={styles.typeFilters}>
                  {types.map((type) => {
                    const count = annotationSet.summary[type] ?? 0;
                    if (count === 0) return null;
                    const isVisible = visibilityFilter[type] !== false;

                    return (
                      <label key={type} className={styles.typeRow}>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleTypeVisibility(type)}
                          className={styles.typeCheckbox}
                        />
                        <span
                          className={styles.typeDot}
                          style={{
                            backgroundColor:
                              ANNOTATION_RENDER_CONFIG[type]?.mode === "marker"
                                ? "#EF4444"
                                : "#6366f1",
                          }}
                        />
                        <span className={styles.typeName}>
                          {TYPE_LABELS[type] ?? type}
                        </span>
                        <span className={styles.typeCount}>{count}</span>
                      </label>
                    );
                  })}
                </div>

                {sourceAnnotations.length > 0 && (
                  <div className={styles.annotationList}>
                    {sourceAnnotations.map((annotation: Annotation) => (
                      <div
                        key={annotation.id}
                        className={styles.annotationItem}
                        onClick={() => onJumpToTime?.(annotation.start_time)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            onJumpToTime?.(annotation.start_time);
                        }}
                      >
                        <div className={styles.annotationTime}>
                          {formatTime(annotation.start_time)} -{" "}
                          {formatTime(annotation.end_time)}
                        </div>
                        <div className={styles.annotationChannel}>
                          {annotation.channel ?? "全局"}
                        </div>
                        <div className={styles.annotationLabel}>
                          {annotation.label}
                        </div>
                        {annotation.is_user_created && (
                          <button
                            className={styles.deleteButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnnotation(annotation.id);
                            }}
                            title="删除标注"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className={styles.userActions}>
        {!showAddForm ? (
          <button
            className={styles.addButton}
            onClick={() => setShowAddForm(true)}
          >
            + 添加用户标注
          </button>
        ) : (
          <div className={styles.addForm}>
            <select
              className={styles.formSelect}
              value={newAnnotation.channel}
              onChange={(e) =>
                setNewAnnotation((prev) => ({
                  ...prev,
                  channel: e.target.value,
                }))
              }
            >
              <option value="">选择通道</option>
              {channels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
            <input
              className={styles.formInput}
              type="number"
              placeholder="开始时间 (秒)"
              value={newAnnotation.startTime}
              onChange={(e) =>
                setNewAnnotation((prev) => ({
                  ...prev,
                  startTime: e.target.value,
                }))
              }
              step="0.1"
            />
            <input
              className={styles.formInput}
              type="number"
              placeholder="结束时间 (秒)"
              value={newAnnotation.endTime}
              onChange={(e) =>
                setNewAnnotation((prev) => ({
                  ...prev,
                  endTime: e.target.value,
                }))
              }
              step="0.1"
            />
            <input
              className={styles.formInput}
              type="text"
              placeholder="标签"
              value={newAnnotation.label}
              onChange={(e) =>
                setNewAnnotation((prev) => ({
                  ...prev,
                  label: e.target.value,
                }))
              }
            />
            <div className={styles.formButtons}>
              <button
                className={styles.submitButton}
                onClick={handleAddAnnotation}
              >
                提交
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowAddForm(false);
                  setNewAnnotation({
                    channel: "",
                    startTime: "",
                    endTime: "",
                    label: "",
                  });
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
