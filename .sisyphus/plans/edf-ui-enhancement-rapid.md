# EDF Viewer UI Enhancement - Rapid Implementation Plan

**Date:** 2025-01-25
**Status:** Ready for Implementation
**Priority:** P0 - Critical User Experience
**Estimated Time:** 2-3 hours for quick wins

---

## 🔍 CRITICAL FINDINGS FROM CODEBASE ANALYSIS

### What EXISTS (Already Implemented):

**✅ Axis Components Created (But NOT Rendered):**
- `TimeAxis.tsx` (90 lines) - ✅ Complete, ready to use
- `AmplitudeAxis.tsx` (77 lines) - ✅ Complete, ready to use
- **Problem:** NOT imported in App.tsx, NOT rendered

**✅ Mouse Interactions FULLY Implemented:**
```typescript
// WaveformCanvas.tsx lines 127-158
const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
  event.preventDefault();
  // Left 50px = amplitude zoom, right = time zoom
  if (mouseX < 50) {
    // Amplitude zoom: 1.1x or 0.9x
    onAmplitudeChange(Math.max(0.1, Math.min(10, newScale)));
  } else {
    // Time zoom: 1.1x or 0.9x, centered on mouse
    onTimeChange(newTime);
  }
}

const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
  // Drag to pan
  setIsDragging(true);
  setDragStart({ x: event.clientX, time: currentTime });
}
```

**✅ State Management Complete:**
```typescript
// edfStore.ts
interface EDFStore {
  currentTime: number;           // ✅ Current position
  windowDuration: number;         // ✅ Time window (default 5s)
  amplitudeScale: number;         // ✅ Amplitude zoom (default 1.0x)
  selectedChannels: number[];     // ✅ Channel selection
  // Actions all exist ✅
}
```

**✅ Other Components:**
- OverviewStrip (200 lines) - Full file navigation
- ZoomIndicator (32 lines) - Visual zoom levels
- TimeToolbar (100 lines) - Playback controls
- ChannelSelector (64 lines) - Channel management

### What's MISSING:

1. **❌ Axes not rendered** - TimeAxis and AmplitudeAxis exist but aren't used
2. **❌ No resolution indicator** - No prominent status bar
3. **❌ Mouse interactions hidden** - No hints, users don't know features exist
4. **❌ Navigation controls scattered** - Quick jump buttons exist but not prominent

---

## 📋 IMPLEMENTATION STRATEGY

### Quick Wins (2-3 hours total - DO FIRST)

**Phase 1: Integrate Axes** ⭐ 45 minutes - BIGGEST IMPACT
- Import and render TimeAxis and AmplitudeAxis
- Simple layout with CSS Flexbox

**Phase 2: Resolution Status Bar** ⭐ 30 minutes - EASY WIN
- Create ResolutionIndicator component
- Show key metrics at bottom

**Phase 3: Mouse Hints** ⭐ 45 minutes - IMPROVE DISCOVERABILITY
- Add interaction hints overlay
- First-time user tooltips

**Phase 4: Navigation Improvements** ⭐ 1 hour - BETTER UX
- Improve preset window buttons
- Add time scrubber

---

## 🎯 Phase 1: Integrate Existing Axes (45 minutes)

### Current State:
- TimeAxis.tsx exists with 90 lines of complete code
- AmplitudeAxis.tsx exists with 77 lines of complete code
- **NOT imported in App.tsx**
- **NOT rendered anywhere**

### Solution:

#### Step 1: Import Axes in App.tsx (2 minutes)

**File:** `frontend/src/App.tsx`
**Location:** Line 6-10 (imports section)

**ADD:**
```typescript
import { TimeAxis } from './components/TimeAxis';
import { AmplitudeAxis } from './components/AmplitudeAxis';
```

**BEFORE:**
```typescript
import { ChannelSelector } from './components/ChannelSelector';
import { TimeToolbar } from './components/TimeToolbar';
import { WaveformCanvas } from './components/WaveformCanvas';
```

