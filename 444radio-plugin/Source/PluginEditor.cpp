#include "PluginEditor.h"

// The URL loaded inside the plugin WebView
static const juce::String kBasePluginUrl = "https://444radio.co.in/plugin";

//==============================================================================
//  WebView
//==============================================================================

RadioPluginEditor::PluginWebView::PluginWebView (RadioPluginEditor& owner)
    : editor (owner)
{
}

bool RadioPluginEditor::PluginWebView::pageAboutToLoad (const juce::String& url)
{
    // ── Bridge: intercept juce-bridge:// messages from the web page ──
    if (url.startsWith ("juce-bridge://"))
    {
        auto encoded = url.fromFirstOccurrenceOf ("juce-bridge://", false, false);
        auto json = juce::URL::removeEscapeChars (encoded);
        editor.handleWebMessage (json);
        return false; // cancel navigation — page stays intact
    }
    return true; // allow normal navigation
}

void RadioPluginEditor::PluginWebView::pageFinishedLoading (const juce::String& url)
{
    juce::ignoreUnused (url);
    DBG ("444 Radio: Page loaded — " + url);
}

//==============================================================================
//  Drag Bar
//==============================================================================

RadioPluginEditor::DragBar::DragBar (RadioPluginEditor& owner)
    : editor (owner)
{
    setMouseCursor (juce::MouseCursor::DraggingHandCursor);
}

void RadioPluginEditor::DragBar::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xFF0D0D1A));

    auto bounds = getLocalBounds().reduced (10, 4);

    if (fileReady)
    {
        // Purple pill with filename
        g.setColour (juce::Colour (0xFF7C3AED));
        g.fillRoundedRectangle (bounds.toFloat(), 8.0f);

        g.setColour (juce::Colours::white);
        g.setFont (juce::Font (13.0f).boldened());
        g.drawText (juce::CharPointer_UTF8 ("\xe2\x86\x95") // ↕ arrow
                    + juce::String ("  Drag to Ableton: ") + fileName,
                    bounds.reduced (10, 0),
                    juce::Justification::centredLeft);
    }
    else
    {
        // Empty state
        g.setColour (juce::Colour (0xFF1A1A2E));
        g.fillRoundedRectangle (bounds.toFloat(), 8.0f);

        g.setColour (juce::Colour (0xFF555570));
        g.setFont (juce::Font (12.0f));
        g.drawText ("Generate something to drag into your project",
                    bounds, juce::Justification::centred);
    }
}

void RadioPluginEditor::DragBar::mouseDown (const juce::MouseEvent&)
{
    // Intentionally empty — drag starts in mouseDrag
}

void RadioPluginEditor::DragBar::mouseDrag (const juce::MouseEvent& e)
{
    if (fileReady && audioFile.existsAsFile() && e.getDistanceFromDragStart() > 5)
    {
        // Initiate OS-level file drag → Ableton receives the audio file
        juce::DragAndDropContainer::performExternalDragDropOfFiles (
            { audioFile.getFullPathName() },
            false,   // don't move the file, copy it
            this);
    }
}

void RadioPluginEditor::DragBar::setFile (const juce::String& name, const juce::File& file)
{
    fileName = name;
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
    std::function<void (bool, juce::File)> onComplete)
    : juce::Thread ("444RadioDownloader"),
      audioUrl (url),
      destination (dest),
      callback (std::move (onComplete))
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

    auto stream = juce::URL (audioUrl).createInputStream (
        juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
            .withConnectionTimeoutMs (30000));

    bool success = false;

    if (stream != nullptr && ! threadShouldExit())
    {
        juce::FileOutputStream output (destination);

        if (output.openedOk())
        {
            char buffer[8192];

            while (! threadShouldExit())
            {
                auto bytesRead = stream->read (buffer, sizeof (buffer));
                if (bytesRead <= 0)
                    break;
                output.write (buffer, static_cast<size_t> (bytesRead));
            }

            output.flush();
            success = destination.getSize() > 0;
        }
    }

    // Capture values before calling async (this thread may be destroyed after)
    auto cb   = callback;
    auto dest = destination;
    auto ok   = success;

    juce::MessageManager::callAsync ([cb, ok, dest]()
    {
        if (cb)
            cb (ok, dest);
    });
}

//==============================================================================
//  Editor
//==============================================================================

