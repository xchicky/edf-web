# EDF Viewer UI/UX Enhancement Plan

**Date:** 2025-01-25
**Status:** Planning Phase
**Priority:** P0 - Critical User Experience Improvements

---

## Current State Analysis

### ✅ What's Already Implemented

**Core Components (8 files found):**
1. **WaveformCanvas.tsx** - Canvas rendering with:
   - ✅ Mouse wheel zoom (time: x>50px, amplitude: x<50px)
   - ✅ Drag to pan through timeline
   - ✅ Click to position cursor
   - ✅ Cursor overlay with time/amplitude/channel info
   - ✅ Grid lines and channel labels
   - ✅ Performance optimizations (offscreen canvas, requestAnimationFrame)

2. **TimeAxis.tsx** - Time axis component (91 lines):
   - ✅ Adaptive tick intervals
   - ✅ Time formatting (MM:SS or MM:SS.mmm)
   - ✅ Canvas-based rendering
   - ❌ **NOT integrated into main view**

3. **AmplitudeAxis.tsx** - Amplitude axis component (78 lines):
   - ✅ Voltage scale display (µV)
   - ✅ Tick marks and labels
   - ✅ Grid lines
   - ❌ **NOT integrated into main view**

4. **TimeToolbar.tsx** - Playback and zoom controls:
   - ✅ Play/pause/stop buttons
   - ✅ Time display (current/total)
   - ✅ Zoom in/out buttons
   - ✅ Amplitude scale buttons
   - ✅ Window duration display

5. **ZoomIndicator.tsx** - Visual zoom level indicator:
   - ✅ Time zoom bar
   - ✅ Amplitude zoom bar

6. **OverviewStrip.tsx** - Navigation overview:
   - ✅ Full-file overview
   - ✅ Click to jump
   - ✅ Drag to pan
   - ✅ Current window indicator

7. **ChannelSelector.tsx** - Channel selection:
   - ✅ Checkbox list
   - ✅ Search/filter
   - ✅ Select all/none

8. **CursorOverlay.tsx** - Mouse cursor info:
   - ✅ Time, amplitude, channel display

**State Management (edfStore.ts):**
```typescript
interface EDFStore {
  currentTime: number;
  windowDuration: number;        // ✅ EXISTS
  amplitudeScale: number;         // ✅ EXISTS
  selectedChannels: number[];     // ✅ EXISTS
  isPlaying: boolean;             // ✅ EXISTS
  bookmarks: Bookmark[];          // ✅ EXISTS

  setWindowDuration: (duration) => void;     // ✅ EXISTS
  setAmplitudeScale: (scale) => void;        // ✅ EXISTS
  setCurrentTime: (time) => void;            // ✅ EXISTS
}
```

### ❌ What's Missing / Needs Improvement

**Based on User Requirements (translated from Chinese):**

1. **Interface gap from reference design (ui.jpg)**
   - Axes components exist but aren't rendered in main view
   - Layout may not match professional medical software

2. **Missing axis displays**
   - TimeAxis and AmplitudeAxis created but NOT integrated
   - No clear indication of resolution/scale
   - No grid lines synchronized with axes

3. **Missing resolution indicators**
   - Voltage (µV/mV) display exists in AmplitudeAxis but not visible
   - Frequency (Hz) shown in metadata but not prominent
   - Time window size shown but could be clearer

4. **Mouse interaction clarity**
   - Wheel zoom WORKS but users may not discover it
   - Drag pan WORKS but no visual feedback
   - No instructions/hints visible

5. **Window navigation for long recordings**
   - OverviewStrip EXISTS and works well
   - Quick jump buttons exist (Start/Middle/End)
   - Bookmarks system implemented
   - **Could improve:** Keyboard shortcuts help, preset window durations

---

## Comparison with Reference Design (ui.jpg)

**NOTE:** Unable to view image directly, but based on user description, typical professional EDF viewers have:

**Professional Medical Software UI Pattern:**
```
┌─────────────────────────────────────────────────────────────┐
│ Menu: File | View | Tools | Help                           │
├─────────────────────────────────────────────────────────────┤
│ Toolbar: [Open] [Save] [Print] [←][→][Zoom In][Zoom Out]    │
├───┬─────────────────────────────────────────────────────────┤
│ A │ Time: 00:00.000 ─── 00:05.000  Window: 5s  Zoom: 10x  │
│ m │ [Start][◄◄][◄][▮][►][►►][End]  Speed: 1x                │
│ p │ ┌───────────────────────────────────────────────────┐  │
│   │ │ EEG Fp1-Ref    ╱╲    ╱╲    ╱╲    ╱╲               │  │
│   │ │                ╱  ╲  ╱  ╲  ╱  ╲                   │  │
│ µ │ │───────────────┼────┼────┼────┼────────────────│  │
│ V │ │ EEG F3-Ref     ╲  ╱  ╲  ╱  ╲  ╱                  │  │
│   │ │                ╲╱    ╲╱    ╲╱                     │  │
│   │ │                                                 │  │
│   │ └───────────────────────────────────────────────────┘  │
│   │ 00:00    00:01    00:02    00:03    00:04    00:05    │
│   └─────────────────────────────────────────────────────────┤
│ Overview: ╱───────────────────────────────────────────╱     │
│          [====CURRENT WINDOW====]                         │
├─────────────────────────────────────────────────────────────┤
│ Status: Ch: 20/59  SF: 500Hz  Dur: 35.6min  Pat: X          │
└─────────────────────────────────────────────────────────────┘
```

**Our Current UI (Gap Analysis):**
- ❌ No visible time axis at bottom
- ❌ No visible amplitude axis at left
- ❌ No prominent resolution/status bar at bottom
- ❌ Toolbar controls scattered (not consolidated)
- ❌ No keyboard shortcut hints
- ✅ Waveform rendering works well
- ✅ Mouse interactions implemented
- ✅ Overview strip exists

---

## Implementation Plan

### Phase 1: Integrate Existing Axis Components (1-2 hours)

**Objective:** Make TimeAxis and AmplitudeAxis visible in main view

**Tasks:**

1. **Modify App.tsx to render axes**
   - Add TimeAxis below WaveformCanvas
   - Add AmplitudeAxis to the left of WaveformCanvas
   - Use CSS Grid or Flexbox for layout
   - Ensure axes are synchronized with waveform

2. **Layout Structure:**
```tsx
<div className="waveform-container">
  {/* Top controls */}
  <TimeToolbar {...props} />

  {/* Main display area */}
  <div className="display-area">
    <div className="amplitude-axis-wrapper">
      <AmplitudeAxis
        channelHeight={600 / waveformData.channels.length}
        amplitudeScale={amplitudeScale}
      />
    </div>

    <div className="waveform-wrapper">
      <WaveformCanvas
        waveformData={waveformData}
        // ... props
      />
    </div>
  </div>

  {/* Bottom time axis */}
  <div className="time-axis-wrapper">
    <TimeAxis
      duration={windowDuration}
      startTime={currentTime}
      width={canvasWidth - 50}  // Subtract amplitude axis width
      pixelsPerSecond={(canvasWidth - 50) / windowDuration}
    />
  </div>
</div>
```

3. **CSS Styling (App.css):**
```css
.waveform-container {
  display: flex;
  flex-direction: column;
}

.display-area {
  display: flex;
  flex-direction: row;
}

.amplitude-axis-wrapper {
  width: 50px;
  flex-shrink: 0;
}

.waveform-wrapper {
  flex: 1;
  overflow: hidden;
}

.time-axis-wrapper {
  margin-left: 50px;  /* Align with waveform, not amplitude axis */
}
```