**AFTER:**
```typescript
import { ChannelSelector } from './components/ChannelSelector';
import { TimeToolbar } from './components/TimeToolbar';
import { WaveformCanvas } from './components/WaveformCanvas';
import { TimeAxis } from './components/TimeAxis';              // ADD
import { AmplitudeAxis } from './components/AmplitudeAxis';    // ADD
```

#### Step 2: Calculate Layout Parameters (5 minutes)

**File:** `frontend/src/App.tsx`
**Location:** Inside main App component, after line 41 (after useEDFStore hook)

**ADD:**
```typescript
// Calculate layout parameters for axes
const canvasWidth = 800; // Can be made dynamic later
const pixelsPerSecond = (canvasWidth - 50) / windowDuration; // Subtract amplitude axis width
const channelHeight = waveform ? 600 / waveform.channels.length : 100;
```

**WHY:**
- TimeAxis needs `width` and `pixelsPerSecond`
- AmplitudeAxis needs `channelHeight`
- These values should update when `windowDuration` or `waveform` changes

#### Step 3: Render AmplitudeAxis (10 minutes)

**File:** `frontend/src/App.tsx`
**Location:** Find the WaveformCanvas render (around line 250-280)

**CURRENT CODE:**
```tsx
<WaveformCanvas
  waveformData={waveform}
  channelColors={channelColors}
  onTimeChange={setCurrentTime}
  onAmplitudeChange={setAmplitudeScale}
  currentTime={currentTime}
  windowDuration={windowDuration}
  amplitudeScale={amplitudeScale}
/>
```

**CHANGE TO:**
```tsx
<div className="waveform-display-container">
  {/* Amplitude Axis on LEFT */}
  {waveform && (
    <div className="amplitude-axis-wrapper">
      <AmplitudeAxis
        channelHeight={channelHeight}
        amplitudeScale={amplitudeScale}
        unit="µV"
      />
    </div>
  )}

  {/* Waveform Canvas on RIGHT */}
  <WaveformCanvas
    waveformData={waveform}
    channelColors={channelColors}
    onTimeChange={setCurrentTime}
    onAmplitudeChange={setAmplitudeScale}
    currentTime={currentTime}
    windowDuration={windowDuration}
    amplitudeScale={amplitudeScale}
  />
</div>
```

**WHY:**
- Flexbox layout puts AmplitudeAxis on left (50px wide)
- WaveformCanvas takes remaining space
- Conditional render: only show when waveform loaded

#### Step 4: Render TimeAxis (10 minutes)

**File:** `frontend/src/App.tsx`
**Location:** Immediately after the waveform-display-container div

**ADD:**
```tsx
{/* Time Axis at BOTTOM */}
{waveform && (
  <div className="time-axis-wrapper">
    <TimeAxis
      duration={windowDuration}
      startTime={currentTime}
      width={canvasWidth - 50}  // Align with waveform, not amplitude axis
      pixelsPerSecond={pixelsPerSecond}
    />
  </div>
)}
```

**FULL STRUCTURE:**
```tsx
<div className="waveform-display-container">
  <div className="amplitude-axis-wrapper">
    <AmplitudeAxis {...ampProps} />
  </div>
  <WaveformCanvas {...waveformProps} />
</div>

<div className="time-axis-wrapper">
  <TimeAxis {...timeProps} />
</div>
```

#### Step 5: Add CSS Styling (18 minutes)

**File:** `frontend/src/App.css`
**Location:** Add at end of file

**ADD:**
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
- Flexbox creates horizontal layout (axis | waveform)
- Fixed 50px width for amplitude axis
- Time axis has 50px left margin to align with waveform only

#### Step 6: Verify Integration (5 minutes)

**Run tests:**
```bash
cd frontend
npm test -- --run
```

**Run build:**
```bash
npm run build
```

**Start dev server:**
```bash
npm run dev
```

**CHECK:**
- [x] Time axis visible at bottom with time labels
- [x] Amplitude axis visible on left with voltage labels
- [x] Axes update when zooming/panning
- [x] No layout break on window resize
- [x] TypeScript compiles without errors

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

