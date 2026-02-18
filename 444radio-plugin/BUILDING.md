# Building the 444 Radio Ableton Plugin

plugin?host=juce:3  [444] JS error: Uncaught Error: useGenerationQueue must be used within GenerationQueueProvider https://www.444radio.co.in/_next/static/chunks/0a601be277a9eaba.js?dpl=dpl_5p6xZqP9JiZq55WhSCZ1Y636Gnj7 1
window.onerror @ plugin?host=juce:3
3 plugin built with [JUCE 7](https://juce.com/) that loads the 444 Radio generation UI inside Ableton Live and lets you drag generated audio directly into your project timeline.

---

## Prerequisites

### Windows
- **Visual Studio 2022** (Community is free) with "Desktop development with C++" workload
- **CMake 3.22+** — [cmake.org/download](https://cmake.org/download/) or `winget install cmake`
- **Git** — for JUCE auto-download
- **WebView2 Runtime** — pre-installed on Windows 10 21H1+ and Windows 11

### macOS
- **Xcode 14+** with command line tools (`xcode-select --install`)
- **CMake 3.22+** — `brew install cmake`
- **Git**

---

## Build Steps

### 1. Generate build files

```bash
cd 444radio-plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
```

First run downloads JUCE (~100 MB) automatically via `FetchContent`. This takes a few minutes.

### 2. Compile

```bash
cmake --build build --config Release
```

Build takes 2–5 minutes depending on your machine.

### 3. Find the plugin

After building, the `.vst3` is automatically copied to your system VST3 folder:

| OS | Location |
|---|---|
| Windows | `C:\Program Files\Common Files\VST3\444 Radio.vst3` |
| macOS | `~/Library/Audio/Plug-Ins/VST3/444 Radio.vst3` |

A **Standalone** app is also built for testing without a DAW:

| OS | Location |
|---|---|
| Windows | `build\RadioPlugin_artefacts\Release\Standalone\444 Radio.exe` |
| macOS | `build/RadioPlugin_artefacts/Release/Standalone/444 Radio.app` |

### 4. Load in Ableton

1. Open Ableton Live
2. Go to **Preferences → Plug-ins** → enable VST3 scanning for the system folder
3. Click **Rescan** if needed
4. In Ableton's browser, find **444 Radio** under Plug-ins → VST3
5. Drag it onto any audio track

---

## How It Works

### First use
1. Open the 444 Radio plugin in Ableton
2. Paste your **Plugin Token** (get one from [444radio.co.in/settings](https://444radio.co.in/settings) → Plugin tab)
3. Click **Connect**

The token is saved in your Ableton project — you won't need to re-enter it.

### Generating
1. Pick a generation type (Music, Effects, Loops, Stems, Image, Boost)
2. Fill in the prompt and settings
3. Click **Generate**
4. When complete, the **drag bar** at the bottom lights up purple
5. **Click and drag** from the purple bar into any Ableton track

### Where files are saved
All downloaded audio is saved to:
```
~/Documents/444Radio/Downloads/
```
You can also drag files from this folder into Ableton manually.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Ableton Live (Host DAW)                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  444 Radio VST3 Plugin            │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  WebView (WebView2/WebKit)  │  │  │
│  │  │                             │  │  │
│  │  │  Loads:                     │  │  │
│  │  │  444radio.co.in/plugin      │  │  │
│  │  │  ?host=juce&token=xxx       │  │  │
│  │  │                             │  │  │
│  │  │  JS → C++ bridge via        │  │  │
│  │  │  juce-bridge:// URL scheme  │  │  │
│  │  └──────────────┬──────────────┘  │  │
│  │                 │                  │  │
│  │  ┌──────────────▼──────────────┐  │  │
│  │  │  Drag Bar                   │  │  │
│  │  │  ↕ Drag to Ableton: track  │──┼──┼── OS file drag
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Audio Track ◄── dropped .wav/.mp3      │
└─────────────────────────────────────────┘
```

### JS → C++ Bridge
The web page (`/plugin?host=juce`) detects it's inside JUCE and sends messages via:
```js
window.location.href = 'juce-bridge://' + encodeURIComponent(jsonPayload)
```
JUCE's `pageAboutToLoad()` intercepts this, cancels the navigation (page stays intact), and parses the JSON payload.

### Audio Import Flow
1. Web UI sends `import_audio` message with the R2 CDN URL
2. C++ downloads the file to `~/Documents/444Radio/Downloads/`
3. Drag bar shows the filename with a purple indicator
4. User drags from the bar → JUCE calls `performExternalDragDropOfFiles` → Ableton receives the file

### Token Persistence
- Token entered in WebView → saved in `localStorage` + sent to C++ via bridge
- C++ saves token in processor state → persisted with Ableton project (.als file)
- On next open → C++ passes token in URL param → WebView auto-logs in

---

## Development

### Debug build
```bash
cmake -B build-debug -DCMAKE_BUILD_TYPE=Debug
cmake --build build-debug --config Debug
```

### Testing without Ableton
Run the **Standalone** build — it opens the plugin as a regular window.

### Logs
Debug messages print to:
- **Windows**: Visual Studio Output window, or DebugView (Sysinternals)
- **macOS**: Console.app → filter by process name
- All bridge messages are prefixed with `444 Radio:`

### Modifying the web UI
The plugin loads `https://444radio.co.in/plugin` — changes to `app/plugin/page.tsx` in the Next.js app are reflected immediately (no plugin rebuild needed).

---

## JUCE Licensing

This plugin uses JUCE under the **Personal** license (free, revenue < $50k/year). The JUCE splash screen is shown on first load.

For commercial distribution without the splash screen:
- **Indie**: $40/month (revenue < $500k/year)
- **Pro**: $130/month

See [juce.com/get-juce](https://juce.com/get-juce) for details.

---

## Upgrading to JUCE 8

JUCE 8 has improved WebView support with native function registration (no URL scheme needed). To upgrade:

1. Change `GIT_TAG 7.0.12` to `8.0.1` in `CMakeLists.txt`
2. Replace `pageAboutToLoad` bridge with `Options::withNativeFunction()`:
   ```cpp
   auto options = juce::WebBrowserComponent::Options()
       .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
       .withNativeIntegrationEnabled()
       .withNativeFunction("pluginBridge", [this](auto& args, auto complete) {
           handleWebMessage(args[0].toString());
           complete(juce::var("ok"));
       });
   ```
3. Update JS to use `window.__juce__.backend.emitByName("pluginBridge", payload)`

The web page already checks for `__juce__.postMessage` as a first priority, so JUCE 8 native bridge will work automatically once available.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Plugin doesn't appear in Ableton | Rescan VST3 in Preferences → Plug-ins |
| WebView shows blank white | Check internet connection; WebView2 runtime must be installed (Windows) |
| "Invalid token" error | Generate a fresh token at 444radio.co.in/settings → Plugin tab |
| Drag to Ableton doesn't work | Make sure you drag from the **purple bar** at the bottom, not the web page |
| Build fails: "JUCE not found" | Ensure Git is installed and internet is available (JUCE auto-downloads) |
| macOS: "damaged and can't be opened" | Right-click → Open, or: `xattr -cr "444 Radio.vst3"` |
