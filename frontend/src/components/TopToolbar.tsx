import type { EDFMetadata } from '../api/edf';
import { EegParamControls } from './EegParamControls';
import styles from './TopToolbar.module.css';

interface TopToolbarProps {
  metadata: EDFMetadata | null;
  isLoading: boolean;
  error: string | null;
  amplitudeScale: number;
  tcValue: number | null;
  hfValue: number | null;
  onAmplitudeChange: (scale: number) => void;
  onTcChange: (tc: number | null) => void;
  onHfChange: (hf: number | null) => void;
  onUploadClick: () => void;
  onToggleHelp: () => void;
}

export function TopToolbar({
  metadata,
  isLoading,
  error,
  amplitudeScale,
  tcValue,
  hfValue,
  onAmplitudeChange,
  onTcChange,
  onHfChange,
  onUploadClick,
  onToggleHelp,
}: TopToolbarProps) {
  return (
    <>
      <div className={styles.left}>
        <h1 className={styles.title}>EDF Viewer</h1>
        {metadata && (
          <EegParamControls
            amplitudeScale={amplitudeScale}
            tcValue={tcValue}
            hfValue={hfValue}
            onAmplitudeChange={onAmplitudeChange}
            onTcChange={onTcChange}
            onHfChange={onHfChange}
            disabled={isLoading}
          />
        )}
      </div>

      <div className={styles.center}>
        {metadata && (
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{metadata.filename}</span>
            <span className={styles.separator}>|</span>
            <span>{metadata.n_channels} ch</span>
            <span className={styles.separator}>|</span>
            <span>{metadata.duration_minutes.toFixed(1)} min</span>
            <span className={styles.separator}>|</span>
            <span>{metadata.sfreq} Hz</span>
          </div>
        )}
        {isLoading && <span className={styles.loading}>Loading...</span>}
        {error && <span className={styles.error}>{error}</span>}
      </div>

      <div className={styles.right}>
        <button
          onClick={onUploadClick}
          className={styles.uploadBtn}
          title="Open EDF File"
        >
          Open EDF
        </button>
        <button
          onClick={onToggleHelp}
          className={styles.iconBtn}
          title="Keyboard Shortcuts (?)"
        >
          ?
        </button>
      </div>
    </>
  );
}
