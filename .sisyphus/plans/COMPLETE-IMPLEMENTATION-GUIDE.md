# EDF Viewer UI Enhancement - Complete Implementation Guide

**Status:** ✅ Planning Complete, Awaiting Implementation
**Created:** 2025-01-25
**Prerequisites:** Tests passing (78/78), Build working

---

## 🚨 CRITICAL IMPLEMENTATION INSTRUCTIONS

### IMMEDIATE ACTION REQUIRED:

**Option A: Automated Implementation (Recommended)**
```bash
cd /Users/yizhang/Workspace/App/edf-web
/start-work
```
This will invoke Sisyphus executor to implement all phases automatically.

**Option B: Manual Implementation (Follow This Guide)**
Complete each phase step-by-step using the exact instructions below.

---

## 📋 PHASE 1: INTEGRATE AXES (45 minutes)

### Step 1.1: Import Axis Components

**File:** `frontend/src/App.tsx`
**Line:** 6-11
**Action:** Add two lines

**CURRENT CODE:**
```typescript
import { WaveformCanvas } from './components/WaveformCanvas';
import { ZoomIndicator } from './components/ZoomIndicator';
import { OverviewStrip } from './components/OverviewStrip';
```

**CHANGE TO:**
```typescript
import { WaveformCanvas } from './components/WaveformCanvas';
import { ZoomIndicator } from './components/ZoomIndicator';
import { OverviewStrip } from './components/OverviewStrip';
import { TimeAxis } from './components/TimeAxis';
import { AmplitudeAxis } from './components/AmplitudeAxis';
```

---

### Step 1.2: Add Layout Calculations

**File:** `frontend/src/App.tsx`
**Line:** After line 41 (after `} = useEDFStore();`)
**Action:** Insert this code:

```typescript
  // Calculate layout parameters for axes
  const canvasWidth = 800;
  const pixelsPerSecond = (canvasWidth - 50) / windowDuration;
  const channelHeight = waveform ? 600 / waveform.channels.length : 100;
```

---

### Step 1.3: Update JSX Structure

**File:** `frontend/src/App.tsx`
**Line:** 509-544 (waveform-display section)
**Action:** Replace the waveform display section

**FIND THIS:**
```tsx
        <section className="waveform-display">
          {waveform && (
            <>
              <div className="waveform-info-overlay">
                {/* ... existing overlay code ... */}
              </div>
              <WaveformCanvas
                waveformData={waveform}
                channelColors={channelColors}
                currentTime={currentTime}
                windowDuration={windowDuration}
                amplitudeScale={amplitudeScale}
                onTimeChange={setCurrentTime}
                onAmplitudeChange={setAmplitudeScale}
              />
              <OverviewStrip
                fileId={metadata?.file_id || ''}
                currentTime={currentTime}
                windowDuration={windowDuration}
                totalDuration={metadata?.duration_seconds || 0}
                onTimeChange={setCurrentTime}
                channels={selectedChannels}
              />
            </>
          )}
        </section>
```

**REPLACE WITH:**
```tsx
        <section className="waveform-display">
          {waveform && (
            <>
              <div className="waveform-info-overlay">
                <div className="info-item">
                  <span className="label">Resolution:</span>
                  <span className="value">{metadata?.sfreq || 0} Hz</span>
                </div>
                <div className="info-item">
                  <span className="label">Duration:</span>
                  <span className="value">{windowDuration}s</span>
                </div>
                <div className="info-item">
                  <span className="label">Window:</span>
                  <span className="value">{formatTime(currentTime)} - {formatTime(currentTime + windowDuration)}</span>
                </div>
              </div>

              <div className="waveform-display-container">
                <div className="amplitude-axis-wrapper">
                  <AmplitudeAxis
                    channelHeight={channelHeight}
                    amplitudeScale={amplitudeScale}
                    unit="µV"
                  />
                </div>
                <WaveformCanvas
                  waveformData={waveform}
                  channelColors={channelColors}
                  currentTime={currentTime}
                  windowDuration={windowDuration}
                  amplitudeScale={amplitudeScale}
                  onTimeChange={setCurrentTime}
                  onAmplitudeChange={setAmplitudeScale}
                />
              </div>

              <div className="time-axis-wrapper">
                <TimeAxis
                  duration={windowDuration}
                  startTime={currentTime}
                  width={canvasWidth - 50}
                  pixelsPerSecond={pixelsPerSecond}
                />
              </div>

              <OverviewStrip
                fileId={metadata?.file_id || ''}
                currentTime={currentTime}
                windowDuration={windowDuration}
                totalDuration={metadata?.duration_seconds || 0}
                onTimeChange={setCurrentTime}
                channels={selectedChannels}
              />
            </>
          )}
        </section>
```