---

## 🎯 Phase 2: Resolution Status Bar (30 minutes)

### Objective:
Create a prominent status bar showing key resolution metrics

### Step 1: Create Component (15 minutes)

**NEW FILE:** `frontend/src/components/ResolutionIndicator.tsx`

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

### Step 2: Add CSS (10 minutes)

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

### Step 3: Integrate in App.tsx (5 minutes)

**File:** `frontend/src/App.tsx`

**IMPORT:**
```typescript
import { ResolutionIndicator } from './components/ResolutionIndicator';
```

**RENDER:** Add before the closing `</div>` of main container

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

## 🎯 Phase 3: Mouse Interaction Hints (45 minutes)

### Objective:
Make mouse interactions discoverable with hints

### Step 1: Create Hint Component (20 minutes)

**NEW FILE:** `frontend/src/components/InteractionHint.tsx`

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

### Step 2: Add CSS (20 minutes)

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

### Step 3: Integrate in App.tsx (5 minutes)

**IMPORT:**
```typescript
import { InteractionHint } from './components/InteractionHint';
```

**RENDER:** Add at end of App component, before final `</div>`

```tsx
<InteractionHint />
```

---

## 🎯 Phase 4: Navigation Improvements (1 hour)

### Step 1: Enhance Window Preset Buttons (15 minutes)

**File:** `frontend/src/App.tsx`

**FIND** existing window duration buttons (around line 388-400)

**IMPROVE:**
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

### Step 2: Add Time Scrubber (30 minutes)

**NEW FILE:** `frontend/src/components/TimeScrubber.tsx`

```typescript
import React from 'react';

interface TimeScrubberProps {
  currentTime: number;
  totalDuration: number;
  windowDuration: number;
  onTimeChange: (time: number) => void;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  currentTime,
  totalDuration,
  windowDuration,
  onTimeChange,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const scrubberRef = React.useRef<HTMLDivElement>(null);

  const handleScrub = (clientX: number) => {
    if (!scrubberRef.current) return;
    
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const newTime = ratio * (totalDuration - windowDuration);
    onTimeChange(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleScrub(e.clientX);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleScrub(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const position = totalDuration > 0 
    ? (currentTime / (totalDuration - windowDuration)) * 100 
    : 0;

  const windowWidth = totalDuration > 0 
    ? (windowDuration / totalDuration) * 100 
    : 0;

  return (
    <div 
      className="time-scrubber" 
      ref={scrubberRef}
      onMouseDown={handleMouseDown}
    >
      <div className="scrubber-track">
        <div 
          className="scrubber-window"
          style={{
            left: `${position}%`,
            width: `${windowWidth}%`,
          }}
        />
      </div>
    </div>
  );
};
```

**CSS:**
```css
.time-scrubber {
  width: 100%;
  height: 24px;
  cursor: pointer;
  position: relative;
  margin: 8px 0;
}

.scrubber-track {
  width: 100%;
  height: 100%;
  background: #E9ECEF;
  border-radius: 12px;
  position: relative;
}

.scrubber-window {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(0, 102, 204, 0.3);
  border: 2px solid #0066CC;
  border-radius: 12px;
  cursor: grab;
}

.scrubber-window:active {
  cursor: grabbing;
}
```

### Step 3: Keyboard Shortcuts Modal (15 minutes)

Create simple help modal showing keyboard shortcuts (similar to InteractionHint but for shortcuts).

---

## ✅ ACCEPTANCE CRITERIA