**Acceptance Criteria:**
- [ ] Time axis visible at bottom with correct time labels
- [ ] Amplitude axis visible on left with voltage labels
- [ ] Axes update in real-time during zoom/pan
- [ ] No visual gaps or misalignment

**Files to Modify:**
- `frontend/src/App.tsx`
- `frontend/src/App.css`

---

### Phase 2: Add Resolution Indicator Bar (1 hour)

**Objective:** Create a prominent status bar showing key resolution metrics

**Tasks:**

1. **Create ResolutionIndicator.tsx component**
```tsx
interface ResolutionIndicatorProps {
  samplingRate: number;      // Hz
  windowDuration: number;    // seconds
  amplitudeScale: number;    // multiplier
  nChannelsSelected: number;
  nChannelsTotal: number;
  totalDuration: number;     // seconds
}

// Display format:
// SF: 500Hz | Window: 5s | Amp: 1.0x | Ch: 20/59 | Total: 35.6min
```

2. **Position in App.tsx**
```tsx
<div className="status-bar">
  <ResolutionIndicator
    samplingRate={metadata?.sfreq || 0}
    windowDuration={windowDuration}
    amplitudeScale={amplitudeScale}
    nChannelsSelected={selectedChannels.length}
    nChannelsTotal={metadata?.n_channels || 0}
    totalDuration={metadata?.duration_seconds || 0}
  />
</div>
```

3. **Styling:**
```css
.status-bar {
  background: #F8F9FA;
  border-top: 1px solid #DEE2E6;
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #495057;
}

.resolution-item {
  margin: 0 12px;
}

.resolution-label {
  font-weight: 600;
  margin-right: 4px;
}
```