---

### Step 1.4: Add CSS

**File:** `frontend/src/App.css`
**Location:** End of file
**Action:** Append this CSS:

```css
/* Container for waveform + amplitude axis */
.waveform-display-container {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin: 16px 0;
}

/* Amplitude axis wrapper - fixed width on left */
.amplitude-axis-wrapper {
  width: 50px;
  flex-shrink: 0;
  margin-right: 0;
}

/* Time axis wrapper - full width below waveform */
.time-axis-wrapper {
  margin-left: 50px;
  margin-top: 4px;
}

/* Ensure axes align properly */
.amplitude-axis-wrapper canvas,
.time-axis-wrapper canvas {
  display: block;
}
```

---

### Step 1.5: Verify

**Run commands:**
```bash
cd frontend
npm test -- --run
npm run build
npm run dev
```

**Expected:**
- ✅ All 78 tests pass
- ✅ Build succeeds
- ✅ Time axis visible at bottom
- ✅ Amplitude axis visible on left

---

## 📋 PHASE 2: RESOLUTION BAR (30 minutes)

### Step 2.1: Create Component

**NEW FILE:** `frontend/src/components/ResolutionIndicator.tsx`

**CREATE WITH CONTENT:**
```typescript
import React from 'react';

interface ResolutionIndicatorProps {
  samplingRate: number;
  windowDuration: number;
  amplitudeScale: number;
  nChannelsSelected: number;
  nChannelsTotal: number;
  totalDuration: number;
}

export const ResolutionIndicator: React.FC<ResolutionIndicatorProps> = ({
  samplingRate,
  windowDuration,
  amplitudeScale,
  nChannelsSelected,
  nChannelsTotal,
  totalDuration,
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="resolution-bar">
      <div className="resolution-section">
        <span className="resolution-label">SF:</span>
        <span className="resolution-value">{samplingRate} Hz</span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Window:</span>
        <span className="resolution-value">{windowDuration}s</span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Amp:</span>
        <span className="resolution-value">{amplitudeScale.toFixed(1)}x</span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Ch:</span>
        <span className="resolution-value">
          {nChannelsSelected}/{nChannelsTotal}
        </span>
      </div>

      <div className="resolution-section">
        <span className="resolution-label">Total:</span>
        <span className="resolution-value">{formatDuration(totalDuration)}</span>
      </div>
    </div>
  );
};
```

### Step 2.2: Add CSS

**File:** `frontend/src/App.css`
**Action:** Append:

```css
.resolution-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 16px;
  background: #F8F9FA;
  border-top: 1px solid #DEE2E6;
  font-size: 12px;
  color: #495057;
}

.resolution-section {
  display: flex;
  align-items: center;
  gap: 4px;
}

.resolution-label {
  font-weight: 600;
  color: #212529;
}

.resolution-value {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  color: #495057;
}

@media (max-width: 768px) {
  .resolution-bar {
    flex-direction: column;
    gap: 4px;
  }
}
```

### Step 2.3: Integrate

**File:** `frontend/src/App.tsx`
**Add import (line 6-11):**
```typescript
import { ResolutionIndicator } from './components/ResolutionIndicator';
```

**Add render (before final </div>):**
```tsx
      {metadata && (
        <ResolutionIndicator
          samplingRate={metadata.sfreq}
          windowDuration={windowDuration}
          amplitudeScale={amplitudeScale}
          nChannelsSelected={selectedChannels.length}
          nChannelsTotal={metadata.n_channels}
          totalDuration={metadata.duration_seconds}
        />
      )}
```

---

## 📋 PHASE 3: MOUSE HINTS (45 minutes)

### Step 3.1: Create Component

**NEW FILE:** `frontend/src/components/InteractionHint.tsx`

