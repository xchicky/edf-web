# EDF Viewer UI Enhancement - Implementation Plan

**Status:** ✅ Ready for Implementation
**Created:** 2025-01-25
**Estimated Time:** 2-3 hours
**Prerequisites:** Tests passing, build working ✅

---

## 🎯 OBJECTIVE

Integrate the existing TimeAxis and AmplitudeAxis components into the UI to address the user's main complaint about missing axis displays and resolution indicators.

---

## 📋 IMPLEMENTATION STEPS

### Phase 1: Integrate Axes (45 minutes) ⭐ HIGHEST PRIORITY

#### Step 1: Import Axis Components (2 minutes)

**File:** `frontend/src/App.tsx`
**Line:** 6-11 (imports section)

**ACTION:** Add two import statements

**BEFORE:**
```typescript
import { WaveformCanvas } from './components/WaveformCanvas';
import { ZoomIndicator } from './components/ZoomIndicator';
import { OverviewStrip } from './components/OverviewStrip';
```

**AFTER:**
```typescript
import { WaveformCanvas } from './components/WaveformCanvas';
import { ZoomIndicator } from './components/ZoomIndicator';
import { OverviewStrip } from './components/OverviewStrip';
import { TimeAxis } from './components/TimeAxis';
import { AmplitudeAxis } from './components/AmplitudeAxis';
```

**WHY:** TimeAxis and AmplitudeAxis already exist but aren't imported

---

#### Step 2: Calculate Layout Parameters (5 minutes)

**File:** `frontend/src/App.tsx`
**Location:** After line 41 (after useEDFStore hook)

**ACTION:** Add layout calculation code

**ADD THIS CODE:**
```typescript
  // Calculate layout parameters for axes
  const canvasWidth = 800; // Can be made dynamic later
  const pixelsPerSecond = (canvasWidth - 50) / windowDuration; // Subtract amplitude axis width
  const channelHeight = waveform ? 600 / waveform.channels.length : 100;
```

**WHY:**
- TimeAxis needs `width` and `pixelsPerSecond` props
- AmplitudeAxis needs `channelHeight` prop
- These update when windowDuration or waveform changes

---

#### Step 3: Create Waveform Display Container (10 minutes)

**File:** `frontend/src/App.tsx`
**Location:** Line 509-544 (waveform-display section)

**FIND THIS CODE:**
```tsx
        <section className="waveform-display">
          {waveform && (
            <>
              <div className="waveform-info-overlay">
                {/* ... info overlay ... */}
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

              {/* NEW: Waveform display container with axes */}
              <div className="waveform-display-container">
                {/* Amplitude Axis on LEFT */}
                <div className="amplitude-axis-wrapper">
                  <AmplitudeAxis
                    channelHeight={channelHeight}
                    amplitudeScale={amplitudeScale}
                    unit="µV"
                  />
                </div>

                {/* Waveform Canvas on RIGHT */}
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

              {/* NEW: Time Axis at BOTTOM */}
              <div className="time-axis-wrapper">
                <TimeAxis
                  duration={windowDuration}
                  startTime={currentTime}
                  width={canvasWidth - 50}  // Align with waveform, not amplitude axis
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

**WHY:**
- Flexbox layout puts amplitude axis on left (50px)
- WaveformCanvas takes remaining space
- TimeAxis renders below waveform (with 50px offset to align)

---

#### Step 4: Add CSS Styling (18 minutes)

**File:** `frontend/src/App.css`
**Location:** End of file

**ADD THIS CSS:**
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
  margin-left: 50px;  /* Offset to align with waveform, not amplitude axis */
  margin-top: 4px;
}

/* Ensure axes align properly */
.amplitude-axis-wrapper canvas,
.time-axis-wrapper canvas {
  display: block;
}
```

**WHY:**
- Creates horizontal layout: [Axis (50px) | Waveform]
- Time axis has 50px left margin to align under waveform only
- Fixed width prevents axis from squishing

---

#### Step 5: Verify Implementation (5 minutes)

**RUN TESTS:**
```bash
cd frontend
npm test -- --run
```

**Expected:** All 78 tests still pass

**RUN BUILD:**
```bash
npm run build
```

**Expected:** Build succeeds in <700ms

**START DEV SERVER:**
```bash
npm run dev
```

