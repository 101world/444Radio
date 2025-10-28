# Fork AudioMass to Your Account - Simple Steps

## Option 1: Via GitHub Website (EASIEST - 30 seconds)

1. **Go to**: https://github.com/pkalogiros/AudioMass
2. **Click**: "Fork" button (top right corner)
3. **Select**: Your account (101world) as the destination
4. **Click**: "Create fork"

✅ **Done!** Your fork will be at: `https://github.com/101world/AudioMass`

Then come back here and I'll update the submodule to point to your fork.

---

## Option 2: Via Command Line (if you prefer)

After you create the empty repo on GitHub:

```powershell
# In PowerShell
cd c:\444Radio
cd vendor\audiomass

# Add your fork as a new remote
git remote add myfork https://github.com/101world/AudioMass.git

# Push to your fork
git push myfork production
git push myfork master  # if master branch exists
git push myfork --all   # push all branches
git push myfork --tags  # push all tags
```

---

## Option 3: I'll Wait and Do It For You

Just tell me once you've clicked "Fork" on GitHub, and I'll:

1. Remove the temp clone
2. Update the submodule in `c:\444Radio\vendor\audiomass` to point to `https://github.com/101world/AudioMass.git`
3. Commit the change
4. Push to master

---

## What Happens After Fork?

Once forked, I'll update `.gitmodules` to point to your fork:

```
[submodule "vendor/audiomass"]
    path = vendor/audiomass
    url = https://github.com/101world/AudioMass.git  ← Your fork
```

Then you can:
- ✅ Customize AudioMass code for 444Radio
- ✅ Make pull requests to original repo if you improve it
- ✅ Keep your version in sync with upstream
- ✅ Full control over the code

---

## Why Fork Instead of Just Using Submodule?

**Current situation**: Submodule points to `pkalogiros/AudioMass` (original)
- ❌ Can't push changes
- ❌ Can't customize for 444Radio
- ❌ Updates might break your app

**With fork**: Submodule points to `101world/AudioMass` (your fork)
- ✅ Full write access
- ✅ Customize as needed
- ✅ Control when to sync upstream changes
- ✅ Can contribute back via PR

---

## Next Steps

**Go fork it now**: https://github.com/pkalogiros/AudioMass → Click "Fork"

Then tell me "Done" and I'll update everything! 🚀
