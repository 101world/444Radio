cmake_minimum_required(VERSION 3.22)
project(444RadioPlugin VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ─── Fetch JUCE automatically ───
include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        7.0.12
    GIT_SHALLOW    ON
)
FetchContent_MakeAvailable(JUCE)

# ─── Plugin target ───
juce_add_plugin(RadioPlugin
    COMPANY_NAME              "444Radio"
    COMPANY_WEBSITE           "https://444radio.co.in"
    PLUGIN_MANUFACTURER_CODE  F44R
    PLUGIN_CODE               F44P
    IS_SYNTH                  FALSE
    NEEDS_MIDI_INPUT          FALSE
    NEEDS_MIDI_OUTPUT         FALSE
    IS_MIDI_EFFECT            FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD   FALSE
    FORMATS                   VST3 AU Standalone
    PRODUCT_NAME              "444 Radio"
    BUNDLE_ID                 "co.in.444radio.plugin"
    VST3_CATEGORIES           "Tools"
)

target_sources(RadioPlugin
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

target_compile_definitions(RadioPlugin
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=1
        JUCE_MODAL_LOOPS_PERMITTED=1
)

# ─── WebView2 SDK (needed for modern browser on Windows) ───
if(WIN32)
    set(WEBVIEW2_DIR "${CMAKE_CURRENT_SOURCE_DIR}/packages/Microsoft.Web.WebView2.1.0.2535.41/build/native")
    target_include_directories(RadioPlugin PRIVATE "${WEBVIEW2_DIR}/include")
endif()

target_link_libraries(RadioPlugin
    PRIVATE
        juce::juce_audio_utils
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
