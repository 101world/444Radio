#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
RadioPluginProcessor::RadioPluginProcessor()
    : AudioProcessor (BusesProperties()
          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
          .withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
}

RadioPluginProcessor::~RadioPluginProcessor() {}

void RadioPluginProcessor::prepareToPlay (double, int) {}
void RadioPluginProcessor::releaseResources() {}

void RadioPluginProcessor::processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&)
{
    // Pass-through — this is a utility plugin, not an audio effect.
    // Audio flows in and out unchanged.
}

juce::AudioProcessorEditor* RadioPluginProcessor::createEditor()
{
    return new RadioPluginEditor (*this);
}

//==============================================================================
// State: persist the plugin token so user doesn't re-enter it each session
//==============================================================================
void RadioPluginProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto xml = std::make_unique<juce::XmlElement> ("Radio444State");
    xml->setAttribute ("token", pluginToken);
    copyXmlToBinary (*xml, destData);
}

void RadioPluginProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto xml = getXmlFromBinary (data, sizeInBytes);
    if (xml != nullptr && xml->hasTagName ("Radio444State"))
        pluginToken = xml->getStringAttribute ("token");
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new RadioPluginProcessor();
}
