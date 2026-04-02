# COMPONENT ARCHITECTURE

**Generated:** 2026-01-29 22:11:49
**Commit:** 63294ec

## OVERVIEW
15 React components for EEG waveform visualization with Canvas-based rendering and signal management.

## WHERE TO LOOK
| Component | Purpose | Notes |
|-----------|---------|-------|
| **WaveformCanvas.tsx** | Core waveform visualization | Canvas rendering, CRITICAL coordinate system |
| ChannelSelector.tsx | Channel selection UI | Multi-select with checkboxes |
| OverviewStrip.tsx | Time overview strip | Shows full recording range |
| TimeAxis.tsx | Time axis display | Aligned with canvas width |
| AmplitudeAxis.tsx | Voltage amplitude axis | μV units |
| TimeToolbar.tsx | Time navigation controls | Play/pause, skip buttons |
| TimeScrubber.tsx | Timeline slider | Drag to seek |
| ZoomIndicator.tsx | Zoom level display | Shows time window |
| ResolutionIndicator.tsx | Data resolution info | Sampling rate display |
| CursorOverlay.tsx | Mouse cursor overlay | Crosshair on hover |
| InteractionHint.tsx | User interaction hints | Keyboard shortcuts |
| KeyboardShortcuts.tsx | Keyboard handler | Arrow keys, space, etc. |
| SignalList.tsx | Derived signals list | Manages computed signals |
| SignalEditor.tsx | Signal edit UI | Create/edit derived signals |
| SignalExpressionBuilder.tsx | Signal query builder | Visual expression editor |

## ARCHITECTURAL PATTERNS
### Component Organization
- **Flat structure**: All components at same level (no subdirs)
- **Test co-location**: `__tests__/` directory alongside components
- **No container/presentational split**: Mix of UI + logic

### Data Flow
```
App.tsx (Zustand store)
  ↓ props
WaveformCanvas.tsx (Canvas render)
  ← refs
TimeAxis.tsx, AmplitudeAxis.tsx (coordinate sync)
```

### Signal Management Flow
```
SignalEditor.tsx (create/edit)
  ↓
SignalList.tsx (display/manage)
  ↓
App.tsx → calculateSignals() API call
  ↓
WaveformCanvas.tsx (merge with raw waveforms)
```

### Key Integration Points
- **WaveformCanvas** ← TimeAxis (width synchronization)
- **ChannelSelector** ← Zustand store (selectedChannels)
- **TimeToolbar** ← Zustand store (currentTime, windowDuration)
- **Signal components** ← Zustand store (signals, signalData)

## TESTING
### Test Files
- `WaveformCanvas.test.tsx` - Component tests
- `WaveformCanvas.coordinate-verification.test.tsx` - **CRITICAL** coordinate system tests
- `ChannelSelector.test.tsx` - Selection logic
- `OverviewStrip.test.tsx` - Overview rendering
- `SignalList.test.tsx` - Signal list UI
- `SignalEditor.test.tsx` - Signal editing

### Test Patterns
- Testing Library for DOM assertions
- Canvas rendering tests mock context
- Coordinate verification prevents regression

## ANTI-PATTERNS (COMPONENTS)
- **NEVER use rect.width** for coordinate calcs → Always use canvas.width
- **NEVER desync TimeAxis width** from WaveformCanvas → Must match exactly
- **NEVER apply arbitrary voltage scaling** in Canvas → Use amplitudeScale from store
- **NEVER mix raw waveforms + signals without proper merging** → Use WaveformCanvas merge logic

## SIGNAL COMPONENT PATTERNS
### SignalEditor.tsx
- **Purpose**: Modal dialog for creating/editing derived signals
- **Inputs**: Name, expression, description, color
- **Validation**: Real-time expression validation
- **Storage**: Saves to Zustand store + localStorage

### SignalList.tsx
- **Purpose**: Display and manage all derived signals
- **Features**: Enable/disable, edit, delete, search/filter
- **Display**: Signal name, expression, creation/modification time

### SignalExpressionBuilder.tsx
- **Purpose**: Visual expression builder (drag-and-drop interface)
- **Features**: Channel picker, operator buttons, function selector
- **Preview**: Real-time expression preview
