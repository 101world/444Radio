#include "PluginEditor.h"

// The URL loaded inside the plugin WebView
static const juce::String kPluginUrl  = "https://www.444radio.co.in/plugin";
static const juce::String kSiteOrigin = "https://444radio.co.in";

//==============================================================================
//  Helper: writable WebView2 data folder under %LOCALAPPDATA%\444Radio\WebView2
//  This avoids permission issues when loaded inside DAWs whose exe lives in
//  restricted directories (e.g. Ableton in C:\ProgramData, Premiere Pro, etc.)
//==============================================================================
#if JUCE_WINDOWS
#include <windows.h>

//==============================================================================
//  Helper: find the directory containing THIS plugin binary (DLL/VST3).
//  We can't rely on currentExecutableFile (that gives us the host DAW's exe).
//  Instead we ask Windows which module our own code lives in.
//==============================================================================
static juce::File getPluginBinaryDir()
{
    HMODULE hModule = nullptr;
    GetModuleHandleExW (
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        reinterpret_cast<LPCWSTR> (&getPluginBinaryDir),
        &hModule);

    if (hModule != nullptr)
    {
        wchar_t path[MAX_PATH];
        if (GetModuleFileNameW (hModule, path, MAX_PATH) > 0)
            return juce::File (juce::String (path)).getParentDirectory();
    }

    return {};
}

static juce::File getWebView2DataFolder()
{
    // Each host DAW gets its own WebView2 data subfolder to prevent lock conflicts
    // e.g.  %APPDATA%/444Radio/WebView2_AbletonLive/
    //       %APPDATA%/444Radio/WebView2_PremierePro/
    //       %APPDATA%/444Radio/WebView2_Standalone/
    auto hostExe = juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                       .getFileNameWithoutExtension()
                       .replaceCharacters (" .-()[]{}", "________")
                       .trim();
    if (hostExe.isEmpty()) hostExe = "Unknown";

    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
               .getChildFile ("444Radio")
               .getChildFile ("WebView2_" + hostExe);
}

//==============================================================================
//  Check whether the WebView2 runtime is installed.
//  We probe by trying to create a WebView2 environment with the loader DLL.
//  If the runtime is missing, JUCE will silently fall back to IE/MSHTML which
//  cannot run modern JavaScript.
//==============================================================================
static bool isWebView2RuntimeAvailable()
{
    auto opts = juce::WebBrowserComponent::Options()
                    .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
                    .withWinWebView2Options (
                        juce::WebBrowserComponent::Options::WinWebView2()
                            .withDLLLocation (getPluginBinaryDir().getChildFile ("WebView2Loader.dll"))
                            .withUserDataFolder (getWebView2DataFolder()));

    return juce::WebBrowserComponent::areOptionsSupported (opts);
}
#endif

//==============================================================================
//  BridgeWebView — file-local subclass that intercepts juce-bridge:// URLs
//==============================================================================
class BridgeWebView final : public juce::WebBrowserComponent
{
public:
    explicit BridgeWebView (RadioPluginEditor& owner)
        : juce::WebBrowserComponent (
              juce::WebBrowserComponent::Options()
#if JUCE_WINDOWS
                  .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
                  .withWinWebView2Options (
                      juce::WebBrowserComponent::Options::WinWebView2()
                          .withDLLLocation (getPluginBinaryDir().getChildFile ("WebView2Loader.dll"))
                          .withUserDataFolder (getWebView2DataFolder())
                  )
#endif
                  .withKeepPageLoadedWhenBrowserIsHidden()
          ),
          editor (owner)
    {
    }

    bool pageAboutToLoad (const juce::String& url) override
    {
        DBG ("444 Radio: pageAboutToLoad — " + url);

        // Intercept juce-bridge:// messages from the web page
        if (url.startsWith ("juce-bridge://"))
        {
            auto encoded = url.fromFirstOccurrenceOf ("juce-bridge://", false, false);
            auto json    = juce::URL::removeEscapeChars (encoded);
            editor.handleWebMessage (json);
            return false;   // cancel navigation — page stays intact
        }

        // Allow ALL http/https navigation inside the WebView.
        // The plugin page handles its own auth and routing.
        // External links are opened via the juce-bridge from JS, not via
        // browser navigation.
        return true;
    }

