#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

//==============================================================================
// 444 Radio Plugin — Editor
//
// Layout:  [  WebView (loads 444radio.co.in/plugin)  ]
//          [  Drag Bar (drag generated audio to DAW)  ]
//
// Bridge:  JS → C++ via juce-bridge:// URL scheme interception
//          C++ downloads audio → enables OS-level file drag to Ableton
//==============================================================================
class RadioPluginEditor : public juce::AudioProcessorEditor,
                          public juce::DragAndDropContainer
{
public:
    RadioPluginEditor (RadioPluginProcessor&);
    ~RadioPluginEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    // ─── WebView: loads the 444 Radio plugin page ───
    class PluginWebView : public juce::WebBrowserComponent
    {
    public:
        explicit PluginWebView (RadioPluginEditor& owner);
        bool pageAboutToLoad (const juce::String& url) override;
        void pageFinishedLoading (const juce::String& url) override;
    private:
        RadioPluginEditor& editor;
    };

    // ─── Drag bar: user drags generated file to Ableton timeline ───
    class DragBar : public juce::Component
    {
    public:
        explicit DragBar (RadioPluginEditor& owner);
        void paint (juce::Graphics&) override;
        void mouseDown (const juce::MouseEvent&) override;
        void mouseDrag (const juce::MouseEvent&) override;
        void setFile (const juce::String& name, const juce::File& file);
        void clearFile();
        bool hasFile() const { return fileReady; }
    private:
        RadioPluginEditor& editor;
        juce::String fileName;
        juce::File audioFile;
        bool fileReady = false;
    };

    // ─── Background audio downloader ───
    class AudioDownloader : public juce::Thread
    {
    public:
        AudioDownloader (const juce::String& url,
                         const juce::File& dest,
                         std::function<void (bool, juce::File)> onComplete);
        ~AudioDownloader() override;
        void run() override;
    private:
        juce::String audioUrl;
        juce::File destination;
        std::function<void (bool, juce::File)> callback;
    };

    // ─── Message handling ───
    void handleWebMessage (const juce::String& jsonData);
    void downloadAudio (const juce::String& url, const juce::String& title);

    RadioPluginProcessor& processorRef;
    std::unique_ptr<PluginWebView> webView;
    std::unique_ptr<DragBar> dragBar;
    std::unique_ptr<AudioDownloader> downloader;
    juce::File downloadDir;

    static constexpr int kWidth        = 480;
    static constexpr int kHeight       = 740;
    static constexpr int kDragBarHeight = 40;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RadioPluginEditor)
};
