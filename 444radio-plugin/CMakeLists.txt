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

# ─── Patch JUCE: suppress WebView2 script-error dialogs ───
# Cracked/unusual DAW environments trigger JS errors that WebView2 shows as
# modal "Script Error" dialogs.  This patch adds
#   put_AreDefaultScriptDialogsEnabled(FALSE)
# in the WebView2 settings initialisation so the dialogs never appear.
set(_JUCE_WV2_SRC "${juce_SOURCE_DIR}/modules/juce_gui_extra/native/juce_WebBrowserComponent_windows.cpp")
if(EXISTS "${_JUCE_WV2_SRC}")
    file(READ "${_JUCE_WV2_SRC}" _WV2_CONTENTS)
    string(FIND "${_WV2_CONTENTS}" "put_AreDefaultScriptDialogsEnabled" _PATCH_POS)
    if(_PATCH_POS EQUAL -1)
        string(REPLACE
            "settings->put_IsBuiltInErrorPageEnabled (! preferences.getIsBuiltInErrorPageDisabled());"
            "settings->put_IsBuiltInErrorPageEnabled (! preferences.getIsBuiltInErrorPageDisabled());\n            settings->put_AreDefaultScriptDialogsEnabled (FALSE);"
            _WV2_PATCHED "${_WV2_CONTENTS}")
        file(WRITE "${_JUCE_WV2_SRC}" "${_WV2_PATCHED}")
        message(STATUS "444Radio: patched JUCE WebView2 to disable script error dialogs")
    else()
        message(STATUS "444Radio: JUCE WebView2 script-dialog patch already applied")
    endif()
endif()

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
    FORMATS                   VST3 AU
    PRODUCT_NAME              "444 Radio"
    BUNDLE_ID                 "co.in.444radio.plugin"
    VST3_CATEGORIES           "Fx" "Tools"
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

# ─── Copy WebView2Loader.dll next to VST3 binary ───
if(WIN32)
    set(WEBVIEW2_DLL "${CMAKE_CURRENT_SOURCE_DIR}/packages/Microsoft.Web.WebView2.1.0.2535.41/build/native/x64/WebView2Loader.dll")

    # VST3: copy DLL next to the VST3 binary inside the bundle
    add_custom_command(TARGET RadioPlugin_VST3 POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${WEBVIEW2_DLL}"
            "${CMAKE_CURRENT_BINARY_DIR}/RadioPlugin_artefacts/$<CONFIG>/VST3/444 Radio.vst3/Contents/x86_64-win/WebView2Loader.dll"
        COMMENT "Copying WebView2Loader.dll to VST3 bundle"
    )
endif()