    void newWindowAttemptingToLoad (const juce::String& url) override
    {
        DBG ("444 Radio: newWindowAttemptingToLoad — " + url);

        // New-window requests (target="_blank", window.open, etc.)
        // Same-origin: navigate the current WebView there instead
        if (url.startsWith (kSiteOrigin) || url.startsWith ("about:blank"))
        {
            goToURL (url);
            return;
        }

        // Clerk auth domains — allow in WebView
        if (url.contains ("clerk."))
        {
            goToURL (url);
            return;
        }

        // Truly external URLs → system browser
        if (url.startsWith ("http://") || url.startsWith ("https://"))
            juce::URL (url).launchInDefaultBrowser();
    }

    void pageFinishedLoading (const juce::String& url) override
    {
        juce::ignoreUnused (url);
        DBG ("444 Radio: page loaded — " + url);
    }

private:
    RadioPluginEditor& editor;
};

//==============================================================================
//  Drag Bar
//==============================================================================
RadioPluginEditor::DragBar::DragBar() {}

void RadioPluginEditor::DragBar::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xFF0D0D1A));
    auto bounds = getLocalBounds().reduced (10, 4);

    if (fileReady)
    {
        g.setColour (juce::Colour (0xFF7C3AED));
        g.fillRoundedRectangle (bounds.toFloat(), 8.0f);
        g.setColour (juce::Colours::white);
        g.setFont (juce::Font (13.0f).boldened());

        auto label = juce::String ("Drag to DAW: ") + fileName;
        g.drawText (label, bounds.reduced (10, 0), juce::Justification::centredLeft);
    }
    else
    {
        g.setColour (juce::Colour (0xFF1A1A2E));
        g.fillRoundedRectangle (bounds.toFloat(), 8.0f);
        g.setColour (juce::Colour (0xFF555570));
        g.setFont (juce::Font (12.0f));
        g.drawText ("Generate something to drag into your project",
                    bounds, juce::Justification::centred);
    }
}

void RadioPluginEditor::DragBar::mouseDown (const juce::MouseEvent&) {}

void RadioPluginEditor::DragBar::mouseDrag (const juce::MouseEvent& e)
{
    if (fileReady && audioFile.existsAsFile() && e.getDistanceFromDragStart() > 5)
    {
        juce::DragAndDropContainer::performExternalDragDropOfFiles (
            { audioFile.getFullPathName() }, false, this);
    }
}

void RadioPluginEditor::DragBar::setFile (const juce::String& name,
                                          const juce::File& file)
{
    fileName  = name;
    audioFile = file;
    fileReady = true;
    repaint();
}

void RadioPluginEditor::DragBar::clearFile()
{
    fileReady = false;
    fileName.clear();
    audioFile = juce::File();
    repaint();
}

//==============================================================================
//  Audio Downloader (background thread)
//==============================================================================
RadioPluginEditor::AudioDownloader::AudioDownloader (
    const juce::String& url,
    const juce::File& dest,
    std::function<void (bool, juce::File)> cb)
    : juce::Thread ("444RadioDL"),
      audioUrl (url),
      destination (dest),
      callback (std::move (cb))
{
    startThread();
}

RadioPluginEditor::AudioDownloader::~AudioDownloader()
{
    stopThread (15000);
}

void RadioPluginEditor::AudioDownloader::run()
{
    destination.getParentDirectory().createDirectory();

    auto stream = juce::URL (audioUrl)
        .createInputStream (
            juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
                .withConnectionTimeoutMs (30000));

    bool ok = false;

    if (stream != nullptr && ! threadShouldExit())
    {
        juce::FileOutputStream out (destination);

        if (out.openedOk())
        {
            char buf[8192];
            while (! threadShouldExit())
            {
                auto n = stream->read (buf, sizeof (buf));
                if (n <= 0) break;
                out.write (buf, static_cast<size_t> (n));
            }
            out.flush();
            ok = destination.getSize() > 0;
        }
    }

    auto cb2  = callback;
    auto dest = destination;
    auto res  = ok;

    juce::MessageManager::callAsync ([cb2, res, dest]()
    {
        if (cb2) cb2 (res, dest);
    });
}

