#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

//==============================================================================
// 444 Radio Plugin — Audio Processor
//
// This is a UTILITY plugin: audio passes through unchanged.
// The plugin's purpose is to host the WebView UI for AI generation
// and provide drag-drop of generated audio into Ableton.
//==============================================================================
class RadioPluginProcessor : public juce::AudioProcessor
{
public:
    RadioPluginProcessor();
    ~RadioPluginProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi()  const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // Persisted plugin token (saved/restored with DAW project)
    juce::String pluginToken;

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RadioPluginProcessor)
};
