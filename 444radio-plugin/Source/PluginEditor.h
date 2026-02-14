#pragma once

#include <juce_gui_extra/juce_gui_extra.h>
#include <juce_audio_utils/juce_audio_utils.h>
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
class RadioPluginEditor final : public juce::AudioProcessorEditor,
                                public juce::DragAndDropContainer,
                                private juce::Timer
{
public:
    explicit RadioPluginEditor (RadioPluginProcessor&);
    ~RadioPluginEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    // Timer: deferred WebView creation (WebView2 crashes if created too early)
    void timerCallback() override;
    bool createWebView();   // returns true on success

    // ─── Drag bar: user drags generated file into DAW timeline ───
    class DragBar final : public juce::Component
    {
    public:
        explicit DragBar();
        void paint (juce::Graphics&) override;
        void mouseDown (const juce::MouseEvent&) override;
        void mouseDrag (const juce::MouseEvent&) override;
        void setFile (const juce::String& name, const juce::File& file);
        void clearFile();
        bool hasFile() const { return fileReady; }

    private:
        juce::String fileName;
        juce::File   audioFile;
        bool         fileReady = false;
    };

    // ─── Background audio downloader ───
    class AudioDownloader final : public juce::Thread
    {
    public:
        AudioDownloader (const juce::String& url,
                         const juce::File& dest,
                         std::function<void (bool, juce::File)> cb);
        ~AudioDownloader() override;
        void run() override;

    private:
        juce::String audioUrl;
        juce::File   destination;
        std::function<void (bool, juce::File)> callback;
    };

    // ─── Bridge message handling ───
    void handleWebMessage (const juce::String& jsonData);
    void downloadAudio (const juce::String& url, const juce::String& title);

    // Allow the file-local BridgeWebView to call handleWebMessage
    friend class BridgeWebView;

    // ─── Members ───
    RadioPluginProcessor&                      processorRef;
    std::unique_ptr<juce::WebBrowserComponent> webView;
    std::unique_ptr<DragBar>                   dragBar;
    std::unique_ptr<AudioDownloader>           downloader;
    juce::File                                 downloadDir;
    bool                                       webViewCreated = false;
    int                                        webViewRetries = 0;
    static constexpr int kMaxWebViewRetries = 20;

    static constexpr int kWidth         = 480;
    static constexpr int kHeight        = 740;
    static constexpr int kDragBarHeight = 40;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RadioPluginEditor)
};