**Acceptance Criteria:**
- [ ] Status bar visible at bottom of screen
- [ ] All metrics displayed clearly
- [ ] Updates in real-time when settings change
- [ ] Responsive layout (doesn't break on smaller screens)

**Files to Create:**
- `frontend/src/components/ResolutionIndicator.tsx`

**Files to Modify:**
- `frontend/src/App.tsx`
- `frontend/src/App.css`

---

### Phase 3: Enhance Mouse Interaction Feedback (1 hour)

**Objective:** Make mouse interactions more discoverable and provide visual feedback

**Tasks:**

1. **Add visual cursor feedback**
   - Change cursor based on mouse position:
     - Left 50px: `ew-resize` (amplitude zoom)
     - Right side: `grab` / `grabbing` (pan)
   - Already partially implemented, ensure consistency

2. **Add tooltip hints**
   - Show small tooltip on first load: "Scroll to zoom, drag to pan"
   - Dismiss after 5 seconds or on first interaction
   - Store in localStorage to not annoy users

3. **Create InteractionHint.tsx component**
```tsx
const hints = [
  { icon: '🖱️', text: 'Scroll wheel to zoom' },
  { icon: '✋', text: 'Drag to pan' },
  { icon: '👆', text: 'Click to position' },
];

// Show as overlay that fades out
```

4. **Add zoom level animation**
   - Smooth transition when zooming
   - Visual indicator of zoom direction (+/-)

**Acceptance Criteria:**
- [ ] Cursor changes clearly indicate available actions
- [ ] First-time users see interaction hints
- [ ] Hints don't reappear for returning users
- [ ] Smooth visual feedback during interactions

**Files to Create:**
- `frontend/src/components/InteractionHint.tsx`

**Files to Modify:**
- `frontend/src/components/WaveformCanvas.tsx` (cursor styles)
- `frontend/src/App.tsx` (add hints)

---

### Phase 4: Improve Window Navigation (2-3 hours)

**Objective:** Make it easier to navigate through long recordings

**Tasks:**

1. **Add preset window duration buttons**
   - Quick buttons: 1s, 5s, 10s, 30s, 60s, 5min
   - Already partially implemented, make more prominent

2. **Add time input for direct navigation**
   - Input field to jump to specific time (MM:SS.mmm)
   - Parse user input and validate bounds

3. **Enhanced keyboard shortcuts**
   - Already exists but add help modal:
     - `←/→`: Pan by 10% of window
     - `Shift + ←/→`: Pan by window duration
     - `+/-`: Zoom in/out
     - `Space`: Play/pause
     - `Home/End`: Jump to start/end
     - `B`: Add bookmark
     - `?`: Show keyboard shortcuts

4. **Create KeyboardShortcutsHelp.tsx**
```tsx
const shortcuts = [
  { key: '← / →', action: 'Pan left/right by 10%' },
  { key: 'Shift + ← / →', action: 'Pan by window duration' },
  { key: '+ / -', action: 'Zoom time window' },
  { key: 'Mouse wheel', action: 'Zoom (time: right, amp: left)' },
  { key: 'Space', action: 'Play / Pause' },
  { key: 'Home / End', action: 'Jump to start / end' },
  { key: 'B', action: 'Add bookmark at current position' },
  // ... more
];
```

5. **Add time scrubber slider**
   - Visual slider showing position in file
   - Drag to quick jump
   - Syncs with OverviewStrip

**Acceptance Criteria:**
- [ ] Preset buttons work and show current selection
- [ ] Time input accepts various formats (MM:SS, SS.mmm, etc.)
- [ ] Keyboard shortcuts work consistently
- [ ] Help modal accessible via button and `?` key
- [ ] Scrubber shows current position accurately

**Files to Create:**
- `frontend/src/components/KeyboardShortcutsHelp.tsx`
- `frontend/src/components/TimeScrubber.tsx`

**Files to Modify:**
- `frontend/src/App.tsx`
- `frontend/src/App.css`

---

### Phase 5: Professional UI Polish (2-3 hours)

**Objective:** Match professional medical software aesthetics

**Tasks:**

1. **Color scheme improvements**
   - Use medical/professional color palette
   - High contrast for waveform data
   - Subtle grid lines
   - Clear axis labels

2. **Typography**
   - Consistent font sizing
   - Clear hierarchy (labels > values > hints)
   - Monospace for numbers/time

3. **Layout refinement**
   - Proper spacing between elements
   - Aligned controls
   - Responsive design

4. **Loading states**
   - Skeleton screens during data load
   - Progress indicators for large files

5. **Error states**
   - Clear error messages
   - Recovery suggestions

**Acceptance Criteria:**
- [ ] Professional color scheme applied
- [ ] Consistent typography throughout
- [ ] Layout matches reference design (ui.jpg)
- [ ] Loading states for all async operations
- [ ] Graceful error handling

**Files to Modify:**
- `frontend/src/App.css` (major styling overhaul)
- `frontend/src/components/*` (individual component styles)

---

## Technical Recommendations

### Libraries to Consider

**1. Canvas-based Charting Libraries (IF replacing custom canvas)**
- **Plotly.js** (3.2MB)
  - ✅ Built-in zoom/pan
  - ✅ Excellent performance
  - ✅ Rich features
  - ❌ Large bundle size
  - ❌ Overkill for simple waveforms

- **ECharts** (1MB)
  - ✅ Great zoom/pan
  - ✅ Smaller than Plotly
  - ✅ Good documentation
  - ❌ Still significant size

- **Victory** (150KB)
  - ✅ Lightweight
  - ✅ React-native
  - ❌ Limited zoom/pan out-of-box
  - ❌ May need custom implementation

**RECOMMENDATION:** Keep custom WaveformCanvas
- ✅ Already working well
- ✅ Full control over interactions
- ✅ Optimized for EDF-specific use case
- ✅ No additional bundle cost

**2. Utility Libraries**
- **react-hotkeys-hook** (3KB)
  - ✅ Easy keyboard shortcut management
  - ✅ Hook-based API
  - Consider for Phase 4

- **use-debounce** (1KB)
  - ✅ Already using debouncing patterns
  - Could standardize with this library

### Architecture Decisions

**1. State Management**
- ✅ **Keep Zustand** - Working well, lightweight
- No need for Redux or Context API

**2. Component Structure**
```
App
├── Header (metadata, controls)
├── MainDisplay
│   ├── AmplitudeAxis
│   ├── WaveformCanvas
│   └── TimeAxis
├── ControlsBar (TimeToolbar, ZoomIndicator)
├── OverviewStrip
├── ResolutionIndicator (status bar)
└── Overlays
    ├── InteractionHint
    ├── KeyboardShortcutsHelp
    └── LoadingState
```

**3. Performance Considerations**
- ✅ Canvas already optimized (offscreen rendering)
- ✅ RequestAnimationFrame for smooth updates
- ✅ Debounced API calls
- ⚠️ Consider virtualization for very long recordings (if needed)

---

## Implementation Priority

### Quick Wins (Do First - Total 2-3 hours)
1. **Integrate existing axes** (1-2 hours) - HUGE visual impact
2. **Add resolution indicator bar** (1 hour) - Easy win

### Medium Priority (Do Next - Total 3-4 hours)
3. **Enhance mouse feedback** (1 hour) - Improves discoverability
4. **Improve window navigation** (2-3 hours) - Major UX improvement

### Polish (Do Last - Total 2-3 hours)
5. **Professional UI polish** (2-3 hours) - Final aesthetic pass

**Total Estimated Time:** 7-10 hours for complete transformation

---

## Testing Strategy

### Manual Testing Checklist

**Phase 1 - Axes Integration:**
- [ ] Time axis shows correct times
- [ ] Amplitude axis shows correct voltages
- [ ] Axes sync with zoom/pan
- [ ] No layout break on resize

**Phase 2 - Resolution Indicator:**
- [ ] All metrics display correctly
- [ ] Updates in real-time
- [ ] Responsive on mobile

**Phase 3 - Mouse Feedback:**
- [ ] Cursor changes appropriately
- [ ] Hints show for new users
- [ ] Hints don't show for returning users
- [ ] Smooth zoom/pan animations

**Phase 4 - Navigation:**
- [ ] Preset buttons work
- [ ] Time input accepts all formats
- [ ] Keyboard shortcuts work
- [ ] Scrubber syncs with waveform

**Phase 5 - Polish:**
- [ ] Professional appearance
- [ ] Loading states work
- [ ] Error states are helpful
- [ ] Matches reference design

---

## Success Metrics

**Before/After Comparison:**

| Metric | Before | After (Target) |
|--------|--------|----------------|
| **Visual Axes** | Hidden | Visible & synchronized |
| **Resolution Display** | Buried in metadata | Prominent status bar |
| **Mouse Discovery** | Hidden feature | Clear hints & feedback |
| **Long Recording Navigation** | Basic overview | Multiple navigation methods |
| **Professional Appearance** | Basic web app | Medical software aesthetic |

**User Experience Improvements:**
- ✅ Immediate visual context (axes)
- ✅ Clear understanding of scale/resolution
- ✅ Discoverable interactions
- ✅ Efficient navigation
- ✅ Professional confidence

---

## Next Steps

**Immediate Action:**
1. Review this plan with user to confirm priorities
2. Start with Phase 1 (integrate axes) - biggest visual impact
3. Gather feedback after each phase

**Questions for User:**
1. Is the reference design (ui.jpg) representative of the target UI?
2. Are there specific features from ui.jpg that are MUST-HAVE?
3. What's the priority: speed of implementation vs. completeness?
4. Any color scheme preferences?
5. Target audience: medical professionals or researchers?

---

**Prepared by:** Prometheus (Planning Agent)
**Date:** 2025-01-25
**Status:** Ready for implementation
**Recommended Executor:** Sisyphus (Frontend/UI specialist)