//==============================================================================
//  Editor — constructor / destructor
//==============================================================================
RadioPluginEditor::RadioPluginEditor (RadioPluginProcessor& p)
    : juce::AudioProcessorEditor (&p),
      processorRef (p)
{
    setSize (kWidth, kHeight);
    setResizable (true, true);
    setResizeLimits (kMinWidth, kMinHeight, kMaxWidth, kMaxHeight);

    // Downloads folder
    downloadDir = juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                      .getChildFile ("444Radio")
                      .getChildFile ("Downloads");
    downloadDir.createDirectory();

    // Drag bar at the bottom
    dragBar = std::make_unique<DragBar>();
    addAndMakeVisible (*dragBar);

    // Defer WebView creation by ~200 ms.
    // On Windows the WebView2 runtime can crash if instantiated before
    // the host window is fully realised.
    startTimer (200);
}

RadioPluginEditor::~RadioPluginEditor()
{
    stopTimer();
    downloader.reset();
    webView.reset();       // destroy WebView before the editor window goes away
}

//==============================================================================
//  Timer → deferred WebView creation (with retry on failure)
//==============================================================================
void RadioPluginEditor::timerCallback()
{
    stopTimer();

    if (webViewCreated)
        return;

    // Wait until the editor is actually showing on screen
    if (! isShowing())
    {
        if (webViewRetries < kMaxWebViewRetries)
        {
            ++webViewRetries;
            startTimer (500);
        }
        else
        {
            DBG ("444 Radio: gave up waiting for editor to show");
        }
        return;
    }

    if (createWebView())
        return;   // success

    // If WebView2 prompt is showing, don't retry — user needs to install runtime
    if (showingWebView2Prompt)
        return;

    // Retry with back-off (500 ms intervals, up to kMaxWebViewRetries)
    if (webViewRetries < kMaxWebViewRetries)
    {
        ++webViewRetries;
        DBG ("444 Radio: WebView creation failed — retry "
             + juce::String (webViewRetries) + "/" + juce::String (kMaxWebViewRetries));
        startTimer (500);
    }
    else
    {
        DBG ("444 Radio: WebView creation failed after all retries");
    }
}

bool RadioPluginEditor::createWebView()
{
    if (webViewCreated)
        return true;

#if JUCE_WINDOWS
    // ─── Check for WebView2 runtime BEFORE creating the browser. ───
    // Without it, JUCE silently falls back to IE/MSHTML which cannot parse
    // modern JS and floods the user with "Script Error" dialogs.
    if (! isWebView2RuntimeAvailable())
    {
        DBG ("444 Radio: WebView2 runtime not found — showing install prompt");
        showingWebView2Prompt = true;
        repaint();

        // Ask the user to install it
        auto result = juce::AlertWindow::showOkCancelBox (
            juce::MessageBoxIconType::WarningIcon,
            "444 Radio — WebView2 Required",
            "Your system is missing the Microsoft WebView2 Runtime, which 444 Radio "
            "needs to display its interface.\n\n"
            "Click OK to open the download page. After installing, restart your DAW.",
            "OK — Open Download",
            "Cancel",
            this);

        if (result)
            juce::URL ("https://go.microsoft.com/fwlink/p/?LinkId=2124703").launchInDefaultBrowser();

        return false;
    }
#endif

    try
    {
        webView = std::make_unique<BridgeWebView> (*this);
    }
    catch (const std::exception& e)
    {
        DBG ("444 Radio: BridgeWebView constructor threw — " + juce::String (e.what()));
        webView.reset();
        return false;
    }
    catch (...)
    {
        DBG ("444 Radio: BridgeWebView constructor threw unknown exception");
        webView.reset();
        return false;
    }

    webViewCreated = true;   // only set AFTER successful creation
    addAndMakeVisible (*webView);
    resized();

    // Build URL: ?host=juce so the page enables the native bridge
    juce::String url = kPluginUrl + "?host=juce";

    if (processorRef.pluginToken.isNotEmpty())
        url += "&token=" + juce::URL::addEscapeChars (processorRef.pluginToken, false);

    webView->goToURL (url);

    DBG ("444 Radio: WebView navigating to " + url);
    return true;
}

