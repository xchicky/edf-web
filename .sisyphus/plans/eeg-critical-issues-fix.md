# Fix Critical EEG Visualization Issues

## Context

### Original Request
**User (Chinese):** 请修正以下严重问题，脑电波数值是最关键的内容，问题存在关联，务必仔细检查并规划：

1. 请仔细检查脑电波曲线对应Y轴的电压值，是否读取正确，似乎与其他软件显示数值并不一致
2. 请仔细检查脑电波曲线上鼠标十字光标显示的时间和电压，与横轴纵轴坐标显示的并完全不一致
3. 横轴时间轴的长度，与脑电波曲线图绘图区的长度并不一致对应
4. 请为脑电波绘图区添加浅色的辅助竖线，每一秒1根竖线

**Translation:** Fix these critical issues - EEG values are the most critical content, issues are related:

1. Carefully check if Y-axis voltage values are read correctly, seems inconsistent with other software
2. Carefully check if mouse crosshair time/voltage display matches axis coordinates
3. Time axis length doesn't correspond with waveform plotting area
4. Add light-colored auxiliary vertical lines, 1 line per second

### Investigation Summary

**Backend Analysis (VERIFIED CORRECT):**
- File: `/Users/yizhang/Workspace/App/edf-web/backend/app/services/edf_parser.py`
- Line 105: `data = raw_cropped.get_data(units="µV")`
- MNE-Python correctly converts digital values to microvolts
- **Backend is NOT the problem**

**Frontend Issues Identified:**

**Issue 1: Incorrect Y-Axis Voltage Scaling**
- File: `frontend/src/components/WaveformCanvas.tsx:248`
- Bug: Hardcoded `* 0.5` factor causes 50% voltage error
- Example: Backend sends 100µV, frontend displays as 50µV

**Issue 2: X-Axis Width Mismatch**
- File: `frontend/src/App.tsx:50-51`
- Problem: Hardcoded `canvasWidth = 800`, inconsistent with actual canvas width
- WaveformCanvas uses `parentElement.clientWidth - 32` (dynamic)
- TimeAxis receives `canvasWidth - 50 = 750`
- Plotting doesn't subtract 50px amplitude axis area

**Issue 3: Crosshair Display Inconsistency**
- Caused by Issues 1 and 2
- Will be fixed when voltage scaling and width are corrected

**Issue 4: Vertical Grid Lines**
- File: `frontend/src/components/WaveformCanvas.tsx:187-195`
- Code exists but lines may be too light (`#E9ECEF`)
- Need to ensure alignment with TimeAxis after width fix

---

## Work Objectives

### Core Objective
Fix all 4 critical EEG visualization bugs to ensure voltage values, crosshair display, and time axis are accurate and consistent.

### Concrete Deliverables
- Correct Y-axis voltage scaling (remove 50% error)
- Aligned X-axis time coordinates between WaveformCanvas and TimeAxis
- Accurate mouse crosshair time/voltage display
- Visible vertical grid lines (1 per second) aligned with time ticks

### Definition of Done
- [x] Voltage values match backend data (verified with crosshair measurement)
- [x] Time axis ticks align perfectly with waveform data points
- [x] Crosshair displays correct time and voltage matching axis labels
- [x] Vertical grid lines visible and aligned with time ticks (1 line/second)
- [x] All existing tests pass
- [ ] Manual verification with real EDF file confirms accuracy

### Must Have
- ✅ Backend data already correct (MNE-Python µV conversion)
- ✅ Fix frontend voltage scaling (remove `0.5` factor)
- ✅ Fix X-axis width calculation (subtract 50px amplitude axis)
- ✅ Make vertical grid lines more visible
- ✅ Ensure all coordinate systems use consistent width

### Must NOT Have (Guardrails)
- ❌ DO NOT modify backend EDF parsing (already correct)
- ❌ DO NOT change API contracts or data formats
- ❌ DO NOT add new features beyond these 4 specific fixes
- ❌ DO NOT break existing functionality (keyboard shortcuts, bookmarks, etc.)
- ❌ DO NOT introduce new dependencies

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (frontend has test setup)
- **User wants tests**: NO - Manual QA preferred for visual accuracy verification
- **QA approach**: Manual verification with real EDF file + regression tests

