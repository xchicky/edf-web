# User Testing Guide - EEG Critical Issues Fix

## Quick Start

```bash
cd frontend && npm run dev
# Open browser to http://localhost:5173
# Upload your EDF file
# Follow the checklist below
```

---

## Testing Checklist

### ✅ Test 1: Voltage Accuracy

**Purpose:** Verify voltage values are correct and no longer have 50% error

**Steps:**
1. Upload EDF file
2. Find a channel with visible signal
3. Move mouse to center of channel (vertical midpoint)
4. Crosshair should show: `Amp: 0.0 µV` (or close to 0)
5. Move mouse to top of channel area
6. Crosshair should show positive voltage (e.g., +75.3 µV)
7. Move mouse to bottom of channel area
8. Crosshair should show negative voltage (e.g., -82.1 µV)
9. Compare crosshair reading with AmplitudeAxis labels
10. They should match within ±1 µV

**Expected Result:** ✅ Crosshair voltage matches axis labels

**If Failed:** Note the discrepancy and report

---

### ✅ Test 2: Voltage Scaling at Different Scales

**Purpose:** Verify amplitudeScale works correctly

**Steps:**
1. Note the current amplitudeScale (default = 1.0)
2. Measure a peak voltage with crosshair
3. Change scale to 2.0 (mouse wheel on left 50px area OR arrow up key)
4. Measure the same peak again
5. Value should be the same (e.g., 75.3 µV)
6. Change scale to 0.5 (arrow down key)
7. Measure the same peak again
8. Value should still be the same

**Expected Result:** ✅ Voltage reading constant regardless of scale

**If Failed:** Note which scale shows incorrect values

---

### ✅ Test 3: Time Alignment

**Purpose:** Verify time axis aligns with waveform

**Steps:**
1. Identify a TimeAxis tick mark (e.g., "00:05" for 5 seconds)
2. Move mouse horizontally from tick mark down into waveform area
3. Keep mouse at same horizontal position
4. Crosshair should show: `Time: 00:05.000`
5. Verify a vertical grid line passes through tick mark
6. Test at multiple ticks: 0s, 2s, 5s, 10s

**Expected Result:** ✅ Grid lines align perfectly with TimeAxis ticks

**If Failed:** Note which ticks show misalignment

---

### ✅ Test 4: Time Zoom Alignment

**Purpose:** Verify alignment during zoom operations

**Steps:**
1. Note grid line alignment at current zoom
2. Zoom in: Click "5s" button (or press + key)
3. Verify grid lines still align with TimeAxis
4. Zoom in more: Click "1s" button
5. Verify alignment maintained
6. Zoom out: Click "30s" button
7. Verify alignment maintained

**Expected Result:** ✅ Grid lines stay aligned during zoom

**If Failed:** Note which zoom level breaks alignment

---

### ✅ Test 5: Time Pan Alignment

**Purpose:** Verify alignment during pan operations

**Steps:**
1. Note grid line alignment
2. Pan right: Press → key OR click and drag waveform right
3. Verify grid lines still align with TimeAxis
4. Pan left: Press ← key
5. Verify alignment maintained
6. Jump to different time: Use time scrubber at top
7. Verify alignment maintained

**Expected Result:** ✅ Grid lines stay aligned during pan

**If Failed:** Note when alignment breaks

---

### ✅ Test 6: Grid Line Visibility

**Purpose:** Verify grid lines are clearly visible

**Steps:**
1. Load EDF file with 10-second window
2. Count vertical grid lines
3. Should see 11 lines (0s, 1s, 2s, ..., 10s)
4. Verify lines are clearly visible (not too faint)
5. Verify lines don't obscure waveform data
6. Check at different zoom levels (1s, 5s, 10s, 30s)

**Expected Result:** ✅ 11 visible, helpful grid lines

**If Failed:** Note if lines are too faint or too dark

---

### ✅ Test 7: Comparison with Other Software

**Purpose:** Verify accuracy against reference software

