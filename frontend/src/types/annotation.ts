export interface Annotation {
  id: string;
  annotation_type: string;
  source: "preprocess" | "band_analysis" | "anomaly_detection" | "user";
  channel: string | null;
  start_time: number;
  end_time: number;
  label: string;
  color: string;
  severity: number;
  confidence: number;
  metadata: Record<string, unknown>;
  is_user_created: boolean;
  created_at: string | null;
}

export interface AnnotationSet {
  file_id: string;
  annotations: Annotation[];
  summary: Record<string, number>;
  generated_at: string;
}

export interface AnnotationFilter {
  types?: string[];
  channels?: string[];
  startTime?: number;
  endTime?: number;
}

export const ANNOTATION_RENDER_CONFIG: Record<
  string,
  {
    mode: "highlight" | "marker" | "label";
    opacity: number;
    icon?: string;
  }
> = {
  artifact_eog: { mode: "highlight", opacity: 0.2 },
  artifact_emg: { mode: "highlight", opacity: 0.2 },
  artifact_flat: { mode: "highlight", opacity: 0.15 },
  artifact_drift: { mode: "highlight", opacity: 0.15 },
  artifact_jump: { mode: "highlight", opacity: 0.15 },
  band_dominant: { mode: "label", opacity: 0.9 },
  anomaly_spike: { mode: "marker", opacity: 0.9, icon: "▲" },
  anomaly_sharp_wave: { mode: "marker", opacity: 0.9, icon: "◆" },
  anomaly_spike_and_slow: { mode: "highlight", opacity: 0.25 },
  anomaly_slow_wave: { mode: "highlight", opacity: 0.2 },
  anomaly_rhythmic: { mode: "highlight", opacity: 0.2 },
  user_note: { mode: "marker", opacity: 1.0, icon: "📌" },
};

export const ALL_ANNOTATION_TYPES = Object.keys(ANNOTATION_RENDER_CONFIG);

export const ANNOTATION_TYPES_BY_SOURCE: Record<string, string[]> = {
  preprocess: [
    "artifact_eog",
    "artifact_emg",
    "artifact_flat",
    "artifact_drift",
    "artifact_jump",
  ],
  band_analysis: ["band_dominant"],
  anomaly_detection: [
    "anomaly_spike",
    "anomaly_sharp_wave",
    "anomaly_spike_and_slow",
    "anomaly_slow_wave",
    "anomaly_rhythmic",
  ],
  user: ["user_note"],
};