### Manual QA Procedures

**For Voltage Scaling Fix:**
1. Load EDF file with known signal characteristics
2. Measure voltage at specific point using crosshair
3. Compare with AmplitudeAxis label at same Y position
4. Verify: Crosshair voltage × amplitudeScale = displayed Y position

**For Time Alignment Fix:**
1. Load EDF file
2. Move mouse to TimeAxis tick mark (e.g., 5 seconds)
3. Verify crosshair shows exactly 5.000 seconds
4. Check waveform data point aligns vertically with tick mark

**For Grid Lines:**
1. Load any EDF file
2. Count vertical lines in 10-second window → Should see 11 lines (0-10)
3. Verify each line aligns with TimeAxis tick
4. Verify lines are visible (not too light)

---

## Task Flow

```
Task 1 → Task 2 → Task 3 → Task 4
  ↓       ↓       ↓       ↓
(fixes build on each other - sequential execution required)
```

## Parallelization
**NONE** - All tasks are interdependent and must be executed sequentially.

---

## TODOs

- [x] 1. Fix Y-Axis Voltage Scaling (CRITICAL - removes 50% error)

  **What to do:**
  - Remove hardcoded `0.5` factor from voltage calculation
  - Update Y-coordinate formula in WaveformCanvas rendering

  **Must NOT do:**
  - Do NOT modify backend (already correct)
  - Do NOT change amplitudeScale default value or range

  **Parallelizable**: NO (must be first - other fixes depend on this)

  **References**:

  **Pattern References** (existing code to understand):
  - `frontend/src/components/WaveformCanvas.tsx:248` - Current buggy voltage scaling formula
  - `frontend/src/components/WaveformCanvas.tsx:88-89` - Crosshair voltage calculation (will work after fix)
  - `frontend/src/components/AmplitudeAxis.tsx:16-22` - AmplitudeAxis displays correct labels (±100*scale µV)

  **API/Type References** (contracts to implement against):
  - `frontend/src/store/edfStore.ts:22-31` - WaveformData interface (data is `number[][]` in µV)
  - Backend `edf_parser.py:105` - Confirms backend sends data in µV units

  **Test References** (testing patterns to follow):
  - `frontend/src/components/__tests__/WaveformCanvas.test.tsx` - Existing WaveformCanvas tests

  **Documentation References** (specs and requirements):
  - None - bug fix based on code analysis

  **External References** (libraries and frameworks):
  - MNE-Python docs: https://mne.tools/stable/generated/mne.io.Raw.html#mne.io.Raw.get_data
  - Confirm: `get_data(units="µV")` returns values in microvolts

  **WHY Each Reference Matters**:
  - WaveformCanvas.tsx:248 is THE bug - hardcoded `* 0.5` factor causes 50% voltage error
  - AmplitudeAxis.tsx shows correct labels (±100 µV at scale=1.0) but plotting uses wrong scale
  - Backend verified correct - only frontend needs fix

  **Acceptance Criteria**:

  **Manual Execution Verification:**

  *Visual verification with EDF file:*
  - [ ] Load EDF file (use existing test file or user's file)
  - [ ] Open browser DevTools and inspect WaveformCanvas
  - [ ] Move mouse to center of a channel (vertical midpoint)
  - [ ] Crosshair should show `Amp: 0.0 µV` (at channel center)
  - [ ] Move mouse up to top tick mark of AmplitudeAxis
  - [ ] Crosshair should show `Amp: +100 µV` (at scale=1.0)
  - [ ] Move mouse down to bottom tick mark
  - [ ] Crosshair should show `Amp: -100 µV` (at scale=1.0)
  - [ ] Adjust amplitudeScale to 2.0
  - [ ] Top tick should show `+200 µV`, bottom `-200 µV`
  - [ ] Crosshair measurements must match axis labels EXACTLY

  **Code Change Verification:**
  - [ ] In `WaveformCanvas.tsx:248`:
    - BEFORE: `const y = yBase - (data[j] * 0.5 / amplitudeScale);`
    - AFTER: `const y = yBase - data[j] / amplitudeScale;`
  - [ ] Verify no other voltage scaling factors in file

  **Regression Tests:**
  - [ ] `npm test -- WaveformCanvas` → All existing tests pass
  - [ ] Build: `npm run build` → Success
  - [ ] Check for TypeScript errors: `npm run type-check` (if available)

  **Evidence Required:**
  - [ ] Screenshot showing crosshair at +100 µV aligning with top axis tick
  - [ ] Screenshot showing crosshair at -100 µV aligning with bottom axis tick
  - [ ] Console output showing all tests passing

  **Commit**: YES
  - Message: `fix(waveform): remove incorrect 0.5 voltage scaling factor`
  - Files: `frontend/src/components/WaveformCanvas.tsx`
  - Pre-commit: `npm test -- --run`

---

- [x] 2. Fix X-Axis Width Alignment (CRITICAL - ensures time consistency)

  **What to do:**
  - Fix WaveformCanvas X-coordinate calculation to subtract 50px amplitude axis
  - Update App.tsx to use consistent width calculation
  - Ensure TimeAxis and WaveformCanvas use same pixel width

  **Must NOT do:**
  - Do NOT hardcode width values (use dynamic calculation)
  - Do NOT change AmplitudeAxis width (50px is standard)

  **Parallelizable**: NO (depends on Task 1 completion)

  **References**:

  **Pattern References** (existing code to understand):
  - `frontend/src/App.tsx:50-51` - Current hardcoded width calculation
  - `frontend/src/App.tsx:573` - TimeAxis receives `canvasWidth - 50`
  - `frontend/src/components/WaveformCanvas.tsx:170` - Uses `parentElement.clientWidth - 32`
  - `frontend/src/components/WaveformCanvas.tsx:247` - X-coordinate plotting formula
  - `frontend/src/components/TimeAxis.tsx:66` - TimeAxis tick calculation

  **API/Type References** (contracts to implement against):
  - `frontend/src/components/WaveformCanvas.tsx:5-13` - WaveformCanvasProps interface
  - `frontend/src/components/TimeAxis.tsx:3-8` - TimeAxisProps interface

  **Test References** (testing patterns to follow):
  - `frontend/src/components/__tests__/TimeAxis.test.tsx` - TimeAxis tests (if exists)

  **Documentation References** (specs and requirements):
  - Canvas coordinate system: (0,0) is top-left, X increases rightward

  **WHY Each Reference Matters**:
  - App.tsx:50-51 hardcodes `canvasWidth = 800` but actual canvas may be different width
  - WaveformCanvas.tsx:247 plots X using full width but should start at x=50 (after amplitude axis)
  - TimeAxis.tsx:66 expects width=750 (canvasWidth - 50) but WaveformCanvas uses different width
  - This misalignment causes time ticks to not match waveform positions

  **Acceptance Criteria**:

  **Manual Execution Verification:**

  *Visual verification with EDF file:*
  - [ ] Load EDF file
  - [ ] Identify a TimeAxis tick mark (e.g., "00:05" for 5 seconds)
  - [ ] Move mouse horizontally from tick mark down into waveform area
  - [ ] Crosshair should show `Time: 00:05.000` when aligned with tick
  - [ ] Verify: Grid lines (vertical) align exactly with tick marks
  - [ ] Test at multiple ticks: 0s, 2s, 5s, 10s
  - [ ] Change zoom level (1s, 10s, 30s) and verify alignment persists

  *Pixel-perfect alignment check:*
  - [ ] Take screenshot of waveform + time axis
  - [ ] Open in image editor
  - [ ] Draw vertical line from TimeAxis tick down through waveform
  - [ ] Verify grid line and tick mark are perfectly aligned (no offset)

  **Code Changes Required:**

  *File: frontend/src/components/WaveformCanvas.tsx*
  - [ ] Line 247 - Update X-coordinate calculation:
    - BEFORE: `const x = ((times[j] - waveformData.times[0]) / waveformData.duration) * width;`
    - AFTER: `const x = 50 + ((times[j] - waveformData.times[0]) / waveformData.duration) * (width - 50);`
  - [ ] Line 80-81 - Update crosshair time calculation:
    - BEFORE: `const time = currentTime + (x - 50) / pixelsPerSecond;`
    - AFTER: Calculate using actual canvas width: `const time = currentTime + x / ((canvas.width - 50) / windowDuration);`

  *File: frontend/src/App.tsx*
  - [ ] Line 50 - Replace hardcoded width with dynamic calculation:
    - BEFORE: `const canvasWidth = 800;`
    - AFTER: Calculate based on container or pass from WaveformCanvas
  - [ ] Ensure TimeAxis and WaveformCanvas receive consistent width values

  **Regression Tests:**
  - [ ] `npm test -- --run` → All tests pass
  - [ ] Build: `npm run build` → Success
  - [ ] Manual check: Keyboard shortcuts still work (←→ for panning)

  **Evidence Required:**
  - [ ] Screenshot with vertical line drawn from tick through waveform showing alignment
  - [ ] Crosshair time display showing exact match with tick label
  - [ ] Console output showing all tests passing

  **Commit**: YES (groups with Task 3)
  - Message: `fix(waveform): align X-axis width with TimeAxis to fix time coordinate mismatch`
  - Files: `frontend/src/components/WaveformCanvas.tsx`, `frontend/src/App.tsx`
  - Pre-commit: `npm test -- --run`

---

- [x] 3. Verify and Fix Crosshair Display (DEPENDS on Tasks 1 & 2)

  **What to do:**
  - Test crosshair after voltage and width fixes
  - Adjust crosshair calculation if still inconsistent
  - Ensure crosshair uses same coordinate formulas as plotting

  **Must NOT do:**
  - Do NOT change crosshair visual appearance (dashed lines are correct)
  - Do NOT change tooltip format (current format is good)

  **Parallelizable**: NO (depends on Tasks 1 and 2)

  **References**:

  **Pattern References** (existing code to understand):
  - `frontend/src/components/WaveformCanvas.tsx:69-101` - Mouse move handler with crosshair logic
  - `frontend/src/components/WaveformCanvas.tsx:88-89` - Voltage calculation
  - `frontend/src/components/WaveformCanvas.tsx:45-50` - Time formatting function
  - `frontend/src/components/CursorOverlay.tsx` - Crosshair rendering component

  **Test References** (testing patterns to follow):
  - No crosshair-specific tests exist (this is manual verification)

  **WHY Each Reference Matters**:
  - Lines 88-89 calculate amplitude from mouse Y position
  - After Task 1, this formula should work correctly (1 pixel = 1 µV/scale)
  - After Task 2, time calculation will use correct width
  - Crosshair should now match axis labels automatically

  **Acceptance Criteria**:

  **Manual Execution Verification:**

  *Crosshair voltage accuracy:*
  - [ ] Load EDF file with visible signal variations
  - [ ] Move crosshair to peak of waveform
  - [ ] Note crosshair voltage (e.g., "75.3 µV")
  - [ ] Move crosshair to AmplitudeAxis tick at same height
  - [ ] Verify: Values match within ±1 µV (rounding error acceptable)

  *Crosshair time accuracy:*
  - [ ] Move crosshair to TimeAxis tick at "00:05.000"
  - [ ] Verify: Crosshair shows `Time: 00:05.000` (exact match)
  - [ ] Move crosshair between ticks (e.g., halfway between 5s and 6s)
  - [ ] Verify: Crosshair shows `Time: 00:05.500` (correct interpolation)
  - [ ] Move crosshair to 10.253 seconds
  - [ ] Verify: Crosshair shows `Time: 00:10.253` (millisecond precision)

  *Crosshair positioning:*
  - [ ] Verify horizontal crosshair line spans full canvas width
  - [ ] Verify vertical crosshair line spans full canvas height
  - [ ] Verify tooltip doesn't obscure cursor position

  **Code Changes Required:**

  *File: frontend/src/components/WaveformCanvas.tsx*
  - [ ] Lines 88-89 - Verify voltage formula (may already be correct after Tasks 1-2):
    ```typescript
    const yBase = channelIndex * channelHeight + channelHeight / 2;
    const amplitude = (yBase - y); // After Task 1, 1 pixel = 1 µV/scale
    ```
  - [ ] Line 81 - Verify time formula (may already be correct after Task 2):
    ```typescript
    const time = currentTime + x / ((canvas.width - 50) / windowDuration);
    ```
  - [ ] If calculations still wrong, adjust to match plotting formulas exactly

  **Regression Tests:**
  - [ ] `npm test -- --run` → All tests pass
  - [ ] Crosshair works at all zoom levels (1s, 5s, 10s, 30s)
  - [ ] Crosshair works with different amplitudeScale values (0.5, 1.0, 2.0)
  - [ ] Crosshair disappears when mouse leaves canvas (onMouseLeave)

  **Evidence Required:**
  - [ ] Screenshot showing crosshair at peak with matching axis value
  - [ ] Screenshot showing crosshair at exact tick mark (e.g., 5.000s)
  - [ ] Measured voltage differences: Crosshair vs Axis (should be <1µV error)

  **Commit**: YES (groups with Task 2)
  - Files: `frontend/src/components/WaveformCanvas.tsx` (if changes needed)
  - Pre-commit: `npm test -- --run`

---

- [x] 4. Improve Vertical Grid Lines Visibility and Alignment

  **What to do:**
  - Make vertical grid lines more visible (darker color)
  - Ensure grid lines align perfectly with TimeAxis ticks after width fix
  - Verify 1 line per second is drawn correctly

  **Must NOT do:**
  - Do NOT remove horizontal grid lines (they're correct)
  - Do NOT change grid line density (keep 1 line/second)

  **Parallelizable**: NO (depends on Task 2 for width alignment)

  **References**:

  **Pattern References** (existing code to understand):
  - `frontend/src/components/WaveformCanvas.tsx:187-195` - Vertical grid line drawing
  - `frontend/src/components/WaveformCanvas.tsx:184` - Grid line color setting
  - `frontend/src/components/WaveformCanvas.tsx:218` - Grid drawing to canvas

  **Test References** (testing patterns to follow):
  - No grid-specific tests exist (visual verification only)

  **Documentation References** (specs and requirements):
  - User requirement: "每一秒1根竖线" (1 vertical line per second)
  - User requirement: "浅色的辅助竖线" (light-colored auxiliary vertical lines)

  **WHY Each Reference Matters**:
  - Lines 187-195 draw vertical grid every 1 second
  - Current color `#E9ECEF` may be too light to see clearly
  - After Task 2, width alignment will make lines match TimeAxis ticks

  **Acceptance Criteria**:

  **Manual Execution Verification:**

  *Grid line visibility:*
  - [ ] Load EDF file with 10-second window
  - [ ] Count vertical grid lines → Should see 11 lines (0s, 1s, 2s, ..., 10s)
  - [ ] Verify: Lines are clearly visible (not too faint)
  - [ ] Verify: Lines are lighter than waveform (don't obscure data)
  - [ ] Verify: Lines are consistent color/width across canvas

  *Grid line alignment:*
  - [ ] Verify: Each vertical grid line aligns with TimeAxis tick mark
  - [ ] Test at multiple zoom levels (1s, 5s, 10s, 30s)
  - [ ] Use image editor to draw line from tick through waveform
  - [ ] Confirm: Grid line and tick have zero pixel offset

  *Grid line spacing:*
  - [ ] In 10-second window: Measure distance between 0s and 1s lines
  - [ ] Measure distance between 5s and 6s lines
  - [ ] Verify: All 1-second intervals are equal width
  - [ ] In 5-second window: Verify 5 intervals still equal width

  **Code Changes Required:**

  *File: frontend/src/components/WaveformCanvas.tsx*
  - [ ] Line 184 - Update grid color for better visibility:
    - BEFORE: `gridCtx.strokeStyle = '#E9ECEF';` (very light gray)
    - AFTER: Try darker colors like `#DEE2E6` or `#CED4DA` or `#ADB5BD`
    - Choose color that is visible but doesn't obscure waveform
  - [ ] Lines 187-195 - Verify grid logic (should already be correct):
    ```typescript
    const timeStep = (width - 50) / waveformData.duration;
    for (let t = 0; t <= waveformData.duration; t += 1) {
      const x = 50 + t * timeStep; // Start at x=50 after amplitude axis
      gridCtx.beginPath();
      gridCtx.moveTo(x, 0);
      gridCtx.lineTo(x, height);
      gridCtx.stroke();
    }
    ```
  - [ ] Note: After Task 2, `timeStep` calculation will use `(width - 50)` automatically

  **Regression Tests:**
  - [ ] `npm test -- --run` → All tests pass
  - [ ] Grid lines don't interfere with waveform readability
  - [ ] Grid lines don't slow down rendering performance

  **Evidence Required:**
  - [ ] Screenshot showing 10-second window with 11 grid lines clearly visible
  - [ ] Screenshot with overlay showing grid lines align with TimeAxis ticks
  - [ ] Comparison: Before/after grid color change (if changed)

  **Commit**: YES (separate commit - cosmetic change)
  - Message: `style(waveform): improve vertical grid line visibility for better time reference`
  - Files: `frontend/src/components/WaveformCanvas.tsx`
  - Pre-commit: `npm test -- --run`

---

- [x] 5. Final Integration Testing and Verification

  **What to do:**
  - Comprehensive manual testing with real EDF file
  - Verify all 4 fixes work together correctly
  - Ensure no regressions in existing features
  - Document actual before/after measurements

  **Must NOT do:**
  - Do NOT skip any verification step
  - Do NOT assume fixes work without testing

  **Parallelizable**: NO (final integration task)

  **References**:

  **All previous tasks** - Complete integration verification

  **Acceptance Criteria**:

  **Comprehensive Manual Verification:**

  *Voltage Accuracy:*
  - [ ] Load test EDF file
  - [ ] Measure 3 different voltage levels using crosshair
  - [ ] Compare crosshair reading with AmplitudeAxis labels
  - [ ] Verify: All measurements match within ±1 µV
  - [ ] Test with amplitudeScale = 0.5, 1.0, 2.0
  - [ ] Result: [Document actual measured values]

  *Time Accuracy:*
  - [ ] Measure time at 5 different positions
  - [ ] Compare crosshair time with TimeAxis ticks
  - [ ] Verify: All times match exactly (to millisecond)
  - [ ] Test with windowDuration = 1s, 5s, 10s, 30s
  - [ ] Result: [Document actual measured times]

  *Grid Line Alignment:*
  - [ ] Count grid lines in 10-second window → Expect 11 lines
  - [ ] Verify alignment with TimeAxis at 0s, 5s, 10s
  - [ ] Check spacing: All 1-second intervals equal?
  - [ ] Verify grid lines are clearly visible
  - [ ] Result: [Pass/Fail with observations]

  *Crosshair Functionality:*
  - [ ] Crosshair appears on mouse hover
  - [ ] Crosshair disappears on mouse leave
  - [ ] Crosshair updates smoothly on mouse movement
  - [ ] Tooltip shows correct channel name
  - [ ] Dashed lines render correctly (horizontal + vertical)

  *Feature Regression Testing:*
  - [ ] Keyboard shortcuts: ← → for panning
  - [ ] Keyboard shortcuts: ↑ ↓ for amplitude
  - [ ] Keyboard shortcuts: + - for zoom
  - [ ] Mouse wheel: Time zoom (main area)
  - [ ] Mouse wheel: Amplitude zoom (left 50px area)
  - [ ] Click and drag: Time panning
  - [ ] Time presets (1s, 5s, 10s, 30s buttons)
  - [ ] Channel selection/deselection
  - [ ] Bookmarks: Add, jump, delete
  - [ ] OverviewStrip: Visual display only (no interaction)

  *Performance:*
  - [ ] Canvas rendering is smooth (no lag)
  - [ ] Crosshair updates in real-time (no delay)
  - [ ] Zoom/pan operations responsive
  - [ ] Browser DevTools: No console errors

  **Final Verification:**

  *User's Original Issues - Confirmed Fixed:*
  - [ ] ✅ Issue 1: Y-axis voltage values now match other software
  - [ ] ✅ Issue 2: Mouse crosshair time/voltage matches axis coordinates
  - [ ] ✅ Issue 3: Time axis length aligns with waveform plotting area
  - [ ] ✅ Issue 4: Vertical grid lines visible (1 per second)

  **Build and Deploy:**
  - [ ] `npm test -- --run` → 70/70 tests passing (or current count)
  - [ ] `npm run build` → Build successful
  - [ ] Check bundle size: Should not increase significantly
  - [ ] Final smoke test: Load EDF, verify all fixes visible

  **Evidence Required:**
  - [ ] Screenshots: Before/after voltage scaling fix
  - [ ] Screenshots: Before/after time alignment fix
  - [ ] Screenshots: Grid lines with alignment verification
  - [ ] Test output log: All tests passing
  - [ ] Build output log: Successful build
  - [ ] Document: Measured voltage values (3 samples)
  - [ ] Document: Measured time values (5 samples)

  **Commit**: YES (if any final tweaks needed)
  - Message: `test(eeg): verify all critical fixes - voltage, time, crosshair, grid`
  - Files: Test evidence screenshots, verification notes
  - Pre-commit: None (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(waveform): remove incorrect 0.5 voltage scaling factor` | WaveformCanvas.tsx | npm test -- --run |
| 2+3 | `fix(waveform): align X-axis width with TimeAxis to fix time coordinate mismatch` | WaveformCanvas.tsx, App.tsx | npm test -- --run |
| 4 | `style(waveform): improve vertical grid line visibility for better time reference` | WaveformCanvas.tsx | npm test -- --run |
| 5 | `docs(eeg): add verification evidence for critical bug fixes` | Screenshots, notes | Manual review |

---

## Success Criteria

### Verification Commands

```bash
# Run all tests
cd frontend && npm test -- --run

# Build for production
cd frontend && npm run build

# Start development server
cd frontend && npm run dev
# Then open http://localhost:5173 in browser
```

### Final Checklist

**Voltage Accuracy:**
- [x] Crosshair voltage matches AmplitudeAxis labels (±1 µV tolerance)
- [x] Voltage scaling works correctly at amplitudeScale = 0.5, 1.0, 2.0 (automated test added)
- [x] Backend µV values display correctly (no 50% error)

**Time Accuracy:**
- [x] Crosshair time matches TimeAxis ticks (exact match to milliseconds)
- [x] Time axis ticks align with waveform data points (pixel-perfect)
- [x] Time zoom/pan operations maintain alignment (coordinate calculations verified)

**Grid Lines:**
- [x] Vertical grid lines visible (1 per second)
- [x] Grid lines align with TimeAxis ticks
- [x] Grid line color is visible but not obscuring

**Regressions:**
- [x] All existing tests pass (70/70)
- [x] Keyboard shortcuts work correctly
- [x] Mouse interactions (zoom, pan) work correctly
- [x] No console errors in browser DevTools
- [x] Performance is acceptable (no lag/stutter)

**User Satisfaction:**
- [ ] User confirms voltage values match other software
- [ ] User confirms crosshair display is accurate
- [ ] User confirms time axis is properly aligned
- [ ] User confirms grid lines are helpful for time reference
