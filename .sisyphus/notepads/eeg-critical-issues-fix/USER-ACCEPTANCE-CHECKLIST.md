# User Acceptance Checklist

## Instructions for User

This checklist will guide you through the remaining 5 verification tasks that must be completed manually.

**Estimated Time:** 15-30 minutes

---

## Preparation

### Step 1: Start Development Server
```bash
cd frontend && npm run dev
```

**Expected Output:**
```
VITE v7.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

### Step 2: Open Browser
Navigate to: http://localhost:5173

**Expected:** EDF Viewer interface loads

### Step 3: Upload EDF File
- Click "Drag & drop EDF file here" area
- OR drag and drop your EDF file onto the page
- Select channels (auto-selects first 10)

**Expected:** Waveform displays, metadata shows

---

## Task 1: Manual Verification with Real EDF File ✅

### Objective
Verify the application works correctly with real EDF data

### Steps
1. Upload your EDF file
2. Verify file loads without errors
3. Check metadata displays correctly:
   - [ ] File name shown
   - [ ] File size shown
   - [ ] Channel count shown
   - [ ] Duration shown
   - [ ] Sampling rate shown
4. Verify waveform displays
5. Try navigating:
   - [ ] Click time scrubber at top
   - [ ] Use arrow keys to pan
   - [ ] Use +/- keys to zoom
   - [ ] Try quick zoom buttons (1s, 5s, 10s)

### Result
**PASS:** All features work correctly with your EDF file
**FAIL:** Note any errors or unexpected behavior

---

## Task 2: Verify Voltage Values Match Other Software ✅

### Objective
Confirm voltage accuracy by comparing with reference software

### Steps
1. Open the same EDF file in another EEG viewer
2. Display same time window (e.g., 10-20 seconds)
3. In our viewer:
   - Move mouse to a clear signal peak
   - Note crosshair voltage (e.g., "75.3 µV")
4. In reference viewer:
   - Navigate to same timepoint
   - Check voltage at same location
5. Compare values

### Tolerance
- Voltage values should match within ±1 µV
- Time coordinates should match to millisecond precision

### Result
**PASS:** Values match within tolerance
**FAIL:** Note specific discrepancies

---

## Task 3: Verify Crosshair Display Accuracy ✅

### Objective
Confirm crosshair shows accurate coordinates

### Steps
1. Find a visible signal peak
2. Move crosshair to the peak
3. Check crosshair displays:
   - [ ] Time (e.g., "00:05.123")
   - [ ] Amplitude in µV (e.g., "75.3 µV")
   - [ ] Channel name
4. Move crosshair to channel center (baseline)
   - Should show ~0 µV
5. Move crosshair to AmplitudeAxis top tick
   - Should show +100 µV (at scale=1.0)
6. Move crosshair to AmplitudeAxis bottom tick
   - Should show -100 µV (at scale=1.0)

### Verification
- [ ] Crosshair voltage matches axis labels
- [ ] Crosshair time matches TimeAxis ticks
- [ ] Crosshair updates smoothly on mouse movement
- [ ] Dashed lines render correctly

### Result
**PASS:** Crosshair is accurate and consistent
**FAIL:** Note specific inaccuracies

---

## Task 4: Verify Time Axis Alignment ✅

### Objective
Confirm time axis aligns with waveform plotting

### Steps
1. Identify TimeAxis tick mark (e.g., "00:05")
2. Look for vertical grid line at same position
3. Verify:
   - [ ] Grid line passes through tick mark
   - [ ] Grid line is perfectly vertical
   - [ ] Grid line spans from top to bottom
4. Test at multiple ticks:
   - [ ] At 0 seconds
   - [ ] At 5 seconds
   - [ ] At 10 seconds
5. Test alignment during zoom:
   - [ ] Click "5s" button
   - [ ] Verify grid lines still align
   - [ ] Click "1s" button
   - [ ] Verify grid lines still align
6. Test alignment during pan:
   - [ ] Press → key (pan right)
   - [ ] Verify grid lines still align
   - [ ] Press ← key (pan left)
   - [ ] Verify grid lines still align

### Verification
- [ ] Grid lines align at all zoom levels
- [ ] Grid lines align during pan operations
- [ ] No visual jittering or misalignment

### Result
**PASS:** Time axis perfectly aligned with waveform
**FAIL:** Note when alignment breaks

---

## Task 5: Assess Grid Line Helpfulness ✅

### Objective
Subjective assessment of grid line utility

### Questions to Consider
1. Are the grid lines easy to see?
   - [ ] Too faint
   - [ ] Just right
   - [ ] Too dark

2. Do the grid lines help you navigate?
   - [ ] Yes, very helpful
   - [ ] Somewhat helpful
   - [ ] Not helpful

3. Is 1 line per second the right density?
   - [ ] Too many lines
   - [ ] Just right
   - [ ] Too few lines

4. Do grid lines improve your workflow?
   - [ ] Yes, significantly
   - [ ] Yes, somewhat
   - [ ] No, not really

### Subjective Rating
Rate grid line helpfulness from 1-5:
- 1 = Not helpful at all
- 2 = Slightly helpful
- 3 = Moderately helpful
- 4 = Very helpful
- 5 = Extremely helpful

**Your Rating:** [ 1 | 2 | 3 | 4 | 5 ]

### Result
**PASS:** Grid lines are useful for time reference
**FAIL:** Grid lines need adjustment (provide feedback)

---

## Final Verification

### Overall Assessment
After completing all 5 tasks above:

1. **Voltage Accuracy:**
   - [ ] Confirmed correct
   - [ ] Needs adjustment

2. **Time Alignment:**
   - [ ] Confirmed correct
   - [ ] Needs adjustment

3. **Overall Quality:**
   - [ ] Ready for production use
   - [ ] Needs more work

### If All Tasks Pass ✅

Congratulations! The EEG viewer is working correctly. You can mark the plan as complete.

### If Any Tasks Fail ⚠️

Please provide details:
1. Which task failed
2. What you expected
3. What you observed
4. Steps to reproduce (if applicable)
5. Screenshot (if possible)

**Report to Development Team:**
- Create issue with task number and description
- Attach screenshot if available
- Note severity (critical/minor)

---

## Quick Reference

### Keyboard Shortcuts
- `←` `→` - Pan left/right
- `↑` `↓` - Adjust amplitude
- `+` `-` - Zoom time window
- `Home` - Jump to start
- `End` - Jump to end
- `Space` - Play/pause
- `?` - Show/hide help

### Mouse Controls
- **Scroll wheel** on waveform - Zoom time
- **Scroll wheel** on left 50px - Adjust amplitude
- **Click and drag** - Pan time
- **Mouse move** - Show crosshair

### Quick Zoom Buttons
- 1s, 5s, 10s, 30s, 5m

---

## Completion Criteria

All 5 tasks are complete when:

1. ✅ Real EDF file loads and functions correctly
2. ✅ Voltage values match reference software (±1µV)
3. ✅ Crosshair displays accurate coordinates
4. ✅ Time axis aligns with waveform
5. ✅ Grid lines are helpful for navigation

**When ALL 5 pass:** The plan is 100% complete!

---

## Estimated Time

| Task | Time |
|------|------|
| Task 1: Basic verification | 5 min |
| Task 2: Software comparison | 5 min |
| Task 3: Crosshair accuracy | 3 min |
| Task 4: Alignment testing | 5 min |
| Task 5: Grid line assessment | 2 min |
| **Total** | **20 min** |

---

**Good luck with your testing! Your thorough validation ensures the EEG viewer is accurate and reliable for professional use.**
