#include "PluginEditor.h"

// The URL loaded inside the plugin WebView
static const juce::String kPluginUrl = "https://444radio.co.in/plugin";

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
#endif
                  .withKeepPageLoadedWhenBrowserIsHidden()
          ),
          editor (owner)
    {
    }

    bool pageAboutToLoad (const juce::String& url) override
    {
        // Intercept juce-bridge:// messages from the web page
        if (url.startsWith ("juce-bridge://"))
        {
            auto encoded = url.fromFirstOccurrenceOf ("juce-bridge://", false, false);
            auto json    = juce::URL::removeEscapeChars (encoded);
            editor.handleWebMessage (json);
            return false;   // cancel navigation — page stays intact
        }

        // Allow the plugin page and its subpaths
        if (url.startsWith (kPluginUrl) || url.startsWith ("about:blank"))
            return true;

        // External links (library, explore, etc.) → open in system browser, don't navigate WebView
        if (url.startsWith ("http://") || url.startsWith ("https://"))
        {
            juce::URL (url).launchInDefaultBrowser();
            return false;   // cancel — keep plugin page loaded
        }

        return true;
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
    setResizable (false, false);

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
//  Timer → deferred WebView creation
//==============================================================================
void RadioPluginEditor::timerCallback()
{
    stopTimer();
    createWebView();
}

void RadioPluginEditor::createWebView()
{
    if (webViewCreated) return;
    webViewCreated = true;

    webView = std::make_unique<BridgeWebView> (*this);
    addAndMakeVisible (*webView);
    resized();   // lay out the new component

    // Build URL: ?host=juce so the page enables the native bridge
    juce::String url = kPluginUrl + "?host=juce";

    if (processorRef.pluginToken.isNotEmpty())
        url += "&token=" + juce::URL::addEscapeChars (processorRef.pluginToken, false);

    webView->goToURL (url);

    DBG ("444 Radio: WebView navigating to " + url);
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

        g.setColour (juce::Colour (0xFF888888));
        g.setFont (juce::Font (14.0f));
        g.drawText ("Loading...", getLocalBounds(), juce::Justification::centred);
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

    // ── Audio / loops import ──
    if (action == "import_audio" || action == "import_loops")
    {
        auto url   = json["url"].toString();
        auto title = json["title"].toString();
        if (title.isEmpty()) title = json["type"].toString();
        if (url.isNotEmpty()) downloadAudio (url, title);
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
void RadioPluginEditor::downloadAudio (const juce::String& url,
                                       const juce::String& title)
{
    auto urlFileName = juce::URL (url).getFileName();
    auto ext = urlFileName.fromLastOccurrenceOf (".", true, false);
    if (ext.isEmpty() || ext.length() > 6) ext = ".wav";

    auto safeName = title.replaceCharacters ("\\/:*?\"<>|", "_________")
                         .trimCharactersAtEnd (" ._");
    if (safeName.isEmpty()) safeName = "444radio-generation";

    auto destFile = downloadDir.getChildFile (safeName + ext);

    int counter = 1;
    while (destFile.existsAsFile())
        destFile = downloadDir.getChildFile (
            safeName + " (" + juce::String (counter++) + ")" + ext);

    DBG ("444 Radio: downloading " + url);
    DBG ("           -> " + destFile.getFullPathName());

    downloader.reset();   // cancel any in-progress download

    auto displayName = safeName;
    downloader = std::make_unique<AudioDownloader> (url, destFile,
        [this, displayName] (bool success, juce::File file)
        {
            if (success)
            {
                DBG ("444 Radio: download complete — " + file.getFullPathName());
                if (dragBar != nullptr)
                    dragBar->setFile (displayName, file);
            }
            else
            {
                DBG ("444 Radio: download failed");
                if (dragBar != nullptr)
                    dragBar->clearFile();
            }
        });
}