**Steps:**
1. Open the same EDF file in another EEG viewer
2. Display the same time window (e.g., 10-20 seconds)
3. Compare voltage at same timepoints
4. Compare time coordinates
5. Values should match within ±1 µV (voltage)
6. Values should match to millisecond precision (time)

**Expected Result:** ✅ Values match other software

**If Failed:** Note specific discrepancies

---

## Quick Verification (5 Minutes)

If you're short on time, at minimum test:

1. ✅ Load EDF file
2. ✅ Check crosshair voltage matches axis labels
3. ✅ Check grid lines align with time ticks
4. ✅ Test one zoom operation
5. ✅ Test one pan operation

**If all 5 pass:** Fixes are working correctly!

---

## How to Report Issues

If any test fails, please note:

1. **Which test failed** (Test number and name)
2. **What you expected** to see
3. **What you actually** observed
4. **Steps to reproduce** the issue
5. **Screenshot** if possible

**Example Report:**
```
Test 3 Failed: Time Alignment
Expected: Grid line at 5 seconds aligns with tick
Actual: Grid line is offset by ~2 pixels to the right
Steps: 
1. Uploaded test file
2. Moved mouse to 5-second tick
3. Grid line doesn't align
Screenshot: attached
```

---

## Success Criteria

### All Tests Pass ✅

If all tests pass:
- Voltage values are accurate
- Time coordinates are aligned
- Grid lines provide good reference
- Ready for production use

### Some Tests Fail ⚠️

If tests fail:
- Report specific issues
- Provide screenshots if possible
- Notes on severity (critical/minor)
- Development team will investigate

---

## Keyboard Shortcuts Reference

While testing, you can use these shortcuts:

| Key | Action |
|-----|--------|
| `←` `→` | Pan left/right by window duration |
| `↑` `↓` | Adjust amplitude scale (±0.5x) |
| `+` `-` | Zoom time window (±5s) |
| `Home` | Jump to file start |
| `End` | Jump to file end |
| `Space` | Toggle play/pause |
| `?` | Show/hide help |

---

## Testing Tips

1. **Start with default settings** (scale=1.0, window=10s)
2. **Test incrementally** - verify each fix before testing interactions
3. **Use consistent data** - test same signal features across different settings
4. **Take screenshots** - if you find issues, visual documentation helps
5. **Note edge cases** - extreme values, rapid changes, signal artifacts

---

## Estimated Testing Time

| Testing Level | Time | Description |
|---------------|------|-------------|
| Quick Verification | 5 min | Test 1-3 basic checks |
| Standard Testing | 15 min | Tests 1-6 comprehensive |
| Full Validation | 30 min | All tests + comparison with other software |

**Recommendation:** Start with Quick Verification, then proceed to Standard Testing if first checks pass.

---

## Questions or Issues?

If you encounter problems during testing:

1. Check browser console (F12) for errors
2. Refresh the page and try again
3. Try a different EDF file
4. Report persistent issues with details

---

## Test Results Template

You can copy this template to record your results:

```
EDF File Used: _____________________

Test 1 - Voltage Accuracy: [ ] PASS [ ] FAIL
Notes: ___________________

Test 2 - Voltage Scaling: [ ] PASS [ ] FAIL
Notes: ___________________

Test 3 - Time Alignment: [ ] PASS [ ] FAIL
Notes: ___________________

Test 4 - Time Zoom: [ ] PASS [ ] FAIL
Notes: ___________________

Test 5 - Time Pan: [ ] PASS [ ] FAIL
Notes: ___________________

Test 6 - Grid Visibility: [ ] PASS [ ] FAIL
Notes: ___________________

Test 7 - Software Comparison: [ ] PASS [ ] FAIL [ ] SKIPPED
Notes: ___________________

Overall: [ ] ALL PASS [ ] SOME FAILURES

If failures, describe:
___________________
___________________
```

---

**Good luck with testing! Your feedback helps ensure the EEG viewer is accurate and reliable.**
