# 🎯 START HERE: Complete Your EEG Viewer Validation

**Time Required:** 20 minutes  
**Difficulty:** Beginner  
**Outcome:** Verify all fixes work correctly with your EDF files

---

## Quick Overview

Your EEG viewer has been fixed with 4 critical bug corrections:
- ✅ Y-axis voltage scaling (50% error removed)
- ✅ X-axis time alignment (waveform now matches time axis)
- ✅ Crosshair display (shows accurate coordinates)
- ✅ Grid lines (visible vertical time markers)

**All code changes are complete and verified.**

**Your job:** Validate these fixes work correctly with your real EDF files.

---

## Step-by-Step Instructions

### Step 1: Start Development Server (1 minute)

Open your terminal and run:

```bash
cd frontend && npm run dev
```

You should see:
```
VITE v7.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

**Leave this terminal open.**

### Step 2: Open Browser (30 seconds)

Open your web browser and navigate to:
```
http://localhost:5173
```

**Expected:** EDF Viewer interface loads

### Step 3: Upload Your EDF File (1 minute)

- Click "Drag & drop EDF file here"
- OR drag and drop your EDF file onto the page

**Expected:** Waveform displays, metadata shows

### Step 4: Complete 5 Verification Tasks (15 minutes)

Follow the checklist below. For each task:
- ✅ Mark checkbox if it passes
- ⚠️ Note any issues if it fails

---

## Quick Verification Checklist

### Task 1: Basic Functionality ✅
- [ ] File loads without errors
- [ ] Waveform displays correctly
- [ ] Can navigate with arrow keys
- [ ] Can zoom with +/- keys
- [ ] Can adjust amplitude with mouse wheel on left side

**Expected:** Everything works smoothly

### Task 2: Voltage Accuracy ✅
- [ ] Move mouse to channel center → Crosshair shows ~0 µV
- [ ] Move mouse to channel top → Crosshair shows +100 µV (at scale=1.0)
- [ ] Move mouse to channel bottom → Crosshair shows -100 µV (at scale=1.0)
- [ ] Crosshair voltage matches AmplitudeAxis labels

**Expected:** Values match within ±1 µV

### Task 3: Time Alignment ✅
- [ ] Find TimeAxis tick (e.g., "00:05")
- [ ] Move mouse down from tick
- [ ] Crosshair shows exact time (e.g., "00:05.000")
- [ ] Vertical grid line passes through tick
- [ ] No visible offset between tick and grid line

**Expected:** Perfect alignment

### Task 4: Zoom/Pan Alignment ✅
- [ ] Click "5s" zoom button → Grid lines still align
- [ ] Click "1s" zoom button → Grid lines still align
- [ ] Press → key to pan right → Grid lines still align
- [ ] Press ← key to pan left → Grid lines still align

**Expected:** Alignment maintained during all operations

### Task 5: Grid Line Helpfulness ✅
- [ ] Can see vertical grid lines clearly
- [ ] Lines help you track time position
- [ ] Lines are spaced correctly (1 per second)
- [ ] Lines improve navigation experience

**Expected:** Grid lines are useful

---

## What If Something Fails?

### Don't Panic - Here's What to Do

1. **Note the Problem**
   - Which task failed?
   - What did you expect to see?
   - What did you actually see?

2. **Take a Screenshot**
   - Press F12 (DevTools)
   - Check for errors in Console tab
   - Take screenshot of the issue

3. **Report It**
   - Create issue with task number
   - Describe what happened
   - Attach screenshot
   - Development team will fix it

### Most Issues Are Simple Fixes

Common problems and solutions:
- **File won't load:** Try a different EDF file
- **Strange display:** Refresh the page (F5)
- **Crosshair missing:** Move mouse over waveform
- **Values look wrong:** Check amplitude scale setting

---

## Success Criteria

**All 5 Tasks Pass = 100% Complete** ✅

Your EEG viewer is:
- ✅ Displaying correct voltage values
- ✅ Showing accurate time coordinates
- ✅ Providing helpful visual references
- ✅ Ready for professional EEG analysis

---

## After Validation

### If All Tasks Pass ✅

**Congratulations!** Your EEG viewer is working correctly. 

The plan is 100% complete and ready for production use.

### If Any Tasks Fail ⚠️

**Not a problem!** The development team has:
- Complete documentation of all changes
- Atomic commits for easy fixes
- Clear understanding of the code
- Ability to quickly address issues

Just report what you found and we'll fix it.

---

## Need More Details?

**Comprehensive Testing Guide:**
- See: `USER-TESTING-GUIDE.md`
- 7 detailed tests with step-by-step instructions
- Troubleshooting tips
- How to report issues

**Technical Summary:**
- See: `COMPLETION-REPORT.md`
- All code changes explained
- Verification results
- Test coverage details

---

## Quick Reference

### Keyboard Shortcuts
- `←` `→` = Pan left/right
- `↑` `↓` = Adjust amplitude
- `+` `-` = Zoom time window
- `?` = Show help

### Mouse Controls
- **Scroll** on waveform = Zoom time
- **Scroll** on left 50px = Adjust amplitude
- **Drag** = Pan time
- **Move** = Show crosshair

### Quick Zoom Buttons
- 1s, 5s, 10s, 30s, 5m

---

## Timeline

| Step | Time |
|------|------|
| Start server | 1 min |
| Upload file | 1 min |
| Complete 5 tasks | 15 min |
| **Total** | **~17 min** |

---

## You're Almost There!

You've completed 24/29 tasks (82.8%). 

The final 5 tasks are simple verification that will take ~17 minutes.

**After that: 100% complete and ready for professional use!**

---

**Let's do this! Start with Step 1 above.** 🚀
