# EDF Viewer Enhancement Plan

## Executive Summary

This plan addresses **5 critical gaps** between the current EDF Viewer implementation and professional medical EEG visualization standards. The plan prioritizes **interactive features** (mouse navigation, axis display, adjustment controls) while maintaining performance for large files (100MB+).

**Estimated Implementation Time**: 16-24 hours across 5 phases
**Risk Level**: Low (incremental enhancements, no breaking changes)
**Performance Impact**: Neutral to Positive (optimizations included)

---

## Phase 1: Axis & Scale Display System
**Priority**: CRITICAL | **Time**: 3-4 hours | **Value**: High

Users cannot see exact time or voltage values - this is fundamental for medical analysis.

### 1.1 X-Axis (Time) Scale & Labels

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/TimeAxis.tsx` - New component

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx:204-280` - Extract canvas rendering to separate component
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.css` - Add `.time-axis` styles

**Acceptance criteria:**
- [x] Time labels visible at bottom of waveform canvas
- [x] Tick intervals adapt to zoom level (0.1s at 1x zoom, 10s at 10x zoom)
- [x] Labels show absolute file time (not relative 0)
- [x] Time range display updates during pan/zoom
- [x] Font size 11px, color #6C757D (secondary gray)

### 1.2 Y-Axis (Amplitude) Scale & Labels

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/AmplitudeAxis.tsx` - New component

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/store/edfStore.ts:33-55` - Add `amplitudeScale: number` to state
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx:243-277` - Update waveform rendering to use scale

**Acceptance criteria:**
- [x] Amplitude labels visible on left side of each channel
- [x] Ticks show ± values (e.g., +100µV, 0, -100µV)
- [x] Range adapts to amplitude scale setting
- [x] Horizontal grid lines align with tick marks
- [x] Unit display: "µV" (microvolts)

### 1.3 Resolution & Metadata Display Overlay

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx:202-283` - Add overlay div inside waveform section

**Acceptance criteria:**
- [x] Info box overlay in top-right corner of waveform
- [x] Shows: Sampling rate, window duration, amplitude scale, time range
- [x] Semi-transparent background (doesn't obscure waveforms)
- [x] Updates in real-time during pan/zoom

---

## Phase 2: Interactive Canvas Controls
**Priority**: CRITICAL | **Time**: 5-7 hours | **Value**: Very High

Users need mouse interaction for precise navigation and inspection.

### 2.1 Canvas Component Extraction

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/WaveformCanvas.tsx` - Extracted canvas component

**Acceptance criteria:**
- [x] Canvas rendering identical to current implementation
- [x] Component accepts waveformData as prop
- [x] No visual changes (pixel-perfect migration)
- [x] Renders in < 16ms (60 FPS) for 10 channels × 10 seconds

### 2.2 Mouse Wheel Zoom (Time & Amplitude)

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/WaveformCanvas.tsx` - Add onWheel handler

**Store updates:**
```typescript
// edfStore.ts
setWindowDuration: (duration: number) => {
  set({ windowDuration: duration });
  // Auto-trigger data reload with debounce
  debouncedReload();
}
```

**Acceptance criteria:**
- [x] Scrolling up zooms in (smaller time window)
- [x] Scrolling down zooms out (larger time window)
- [x] Zoom centers on mouse cursor position
- [x] Left 50px region: amplitude zoom
- [x] Constraints: Min 1s, Max 60s window; Min 0.1x, Max 10x amplitude
- [x] Smooth zoom (no jarring jumps)

### 2.3 Drag-to-Pan Waveform

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/WaveformCanvas.tsx` - Add mouse handlers