**MANUAL TESTING:**
1. Load an EDF file
2. Verify amplitude axis visible on left with voltage labels (µV)
3. Verify time axis visible at bottom with time labels (MM:SS)
4. Test mouse wheel zoom - axes should update
5. Test drag to pan - axes should update
6. Check responsive design (resize browser window)

**EXPECTED RESULT:**
```
┌──────────────────────────────────────────────┐
│ µV  ┌────────────────────────────────────┐   │
│     │ EEG Fp1-Ref    ╱╲  ╱╲  ╱╲         │   │
│100  │                ╱  ╲╱  ╲╱           │   │
│  0  ├────────────────────────────────────┤   │
│-100 │                 ╲╱    ╲╱           │   │
│     │                                    │   │
│     └────────────────────────────────────┘   │
│     00:00      00:01      00:02      00:03  │
└──────────────────────────────────────────────┘
```

**ACCEPTANCE CRITERIA:**
- [ ] Time axis visible at bottom
- [ ] Amplitude axis visible on left
- [ ] Axes show correct labels
- [ ] Axes update during zoom/pan
- [ ] No layout break on resize
- [ ] Tests pass
- [ ] Build succeeds

---

### Phase 2: Resolution Status Bar (30 minutes)

#### Step 1: Create ResolutionIndicator Component (15 minutes)

**NEW FILE:** `frontend/src/components/ResolutionIndicator.tsx`

**CREATE THIS FILE:**
```typescript
import React from 'react';

interface ResolutionIndicatorProps {
  samplingRate: number;        // Hz
  windowDuration: number;      // seconds
  amplitudeScale: number;      // multiplier
  nChannelsSelected: number;
  nChannelsTotal: number;
  totalDuration: number;       // seconds
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

#### Step 2: Add CSS (10 minutes)

**File:** `frontend/src/App.css`

**ADD:**
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

/* Responsive: stack on small screens */
@media (max-width: 768px) {
  .resolution-bar {
    flex-direction: column;
    gap: 4px;
  }
}
```

#### Step 3: Integrate in App.tsx (5 minutes)

**File:** `frontend/src/App.tsx`
**Location:** Line 6 (imports section)

**ADD IMPORT:**
```typescript
import { ResolutionIndicator } from './components/ResolutionIndicator';
```

**Location:** Before closing `</div>` of main container (around line 588)

**ADD RENDER:**
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
    </div>
```

---

### Phase 3: Mouse Interaction Hints (45 minutes)

#### Step 1: Create InteractionHint Component (20 minutes)

**NEW FILE:** `frontend/src/components/InteractionHint.tsx`

**CREATE THIS FILE:**
```typescript
import React, { useEffect, useState } from 'react';

export const InteractionHint: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has seen hints before
    const hasSeenHints = localStorage.getItem('edf-hints-seen');
    if (!hasSeenHints) {
      setVisible(true);
      // Auto-hide after 8 seconds
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
          <button className="hint-dismiss" onClick={dismiss}>
            ✕
          </button>
        </div>

        <div className="hint-list">
          <div className="hint-item">
            <span className="hint-icon">🖱️</span>
            <span className="hint-text">
              <strong>Scroll wheel</strong> to zoom (left: amplitude, right: time)
            </span>
          </div>

          <div className="hint-item">
            <span className="hint-icon">✋</span>
            <span className="hint-text">
              <strong>Drag</strong> to pan through the timeline
            </span>
          </div>

          <div className="hint-item">
            <span className="hint-icon">👆</span>
            <span className="hint-text">
              <strong>Click</strong> anywhere to position cursor
            </span>
          </div>

          <div className="hint-item">
            <span className="hint-icon">⌨️</span>
            <span className="hint-text">
              Press <strong>?</strong> for keyboard shortcuts
            </span>
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

#### Step 2: Add CSS (20 minutes)

**File:** `frontend/src/App.css`

**ADD:**
```css
.interaction-hint-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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

.hint-title {
  font-size: 16px;
  font-weight: 600;
  color: #212529;
}

.hint-dismiss {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #6C757D;
  padding: 4px 8px;
}

.hint-dismiss:hover {
  color: #212529;
}

.hint-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.hint-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.hint-text {
  font-size: 14px;
  line-height: 1.4;
  color: #495057;
}

.hint-text strong {
  color: #212529;
  font-weight: 600;
}

.hint-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #DEE2E6;
  text-align: center;
  font-size: 12px;
  color: #6C757D;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Step 3: Integrate in App.tsx (5 minutes)

**File:** `frontend/src/App.tsx`

**ADD IMPORT:**
```typescript
import { InteractionHint } from './components/InteractionHint';
```

**ADD RENDER:** Before final `</div>` (around line 589)

```tsx
      <InteractionHint />
    </div>
  );
};
```

---

### Phase 4: Enhanced Navigation (1 hour)

#### Step 1: Improve Preset Window Buttons (15 minutes)

**File:** `frontend/src/App.tsx`

**FIND:** Window duration buttons (around line 388-400)

**REPLACE WITH:**
```tsx
<div className="window-presets">
  <button
    onClick={() => setWindowDuration(1)}
    className={windowDuration === 1 ? 'active' : ''}
  >
    1s
  </button>
  <button
    onClick={() => setWindowDuration(5)}
    className={windowDuration === 5 ? 'active' : ''}
  >
    5s
  </button>
  <button
    onClick={() => setWindowDuration(10)}
    className={windowDuration === 10 ? 'active' : ''}
  >
    10s
  </button>
  <button
    onClick={() => setWindowDuration(30)}
    className={windowDuration === 30 ? 'active' : ''}
  >
    30s
  </button>
  <button
    onClick={() => setWindowDuration(60)}
    className={windowDuration === 60 ? 'active' : ''}
  >
    1m
  </button>
  <button
    onClick={() => setWindowDuration(300)}
    className={windowDuration === 300 ? 'active' : ''}
  >
    5m
  </button>
