interface EegParamControlsProps {
  amplitudeScale: number;
  tcValue: number | null;
  hfValue: number | null;
  onAmplitudeChange: (scale: number) => void;
  onTcChange: (tc: number | null) => void;
  onHfChange: (hf: number | null) => void;
  disabled?: boolean;
}

const SENS_PRESETS = [0.1, 0.2, 0.5, 1, 2, 5, 10];
const TC_PRESETS: { label: string; value: number | null }[] = [
  { label: 'OFF', value: null },
  { label: '0.03s', value: 0.03 },
  { label: '0.1s', value: 0.1 },
  { label: '0.3s', value: 0.3 },
  { label: '1.0s', value: 1.0 },
  { label: '2.0s', value: 2.0 },
  { label: '5.0s', value: 5.0 },
];
const HF_PRESETS: { label: string; value: number | null }[] = [
  { label: 'OFF', value: null },
  { label: '15Hz', value: 15 },
  { label: '30Hz', value: 30 },
  { label: '50Hz', value: 50 },
  { label: '70Hz', value: 70 },
  { label: '100Hz', value: 100 },
  { label: '200Hz', value: 200 },
];

export function EegParamControls({
  amplitudeScale,
  tcValue,
  hfValue,
  onAmplitudeChange,
  onTcChange,
  onHfChange,
  disabled = false,
}: EegParamControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.param}>
        <span className={styles.label}>Sens</span>
        <select
          className={styles.select}
          value={amplitudeScale}
          onChange={(e) => onAmplitudeChange(Number(e.target.value))}
          disabled={disabled}
        >
          {SENS_PRESETS.map((v) => (
            <option key={v} value={v}>
              {v}x
            </option>
          ))}
        </select>
      </div>

      <div className={styles.param}>
        <span className={styles.label}>TC</span>
        <select
          className={styles.select}
          value={tcValue ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onTcChange(v === '' ? null : Number(v));
          }}
          disabled={disabled}
        >
          {TC_PRESETS.map((p) => (
            <option key={p.label} value={p.value ?? ''}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.param}>
        <span className={styles.label}>HF</span>
        <select
          className={styles.select}
          value={hfValue ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onHfChange(v === '' ? null : Number(v));
          }}
          disabled={disabled}
        >
          {HF_PRESETS.map((p) => (
            <option key={p.label} value={p.value ?? ''}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

import styles from './EegParamControls.module.css';