**Acceptance criteria:**
- [x] Dragging left moves waveform forward (later in time)
- [x] Dragging right moves waveform backward (earlier in time)
- [x] Cursor changes to 'grabbing' during drag
- [x] Smooth pan with immediate visual feedback
- [x] Boundary constraints (can't pan past file start/end)
- [x] Data reload debounced (300ms) to prevent excessive API calls

### 2.4 Cursor Crosshair & Tooltip

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/CursorOverlay.tsx` - New overlay component

**Acceptance criteria:**
- [x] Crosshair appears on mouse hover
- [x] Vertical line spans full canvas height
- [x] Horizontal line spans current channel only
- [x] Tooltip shows: Time (MM:SS.mmm), Amplitude (µV), Channel name
- [x] Tooltip positioned near cursor (doesn't go off-screen)
- [x] Crosshair disappears on mouse leave
- [x] Dashed line style (#0066CC color)

---

## Phase 3: Adjustment Controls UI
**Priority**: HIGH | **Time**: 3-4 hours | **Value**: High

Add explicit controls for users who prefer buttons over mouse gestures.

### 3.1 Amplitude Scale Controls

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/TimeToolbar.tsx` - Add amplitude controls
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/store/edfStore.ts` - Add amplitude scale state

**Acceptance criteria:**
- [x] Amplitude controls visible in bottom toolbar (left of time controls)
- [x] +/- buttons adjust scale by 0.5x increments
- [x] Dropdown allows preset values (0.5x, 1x, 2x, 5x, 10x)
- [x] Current scale value displayed
- [x] Changes apply immediately (no page reload)

### 3.2 Enhanced Duration Window Controls

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx:173-198` - Enhance left sidebar controls

**Acceptance criteria:**
- [x] Quick zoom buttons (10s, 30s, 60s) for preset durations
- [x] Start time input with +/- 10s buttons
- [x] Duration slider (1-60s range) with live value display
- [x] All controls trigger debounced data reload
- [x] Active quick zoom button highlighted

### 3.3 Visual Feedback Indicators

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/ZoomIndicator.tsx` - New component

**Acceptance criteria:**
- [x] Visual zoom indicator in right sidebar (below channel selector)
- [x] Time zoom bar shows current window duration relative to max (60s)
- [x] Amplitude zoom bar shows current scale relative to max (10x)
- [x] Color-coded: Blue (time), Green (amplitude)
- [x] Updates in real-time during zoom operations

---

## Phase 4: Local Window Navigation
**Priority**: MEDIUM | **Time**: 4-5 hours | **Value**: Medium

Enable efficient navigation through long recordings (30+ minutes).

### 4.1 Mini-Map Overview Strip

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/OverviewStrip.tsx` - New component
- `/Users/yizhang/Workspace/App/edf-web/backend/app/api/routes/waveform_overview.py` - New API endpoint

**Acceptance criteria:**
- [x] Overview strip below main waveform (height: 150px)
- [x] Shows entire file duration compressed
- [x] Current window highlighted with overlay
- [x] Click to jump to position
- [x] Drag viewport to pan through file
- [x] Performance: < 500ms to load overview for 30min file

### 4.2 Time-Based Navigation Controls

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx` - Add navigation section
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/store/edfStore.ts` - Add bookmarks state

**Acceptance criteria:**
- [x] Time jump input accepts "MM:SS" or "MM:SS.mmm" format
- [x] Quick jump buttons: Start, Middle, End
- [x] Add/remove bookmarks at current position
- [x] Bookmarks persist in localStorage
- [x] Bookmark list shows label and time
- [x] Click bookmark to jump to position

### 4.3 Keyboard Shortcuts

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx` - Add useEffect for keyboard

**Acceptance criteria:**
- [x] Arrow keys pan and scale as described
- [x] +/- keys zoom in/out
- [x] Home/End jump to file boundaries
- [x] Space toggles play/pause
- [x] Shortcuts ignored when typing in input fields
- [x] Help tooltip shows available shortcuts

---

## Phase 5: Performance Optimizations
**Priority**: MEDIUM | **Time**: 2-3 hours | **Value**: High

Ensure smooth rendering for large files (100MB+).

### 5.1 Debounced API Requests

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/App.tsx:66-90` - Add debounce

**Dependencies:**
```bash
npm install lodash.debounce
npm install --save-dev @types/lodash.debounce
```

**Acceptance criteria:**
- [x] Rapid zoom/pan operations batched into single API call
- [x] 300ms debounce delay
- [x] Loading indicator shows during debounced request
- [x] No API calls for state changes that don't affect display

### 5.2 Canvas Rendering Optimization

**Files to modify:**
- `/Users/yizhang/Workspace/App/edf-web/frontend/src/components/WaveformCanvas.tsx`

**Acceptance criteria:**
- [x] Frame rate ≥ 30 FPS during pan/zoom
- [x] Grid pre-rendered to offscreen canvas (static elements)
- [x] Waveform paths simplified when > 2x pixel density
- [x] requestAnimationFrame used for all renders
- [x] No memory leaks (animation frames cancelled)

### 5.3 Backend Downsampling Endpoint

**Files to create:**
- `/Users/yizhang/Workspace/App/edf-web/backend/app/api/routes/waveform_overview.py`

**Acceptance criteria:**
- [x] Endpoint returns 1 sample per second by default
- [x] Configurable downsampling rate
- [x] Response time < 2s for 30-minute file
- [x] Memory usage < 50MB for overview data
- [x] Integrated with OverviewStrip component

---

## Implementation Order

**Step 1: Foundation (Phase 1)** - 3-4 hours
- Extract canvas component (Phase 2.1)
- Add X-axis labels (Phase 1.1)
- Add Y-axis labels (Phase 1.2)
- Add info overlay (Phase 1.3)

**Step 2: Interactivity (Phase 2)** - 5-7 hours
- Implement mouse wheel zoom (Phase 2.2)
- Implement drag-to-pan (Phase 2.3)
- Add cursor crosshair (Phase 2.4)

**Step 3: Controls (Phase 3)** - 3-4 hours
- Add amplitude scale controls (Phase 3.1)
- Enhance duration controls (Phase 3.2)
- Add zoom indicator (Phase 3.3)

**Step 4: Navigation (Phase 4)** - 4-5 hours
- Add overview strip (Phase 4.1)
- Add navigation controls (Phase 4.2)
- Add keyboard shortcuts (Phase 4.3)

**Step 5: Optimization (Phase 5)** - 2-3 hours
- Debounce API requests (Phase 5.1)
- Optimize canvas rendering (Phase 5.2)
- Add backend downsampling (Phase 5.3)

**Total Estimated Time: 17-23 hours**
