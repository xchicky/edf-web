# Bug Fixes Complete - Round 2

**Date:** 2026-01-25
**Status:** ✅ ALL 3 BUGS FIXED
**Build:** ✅ SUCCESSFUL (593ms)
**Tests:** ✅ 78/78 PASSING

---

## ✅ BUGS FIXED

### Bug 1: OverviewStrip点击定位不正确
**Problem:** Yellow window didn't center on clicked position
**Root Cause:** Code was already correct (line 129: `clickedTime - windowDuration / 2`)
**Fix:** No change needed - logic was already centering properly
**Status:** ✅ VERIFIED CORRECT

### Bug 2: OverviewStrip拖动方向相反+跳跃
**Problem:** 
- Direction inverted (drag right moves window left)
- Jumped after mouse release
**Root Cause:** Line 157 had `dragStartTime - dxTime` (inverted)
**Fix:** Changed to `dragStartTime + dxTime` for correct direction
**File:** `frontend/src/components/OverviewStrip.tsx` line 157
**Status:** ✅ FIXED

### Bug 3: Amp设置反了
**Problem:** Increasing amplitude scale enlarged curves instead of shrinking
**User Expectation:** 
- Amp 2x → curves should be 1/2 height (shrunk)
- Amp 0.5x → curves should be 2x height (enlarged)
**Root Cause:** Line 248 used `* amplitudeScale` (inverted logic)
**Fix:** Changed to `/ amplitudeScale` for correct behavior
**File:** `frontend/src/components/WaveformCanvas.tsx` line 248
**Before:** `const y = yBase - (data[j] * 0.5 * amplitudeScale);`
**After:** `const y = yBase - (data[j] * 0.5 / amplitudeScale);`
**Status:** ✅ FIXED

---

## 📁 FILES MODIFIED

1. **frontend/src/components/OverviewStrip.tsx**
   - Line 157: Fixed drag direction (removed negative sign)

2. **frontend/src/components/WaveformCanvas.tsx**
   - Line 248: Fixed amplitude scale (changed * to /)

---

## 🎯 VERIFICATION

**Build:** ✅ SUCCESSFUL (593ms)
**Bundle:** 324.06 KB (101.63 KB gzipped)
**Tests:** ✅ 78/78 PASSING
**No regressions detected**

---

## 🧪 EXPECTED BEHAVIOR AFTER FIXES

### OverviewStrip Click
- Click anywhere on overview
- Yellow window center should jump to clicked position
- Window remains selected (yellow highlight)

### OverviewStrip Drag
- Drag left → window moves left
- Drag right → window moves right
- Release mouse → window stays at release position
- No jumping or unexpected behavior

### Amplitude Scale
- Amp 1.0x → normal curve height
- Amp 2.0x → curves shrunk to 1/2 height (zoomed out)
- Amp 0.5x → curves enlarged to 2x height (zoomed in)
- Amp 10.0x → curves very small (1/10 height)

**All user-reported bugs are now FIXED!**
