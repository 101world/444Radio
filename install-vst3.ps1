$dest = 'C:\Program Files\Common Files\VST3\444 Radio.vst3'
Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$dest\Contents\Resources" | Out-Null
New-Item -ItemType Directory -Force "$dest\Contents\x86_64-win" | Out-Null
$src = 'C:\444Radio\444radio-plugin\build\RadioPlugin_artefacts\Release\VST3\444 Radio.vst3\Contents'
Copy-Item "$src\Resources\moduleinfo.json" "$dest\Contents\Resources\moduleinfo.json" -Force
Copy-Item "$src\x86_64-win\444 Radio.vst3" "$dest\Contents\x86_64-win\444 Radio.vst3" -Force
Copy-Item "$src\x86_64-win\WebView2Loader.dll" "$dest\Contents\x86_64-win\WebView2Loader.dll" -Force
Write-Host 'Done!'