RadioPluginEditor::RadioPluginEditor (RadioPluginProcessor& p)
    : AudioProcessorEditor (&p),
      processorRef (p)
{
    setSize (kWidth, kHeight);
    setResizable (false, false);

    // Downloads folder: ~/Documents/444Radio/Downloads
    downloadDir = juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                      .getChildFile ("444Radio")
                      .getChildFile ("Downloads");
    downloadDir.createDirectory();

    // Drag bar (bottom strip)
    dragBar = std::make_unique<DragBar> (*this);
    addAndMakeVisible (*dragBar);

    // WebView — loads the 444 Radio plugin page
    webView = std::make_unique<PluginWebView> (*this);
    addAndMakeVisible (*webView);

    // Build URL: pass ?host=juce so the page enables the native bridge.
    // If we have a saved token, pass it so auto-login works.
    juce::String url = kBasePluginUrl + "?host=juce";

    if (processorRef.pluginToken.isNotEmpty())
        url += "&token=" + juce::URL::addEscapeChars (processorRef.pluginToken, false);

    webView->goToURL (url);
}

RadioPluginEditor::~RadioPluginEditor()
{
    downloader.reset(); // stop any active download
}

void RadioPluginEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xFF0A0A0A));
}

void RadioPluginEditor::resized()
{
    auto area = getLocalBounds();
    dragBar->setBounds (area.removeFromBottom (kDragBarHeight));
    webView->setBounds (area);
}

//==============================================================================
//  Bridge message handler
//==============================================================================

void RadioPluginEditor::handleWebMessage (const juce::String& jsonData)
{
    DBG ("444 Radio bridge: " + jsonData);

    auto json = juce::JSON::parse (jsonData);

    if (! json.isObject())
        return;

    auto action = json["action"].toString();

    // ── Audio import (music, effects, loops, boost) ──
    if (action == "import_audio" || action == "import_loops")
    {
        auto url   = json["url"].toString();
        auto title = json["title"].toString();

        if (title.isEmpty())
            title = json["type"].toString();
        if (url.isNotEmpty())
            downloadAudio (url, title);
    }

    // ── Stem import (multiple files) ──
    else if (action == "import_stems")
    {
        auto stems = json["stems"];
        auto title = json["title"].toString();

        if (title.isEmpty())
            title = "stems";

        if (auto* obj = stems.getDynamicObject())
        {
            // Download each stem file
            for (auto& prop : obj->getProperties())
            {
                auto stemUrl = prop.value.toString();

                if (stemUrl.isNotEmpty())
                {
                    downloadAudio (stemUrl, title + "-" + prop.name.toString());
                    // Note: only the last stem will appear in the drag bar.
                    // All stems are saved to ~/Documents/444Radio/Downloads/
                }
            }
        }
    }

    // ── Cover art ──
    else if (action == "cover_art")
    {
        auto url = json["url"].toString();

        if (url.isNotEmpty())
            downloadAudio (url, "cover-art");
    }

    // ── Auth: persist token in DAW project state ──
    else if (action == "authenticated")
    {
        auto token = json["token"].toString();

        if (token.isNotEmpty())
            processorRef.pluginToken = token;

        DBG ("444 Radio: Authenticated — "
             + json["credits"].toString() + " credits");
    }
}

//==============================================================================
//  Audio download → drag bar
//==============================================================================

void RadioPluginEditor::downloadAudio (const juce::String& url, const juce::String& title)
{
    // Determine file extension from URL
    auto urlFileName = juce::URL (url).getFileName();
    auto ext = urlFileName.fromLastOccurrenceOf (".", true, false);

    if (ext.isEmpty() || ext.length() > 6)
        ext = ".wav";

    // Sanitize filename
    auto safeName = title.replaceCharacters ("\\/:*?\"<>|", "_________")
                         .trimCharactersAtEnd (" ._");

    if (safeName.isEmpty())
        safeName = "444radio-generation";

    auto destFile = downloadDir.getChildFile (safeName + ext);

    // Ensure unique filename
    int counter = 1;
    while (destFile.existsAsFile())
    {
        destFile = downloadDir.getChildFile (
            safeName + " (" + juce::String (counter++) + ")" + ext);
    }

    DBG ("444 Radio: Downloading " + url);
    DBG ("          → " + destFile.getFullPathName());

    // Cancel any in-progress download
    downloader.reset();

    // Start background download
    auto displayName = safeName;

    downloader = std::make_unique<AudioDownloader> (url, destFile,
        [this, displayName] (bool success, juce::File file)
        {
            if (success)
            {
                DBG ("444 Radio: Download complete — " + file.getFullPathName());
                dragBar->setFile (displayName, file);
            }
            else
            {
                DBG ("444 Radio: Download failed");
                dragBar->clearFile();
            }
        });
}