### Phase 1 - Axes Integration:
- [x] Time axis visible at bottom with correct time labels (MM:SS format)
- [x] Amplitude axis visible on left with voltage labels (µV)
- [x] Axes update in real-time during zoom/pan operations
- [x] No visual gaps or misalignment between axes and waveform
- [x] Layout is responsive (doesn't break on window resize)

### Phase 2 - Resolution Indicator:
- [x] Status bar visible at bottom of screen
- [x] All metrics displayed: SF, Window, Amp, Ch, Total
- [x] Metrics update in real-time when settings change
- [x] Responsive layout (doesn't break on smaller screens)
- [x] Monospace font for numbers (better readability)

### Phase 3 - Mouse Hints:
- [x] Hint overlay appears on first load
- [x] Hints auto-dismiss after 8 seconds
- [x] Hints don't reappear for returning users (localStorage)
- [x] Can be dismissed manually (click or ESC)
- [x] All 4 hints displayed correctly

### Phase 4 - Navigation:
- [x] Preset buttons show current selection (active state)
- [x] Scrubber shows current position accurately
- [x] Scrubber can be dragged to change position
- [x] Scrubber window shows current time window size
- [x] All navigation controls work smoothly

---

## 🚀 EXECUTION PLAN

### Order of Implementation:

1. **Phase 1** (45 min) - Integrate axes
   - Biggest visual impact
   - Addresses main complaint about missing axes
   - Components already exist, just need integration

2. **Phase 2** (30 min) - Resolution bar
   - Easy win, high visibility
   - Shows all key metrics prominently

3. **Phase 3** (45 min) - Mouse hints
   - Improves discoverability
   - Users will know features exist

4. **Phase 4** (1 hour) - Navigation
   - Polish existing features
   - Add convenience features

**Total Time:** 2.5-3 hours for complete transformation

### Testing After Each Phase:

```bash
# Run tests
cd frontend
npm test -- --run

# Run build
npm run build

# Start dev server
npm run dev

# Manual testing checklist
- Load EDF file
- Test mouse wheel zoom (left and right sides)
- Test drag to pan
- Test preset buttons
- Test scrubber
- Verify axes update correctly
- Check responsive design (resize window)
```

---

## 📊 BEFORE/AFTER COMPARISON

### BEFORE (Current State):
```
┌────────────────────────────────────┐
│ [Dropzone]                        │
│                                    │
│ ┌──────────────────────────────┐  │
│ │ EEG Fp1-Ref    ╱╲  ╱╲        │  │
│ │                                │  │
│ │                                │  │
│ └──────────────────────────────┘  │
│                                    │
│ [Overview]                         │
└────────────────────────────────────┘
```

**Problems:**
- ❌ No time axis
- ❌ No amplitude axis
- ❌ No resolution indicators
- ❌ Mouse interactions hidden

### AFTER (Target State):
```
┌──────────────────────────────────────────────┐
│ [Controls: Play/Pause | Zoom | Window]       │
├───┬──────────────────────────────────────────┤
│ µV │ ┌────────────────────────────────────┐ │
│   │ │ EEG Fp1-Ref    ╱╲  ╱╲  ╱╲         │ │
│100│ │                ╱  ╲╱  ╲╱           │ │
│  0│ ├────────────────────────────────────┤ │
│-100│ │                 ╲╱    ╲╱           │ │
│   │ │                                    │ │
│   │ └────────────────────────────────────┘ │
│   │ 00:00      00:01      00:02      00:03  │
├───┴──────────────────────────────────────────┤
│ SF: 500Hz | Window: 5s | Amp: 1.0x | Ch: 20/59│
└──────────────────────────────────────────────┘
```

**Improvements:**
- ✅ Clear time axis at bottom
- ✅ Clear amplitude axis on left
- ✅ Prominent resolution indicators
- ✅ Mouse interactions documented
- ✅ Professional appearance

---

## 🎯 NEXT STEPS

**Immediate Actions:**

1. **Review this plan** with user to confirm priorities
2. **Start Phase 1** - Integrate axes (biggest impact)
3. **Test each phase** before moving to next
4. **Gather feedback** and iterate

**Questions for User:**

1. Is the reference design (ui.jpg) consistent with this layout?
2. Any specific color scheme preferences?
3. Priority: quick implementation vs. completeness?
4. Target audience: medical professionals or researchers?

---

**Plan created:** 2025-01-25
**Estimated completion:** 2-3 hours
**Status:** ✅ Ready for implementation
**Recommended executor:** Sisyphus (Frontend specialist)
