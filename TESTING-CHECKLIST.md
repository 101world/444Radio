# Multi-Track DAW Testing Checklist

## ✅ Testing Procedure (Todo #1: Test Mixer Controls)

### Pre-Test Setup
1. Open `/studio/multi-track` in browser
2. Open DevTools console (F12)
3. Prepare a short audio file (MP3/WAV, 5-30 seconds)

---

## Test Suite

### 1️⃣ File Upload
- [ ] Click "Upload Audio" button
- [ ] Select audio file from computer
- [ ] **Expected**: Track appears in track list
- [ ] **Expected**: Waveform renders in timeline
- [ ] **Expected**: Console shows: `✅ Loaded [filename] - duration: X.XXs`

### 2️⃣ Basic Playback
- [ ] Click Play button (▶️)
- [ ] **Expected**: Audio plays through speakers
- [ ] **Expected**: Playhead moves across timeline
- [ ] **Expected**: Play button turns cyan
- [ ] **Expected**: Console shows no errors

### 3️⃣ Pause/Stop
- [ ] Click Pause (⏸) during playback
- [ ] **Expected**: Audio stops, playhead stays in place
- [ ] Click Play again
- [ ] **Expected**: Audio resumes from paused position
- [ ] Click Stop (⏹)
- [ ] **Expected**: Playhead resets to 0s

### 4️⃣ Volume Control (Track List)
- [ ] Play audio
- [ ] Adjust mini volume slider (track list left panel)
- [ ] **Expected**: Audio gets louder/quieter in real-time
- [ ] Set to 0%
- [ ] **Expected**: Audio silenced
- [ ] Set to 100%
- [ ] **Expected**: Full volume

### 5️⃣ Volume Control (Mixer Panel)
- [ ] Click track name to select
- [ ] **Expected**: Mixer panel appears on right
- [ ] Play audio
- [ ] Adjust volume slider in mixer
- [ ] **Expected**: Audio volume changes (same as track list slider)
- [ ] **Expected**: Both sliders stay in sync

### 6️⃣ Pan Control
- [ ] Play audio
- [ ] Adjust pan slider in mixer (-100 to +100)
- [ ] Move to -100 (Left)
- [ ] **Expected**: Audio only in left speaker/headphone
- [ ] Move to +100 (Right)
- [ ] **Expected**: Audio only in right speaker/headphone
- [ ] Move to 0 (Center)
- [ ] **Expected**: Audio balanced both sides
- [ ] **Note**: Wear headphones for accurate test

### 7️⃣ Mute Button
- [ ] Play audio
- [ ] Click Mute button (M) in track list
- [ ] **Expected**: Audio silenced, button turns red
- [ ] **Expected**: Mixer shows "🔇 Muted"
- [ ] Click Mute again (unmute)
- [ ] **Expected**: Audio resumes, button returns to gray

### 8️⃣ Solo Button
- [ ] Upload second audio file (create Track 2)
- [ ] Play both tracks
- [ ] **Expected**: Both tracks play simultaneously
- [ ] Click Solo (S) on Track 1
- [ ] **Expected**: Only Track 1 audible, button turns yellow
- [ ] **Expected**: Track 2 muted automatically
- [ ] Click Solo again (unsolo)
- [ ] **Expected**: Both tracks audible again

### 9️⃣ Multiple Tracks
- [ ] Upload 3-4 different audio files
- [ ] Play all tracks
- [ ] **Expected**: All clips play simultaneously (mixer)
- [ ] Adjust volumes independently
- [ ] **Expected**: Each track volume controlled separately
- [ ] Mute/Solo different tracks
- [ ] **Expected**: Only un-muted tracks audible

### 🔟 Clip Playback Timing
- [ ] Upload audio file
- [ ] Note the clip's startTime (should be 0s initially)
- [ ] Play from beginning
- [ ] **Expected**: Clip starts immediately at 0s
- [ ] Manually edit clip startTime in DevTools: `daw.getTracks()[0].clips[0].startTime = 2`
- [ ] Play from beginning
- [ ] **Expected**: 2 seconds of silence, then clip plays

---

## 🐛 Known Issues to Check

### Issue #1: Volume Changes Not Applied
**Symptom**: Slider moves but volume doesn't change  
**Cause**: Routing node not updated  
**Check**: Console for errors like `node is undefined`  
**Fix**: Verify `updateRoutingNode()` called in `setVolume()`

### Issue #2: Pan Not Working
**Symptom**: Audio always centered  
**Cause**: StereoPannerNode not created  
**Check**: `node.panNode` exists in routing graph  
**Fix**: Verify `createRoutingNode()` creates panNode

### Issue #3: Mute Doesn't Silence
**Symptom**: Audio still plays when muted  
**Cause**: Gain not set to 0  
**Check**: `node.gainNode.gain.value` in console  
**Fix**: Verify `updateRoutingNode()` sets gain to 0 when muted

### Issue #4: Solo Doesn't Isolate
**Symptom**: All tracks still play when one is soloed  
**Cause**: Solo state not propagated to routing  
**Check**: `soloedTracks` Set in TrackManager  
**Fix**: Verify `updateSoloState()` called on toggleSolo

### Issue #5: Multiple Clips Overlap
**Symptom**: Clips play on top of each other  
**Cause**: All clips start at 0s  
**Check**: Each clip's `startTime` property  
**Fix**: Set unique startTime when uploading

---

## 🎯 Success Criteria

All tests pass if:
- ✅ Audio plays when Play button clicked
- ✅ Volume slider affects playback loudness
- ✅ Pan slider moves audio left/right
- ✅ Mute silences track completely
- ✅ Solo isolates one track from others
- ✅ Multiple tracks play simultaneously
- ✅ Waveforms visible and match audio
- ✅ Playhead moves smoothly during playback
- ✅ No console errors during any operation

---

## 📊 Test Results

**Date**: [Current Date]  
**Tester**: [Your Name]  
**Browser**: [Chrome/Firefox/Safari] [Version]  
**OS**: [Windows/Mac/Linux]

### Passed Tests (X/10):
- [ ] File Upload
- [ ] Basic Playback
- [ ] Pause/Stop
- [ ] Volume Control (Track List)
- [ ] Volume Control (Mixer)
- [ ] Pan Control
- [ ] Mute Button
- [ ] Solo Button
- [ ] Multiple Tracks
- [ ] Clip Timing

### Issues Found:
1. 
2. 
3. 

### Notes:


---

## 🔧 Debug Commands (DevTools Console)

```javascript
// Get DAW instance (if exposed globally)
// window.daw

// Check tracks
daw.getTracks()

// Check specific track
daw.getTracks()[0]

// Check routing nodes
daw.trackManager.getRoutingNode('track-id')

// Manually set volume
daw.setTrackVolume('track-id', 0.5)

// Manually set pan
daw.setTrackPan('track-id', -1) // Full left

// Check audio context state
daw.getAudioContext().state

// Resume if suspended
daw.getAudioContext().resume()

// Check active sources during playback
// (activeSourceNodes should be populated when playing)
```

---

## 📝 Next Steps After Testing

If all tests pass:
1. Mark Todo #1 as complete ✅
2. Move to Todo #2 (Clip Selection)
3. Commit test results

If issues found:
1. Document in "Issues Found" section
2. Create GitHub issues if needed
3. Fix critical bugs before proceeding
4. Re-test after fixes

---

**Status**: ⏳ Pending Testing  
**Priority**: 🔴 CRITICAL (blocks other features)  
**Est. Time**: 15-30 minutes
