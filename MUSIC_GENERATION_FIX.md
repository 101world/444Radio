# 🎵 Music Generation Troubleshooting

## Error: "At least one reference song, voice or instrumental is required"

### What This Error Means
The MiniMax Music-01 API requires **both** `prompt` and `lyrics` to be provided. This error appears when:
1. Lyrics field is empty or too short
2. Lyrics don't have proper formatting
3. API receives malformed data

---

## ✅ How to Fix

### 1. **Use the Example Lyrics Button**
In the Music Generation modal, click the **"📝 Use Example"** button next to the lyrics field. This will pre-fill proper lyrics with structure tags.

### 2. **Manual Entry Requirements**

**Minimum Requirements**:
- ✅ Prompt: 10-300 characters
- ✅ Lyrics: 10-600 characters (REQUIRED)
- ✅ Use structure tags: `[intro]` `[verse]` `[chorus]` `[bridge]` `[outro]`

**Example Lyrics**:
```
[intro]
Synthwave vibes in the night

[verse]
Neon lights guide my way
Through the city after dark
Electronic dreams at play

[chorus]
Feel the rhythm, feel the beat
Dancing through the digital heat
Lost in sound, lost in time
This moment feels sublime

[outro]
Fading into the night
```

### 3. **Structure Tags**
Always use structure tags to help the AI understand song sections:

- `[intro]` - Opening instrumental/vocals
- `[verse]` - Story/narrative sections
- `[chorus]` - Main hook/repeated section
- `[bridge]` - Contrasting section
- `[outro]` - Ending/fade out

---

## 📋 Checklist Before Generating

- [ ] Prompt is filled (10-300 chars)
- [ ] Lyrics are filled (10-600 chars)
- [ ] Lyrics use structure tags `[intro]` `[verse]` `[chorus]` etc
- [ ] You have at least 2 credits
- [ ] All parameters selected (bitrate, sample rate, format)

---

## 🎯 Valid Example Request

**Prompt**:
```
Upbeat electronic dance track with neon synthwave vibes
```

**Lyrics**:
```
[intro]
Electronic dreams

[verse]
Dancing through the night
Under neon lights
Feel the rhythm flow
Let the music go

[chorus]
Synthwave paradise
Lost in paradise
Feel the energy
Set your spirit free

[outro]
Fading to the stars
```

**Parameters**:
- Sample Rate: 44100 Hz (CD Quality)
- Bitrate: 256 kbps
- Format: MP3

---

## 🔍 What Gets Sent to API

The API receives:
```json
{
  "prompt": "your prompt here",
  "lyrics": "your lyrics with \\n line breaks",
  "bitrate": 256000,
  "sample_rate": 44100,
  "audio_format": "mp3"
}
```

All fields are **required** for successful generation.

---

## 🚀 After Fix

Once you provide proper lyrics with structure tags, the generation should work:

1. Click **"📝 Use Example"** button
2. Or write your own lyrics with `[intro]` `[verse]` `[chorus]` tags
3. Verify lyrics length is 10-600 characters
4. Click **"Generate Music"**
5. Wait 30-60 seconds
6. Download your track!

---

## 📊 Common Mistakes

❌ **Empty lyrics**
```
Lyrics: ""
Result: Error
```

❌ **Too short**
```
Lyrics: "Hi"
Result: Error (min 10 chars)
```

❌ **No structure tags**
```
Lyrics: "Just plain text without any tags"
Result: May work but lower quality
```

✅ **Correct Format**
```
Lyrics: "[intro]\nMusic starts\n\n[verse]\nProper lyrics here"
Result: Success!
```

---

## 🆘 Still Having Issues?

1. **Check browser console** (F12) for detailed error logs
2. **Verify your credits** (music costs 2 credits)
3. **Try the example lyrics** first to confirm API is working
4. **Check Replicate API status**: https://replicate.com/status
5. **Verify API token** is valid in `.env.local`

---

## ✅ Deployed Fixes

Latest deployment includes:
- ✅ Better lyrics validation (trim whitespace)
- ✅ Enhanced error messages
- ✅ "Use Example" button for quick testing
- ✅ Console logging for debugging
- ✅ Proper formatting of lyrics before API call

**Version**: Deployed on commit `455e1f8`
**Status**: Live on https://444radio.co.in