//==============================================================================
//  Paint / resize
//==============================================================================
void RadioPluginEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xFF0A0A0A));

    // Show a loading label until the WebView appears
    if (webView == nullptr)
    {
        g.setColour (juce::Colour (0xFF7C3AED));
        g.setFont (juce::Font (22.0f).boldened());
        g.drawText ("444 Radio", getLocalBounds().reduced (0, 60),
                    juce::Justification::centredTop);

        if (showingWebView2Prompt)
        {
            // WebView2 is missing — show an explanatory message
            auto area = getLocalBounds().reduced (30, 0);

            g.setColour (juce::Colour (0xFFFF4444));
            g.setFont (juce::Font (16.0f).boldened());
            g.drawText ("WebView2 Runtime Not Found",
                        area.withY (120).withHeight (30),
                        juce::Justification::centredTop);

            g.setColour (juce::Colour (0xFFCCCCCC));
            g.setFont (juce::Font (13.0f));
            g.drawFittedText (
                "444 Radio requires the Microsoft WebView2 Runtime to work.\n\n"
                "Please install it from:\n"
                "https://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n"
                "After installing, restart your DAW.",
                area.withY (160).withHeight (200),
                juce::Justification::centredTop, 8);
        }
        else
        {
            g.setColour (juce::Colour (0xFF888888));
            g.setFont (juce::Font (14.0f));
            g.drawText ("Loading...", getLocalBounds(), juce::Justification::centred);
        }
    }
}

void RadioPluginEditor::resized()
{
    auto area = getLocalBounds();

    if (dragBar != nullptr)
        dragBar->setBounds (area.removeFromBottom (kDragBarHeight));

    if (webView != nullptr)
        webView->setBounds (area);
}

//==============================================================================
//  Bridge message handler  (called by BridgeWebView::pageAboutToLoad)
//==============================================================================
void RadioPluginEditor::handleWebMessage (const juce::String& jsonData)
{
    DBG ("444 Radio bridge: " + jsonData);

    auto json = juce::JSON::parse (jsonData);
    if (! json.isObject()) return;

    auto action = json["action"].toString();

    // Fallback: some JS code uses "type" instead of "action"
    if (action.isEmpty())
        action = json["type"].toString();

    // ── Audio / loops import ──
    if (action == "import_audio" || action == "import_loops")
    {
        auto url    = json["url"].toString();
        auto title  = json["title"].toString();
        auto format = json["format"].toString();
        if (title.isEmpty()) title = json["type"].toString();
        if (format.isEmpty()) format = "wav";
        if (url.isNotEmpty()) downloadAudio (url, title, format);
    }

    // ── Stems import (multiple files) ──
    else if (action == "import_stems")
    {
        auto stems = json["stems"];
        auto title = json["title"].toString();
        if (title.isEmpty()) title = "stems";

        if (auto* obj = stems.getDynamicObject())
        {
            for (auto& prop : obj->getProperties())
            {
                auto stemUrl = prop.value.toString();
                if (stemUrl.isNotEmpty())
                    downloadAudio (stemUrl, title + "-" + prop.name.toString());
            }
        }
    }

    // ── Cover art ──
    else if (action == "cover_art")
    {
        auto url = json["url"].toString();
        if (url.isNotEmpty()) downloadAudio (url, "cover-art");
    }

    // ── Auth: persist token in DAW project state ──
    else if (action == "authenticated")
    {
        auto token = json["token"].toString();
        if (token.isNotEmpty()) processorRef.pluginToken = token;
        DBG ("444 Radio: authenticated — " + json["credits"].toString() + " credits");
    }
}