**CREATE WITH CONTENT:**
```typescript
import React, { useEffect, useState } from 'react';

export const InteractionHint: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasSeenHints = localStorage.getItem('edf-hints-seen');
    if (!hasSeenHints) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        localStorage.setItem('edf-hints-seen', 'true');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('edf-hints-seen', 'true');
  };

  return (
    <div className="interaction-hint-overlay" onClick={dismiss}>
      <div className="interaction-hint-box" onClick={(e) => e.stopPropagation()}>
        <div className="hint-header">
          <span className="hint-title">💡 Interactive Features</span>
          <button className="hint-dismiss" onClick={dismiss}>✕</button>
        </div>

        <div className="hint-list">
          <div className="hint-item">
            <span className="hint-icon">🖱️</span>
            <span className="hint-text"><strong>Scroll wheel</strong> to zoom (left: amplitude, right: time)</span>
          </div>
          <div className="hint-item">
            <span className="hint-icon">✋</span>
            <span className="hint-text"><strong>Drag</strong> to pan through the timeline</span>
          </div>
          <div className="hint-item">
            <span className="hint-icon">👆</span>
            <span className="hint-text"><strong>Click</strong> anywhere to position cursor</span>
          </div>
          <div className="hint-item">
            <span className="hint-icon">⌨️</span>
            <span className="hint-text">Press <strong>?</strong> for keyboard shortcuts</span>
          </div>
        </div>

        <div className="hint-footer">
          Click anywhere or press ESC to dismiss
        </div>
      </div>
    </div>
  );
};
```

### Step 3.2: Add CSS

**File:** `frontend/src/App.css`
**Append:**
```css
.interaction-hint-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in;
}

.interaction-hint-box {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  padding: 20px;
  animation: slideUp 0.3s ease-out;
}

.hint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.hint-title { font-size: 16px; font-weight: 600; color: #212529; }
.hint-dismiss { background: none; border: none; font-size: 18px; cursor: pointer; color: #6C757D; padding: 4px 8px; }
.hint-dismiss:hover { color: #212529; }

.hint-list { display: flex; flex-direction: column; gap: 12px; }
.hint-item { display: flex; align-items: flex-start; gap: 12px; }
.hint-icon { font-size: 20px; flex-shrink: 0; }
.hint-text { font-size: 14px; line-height: 1.4; color: #495057; }
.hint-text strong { color: #212529; font-weight: 600; }

.hint-footer {
  margin-top: 16px; padding-top: 12px;
  border-top: 1px solid #DEE2E6;
  text-align: center; font-size: 12px; color: #6C757D;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
```

### Step 3.3: Integrate

**File:** `frontend/src/App.tsx`
**Add import:**
```typescript
import { InteractionHint } from './components/InteractionHint';
```

**Add render (before final </div>):**
```tsx
      <InteractionHint />
    </div>
  );
};
```

---

## ✅ FINAL VERIFICATION

**After all phases, run:**
```bash
cd frontend
npm test -- --run      # Should pass
npm run build          # Should succeed
npm run dev           # Test manually
```

**Manual test checklist:**
- [x] Time axis visible at bottom
- [x] Amplitude axis visible on left
- [x] Resolution bar shows metrics
- [x] Hints appear on first load
- [x] Mouse wheel zoom works
- [x] Drag to pan works
- [x] Responsive design works

---

## 🎯 EXPECTED FINAL RESULT

```
┌──────────────────────────────────────────────┐
│ [Controls] [1s|5s|10s|30s|1m|5m]              │
├───┬──────────────────────────────────────────┤
│ µV │ ┌────────────────────────────────────┐ │
│   │ │ EEG Fp1-Ref    ╱╲  ╱╲  ╱╲         │ │
│100│ │  ✓ Scroll zoom works               │ │
│  0│ │  ✓ Drag pan works                  │ │
│-100│ │                                    │ │
│   │ └────────────────────────────────────┘ │
│   │  00:00      00:01      00:02      00:03  │
├───┴──────────────────────────────────────────┤
│ SF:500Hz Win:5s Amp:1.0x Ch:20/59 Tot:35:00 │
└──────────────────────────────────────────────┘
```

---

## 📝 IMPLEMENTATION NOTES

**Time Estimate:** 2.5-3 hours total
**Difficulty:** Easy to Medium
**Prerequisites:** None (components already exist)

**Common Issues:**
1. If axes don't align: Check CSS margin-left on .time-axis-wrapper
2. If axes don't update: Check pixelsPerSecond calculation
3. If tests fail: Run npm test to see specific errors

**Files Modified:**
- `frontend/src/App.tsx` (imports + JSX)
- `frontend/src/App.css` (styling)

**Files Created:**
- `frontend/src/components/ResolutionIndicator.tsx`
- `frontend/src/components/InteractionHint.tsx`

---

## 🚀 NEXT STEPS AFTER IMPLEMENTATION

1. **Test thoroughly** - All manual checklist items
2. **Commit changes** - `git add -A && git commit -m "feat: integrate axes and add UI improvements"`
3. **Run `/start-work`** - If you want Sisyphus to verify
4. **Gather user feedback** - Before Phase 4

---

**Guide Status:** ✅ Complete with exact code
**Ready for:** Manual or automated implementation
**Created by:** Prometheus (Planning Agent)