</div>
```

**CSS:**
```css
.window-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.window-presets button {
  padding: 6px 12px;
  border: 1px solid #DEE2E6;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.window-presets button:hover {
  background: #F8F9FA;
  border-color: #ADB5BD;
}

.window-presets button.active {
  background: #0066CC;
  color: white;
  border-color: #0066CC;
}
```

---

## ✅ FINAL VERIFICATION

### Run All Tests:
```bash
cd frontend
npm test -- --run
```

**Expected:** 78+ tests passing

### Build Check:
```bash
npm run build
```

**Expected:** Success in <700ms

### Manual Testing:
1. ✅ Load EDF file
2. ✅ Verify amplitude axis visible (left side, µV labels)
3. ✅ Verify time axis visible (bottom, MM:SS labels)
4. ✅ Verify resolution bar visible (bottom, metrics)
5. ✅ Test mouse wheel zoom - axes update
6. ✅ Test drag to pan - axes update
7. ✅ Test preset buttons
8. ✅ Verify hints appear on first load
9. ✅ Check responsive design

---

## 📊 BEFORE/AFTER

### BEFORE:
```
┌────────────────────────────────────┐
│ [Waveform canvas - no axes]       │
│                                    │
└────────────────────────────────────┘
```

### AFTER:
```
┌──────────────────────────────────────────────┐
│ [Controls] [Presets: 1s|5s|10s|30s|1m|5m]   │
├───┬──────────────────────────────────────────┤
│ µV │ ┌────────────────────────────────────┐ │
│   │ │ Waveform with visible axes        │ │
│100│ │  ✓ Scroll to zoom                  │ │
│  0│ │  ✓ Drag to pan                     │ │
│-100│ │                                    │ │
│   │ └────────────────────────────────────┘ │
│   │  00:00      00:01      00:02      00:03  │
├───┴──────────────────────────────────────────┤
│ SF:500Hz Win:5s Amp:1.0x Ch:20/59 Tot:35:00 │
└──────────────────────────────────────────────┘
```

---

## 🎯 EXECUTION ORDER

**Start with Phase 1** - Integrate axes (45 min)
- Biggest visual impact
- Addresses main user complaint
- Components already exist

**Then Phase 2** - Resolution bar (30 min)
- Easy win
- High visibility

**Then Phase 3** - Mouse hints (45 min)
- Improves discoverability
- Better UX

**Finally Phase 4** - Navigation polish (1 hour)
- Convenience features
- Professional touch

**Total Time:** 2.5-3 hours

---

## 📞 NEXT STEPS

1. **Start Phase 1** - Follow Step 1-5 above
2. **Test thoroughly** - Verify all acceptance criteria
3. **Commit changes** - With message "feat: integrate time and amplitude axes"
4. **Continue to Phase 2-4** - Or gather feedback first

---

**Plan Status:** ✅ Ready for implementation
**Created by:** Prometheus (Planning Agent)
**Date:** 2025-01-25