//==============================================================================
//  Audio download → drag bar
//==============================================================================
//==============================================================================
//  Convert any audio file to WAV using JUCE AudioFormatManager
//==============================================================================
bool RadioPluginEditor::convertToWav (const juce::File& source,
                                      const juce::File& dest)
{
    juce::AudioFormatManager fmtMgr;
    fmtMgr.registerBasicFormats();
    fmtMgr.registerFormat (new juce::MP3AudioFormat(), false);

    std::unique_ptr<juce::AudioFormatReader> reader (
        fmtMgr.createReaderFor (source));

    if (reader == nullptr)
    {
        DBG ("444 Radio: could not create reader for " + source.getFullPathName());
        return false;
    }

    juce::WavAudioFormat wavFormat;
    dest.getParentDirectory().createDirectory();
    std::unique_ptr<juce::FileOutputStream> outStream (
        dest.createOutputStream());

    if (outStream == nullptr)
    {
        DBG ("444 Radio: could not open output for " + dest.getFullPathName());
        return false;
    }

    std::unique_ptr<juce::AudioFormatWriter> writer (
        wavFormat.createWriterFor (outStream.get(),
                                   reader->sampleRate,
                                   reader->numChannels,
                                   16, // 16-bit PCM
                                   {}, 0));

    if (writer == nullptr)
    {
        DBG ("444 Radio: could not create WAV writer");
        return false;
    }

    outStream.release();  // writer now owns the stream

    bool ok = writer->writeFromAudioReader (*reader, 0, reader->lengthInSamples);
    writer.reset();  // flush & close

    if (ok)
        DBG ("444 Radio: converted to WAV — " + dest.getFullPathName());
    else
        DBG ("444 Radio: WAV conversion failed");

    return ok;
}

void RadioPluginEditor::downloadAudio (const juce::String& url,
                                       const juce::String& title,
                                       const juce::String& format)
{
    // Determine desired extension based on format
    auto desiredExt = format.equalsIgnoreCase ("mp3") ? juce::String (".mp3")
                                                      : juce::String (".wav");

    auto safeName = title.replaceCharacters ("\\/:*?\"<>|", "_________")
                         .trimCharactersAtEnd (" ._");
    if (safeName.isEmpty()) safeName = "444radio-generation";

    // Temp file for raw download (we may need to convert)
    auto tempFile = downloadDir.getChildFile (".444radio-temp-download");
    auto destFile = downloadDir.getChildFile (safeName + desiredExt);

    int counter = 1;
    while (destFile.existsAsFile())
        destFile = downloadDir.getChildFile (
            safeName + " (" + juce::String (counter++) + ")" + desiredExt);

    DBG ("444 Radio: downloading " + url);
    DBG ("           format=" + format + "  -> " + destFile.getFullPathName());

    downloader.reset();   // cancel any in-progress download

    auto displayName = safeName;
    auto wantWav = format.equalsIgnoreCase ("wav");

    downloader = std::make_unique<AudioDownloader> (url, tempFile,
        [this, displayName, destFile, tempFile, wantWav] (bool success, juce::File downloaded)
        {
            if (! success)
            {
                DBG ("444 Radio: download failed");
                tempFile.deleteFile();
                if (dragBar != nullptr)
                    dragBar->clearFile();
                return;
            }

            DBG ("444 Radio: download complete — " + downloaded.getFullPathName()
                 + " (" + juce::String (downloaded.getSize() / 1024) + " KB)");

            // Check if the downloaded data is already WAV
            bool isAlreadyWav = false;
            {
                juce::FileInputStream peek (downloaded);
                if (peek.openedOk() && peek.getTotalLength() >= 12)
                {
                    char header[4];
                    peek.read (header, 4);
                    isAlreadyWav = (memcmp (header, "RIFF", 4) == 0);
                }
            }

            juce::File finalFile = destFile;

            if (wantWav && ! isAlreadyWav)
            {
                // Convert MP3/OGG/whatever → WAV
                DBG ("444 Radio: converting to WAV...");
                if (convertToWav (downloaded, destFile))
                {
                    downloaded.deleteFile();  // remove temp
                    finalFile = destFile;
                }
                else
                {
                    DBG ("444 Radio: WAV conversion failed — keeping original");
                    downloaded.moveFileTo (destFile);
                    finalFile = destFile;
                }
            }
            else
            {
                // Already the right format — just rename
                downloaded.moveFileTo (destFile);
                finalFile = destFile;
            }

            if (dragBar != nullptr)
                dragBar->setFile (displayName, finalFile);
        });
}
