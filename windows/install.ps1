# Desktop PowerShell must use its own modules when launched from PowerShell 7 / Codex.
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath="$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:WINDIR\System32\WindowsPowerShell\v1.0\Modules"}
$ErrorActionPreference='Stop'
$source=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=Join-Path $env:USERPROFILE 'CodexWallpaper'
$app=Join-Path $root 'app'
$images=Join-Path $root 'images'
$programs=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$legacy=Join-Path $programs 'Codex Wallpaper'
New-Item -ItemType Directory -Path $app,$images,(Join-Path $root 'gifs') -Force | Out-Null
$oldRoot=Join-Path $env:LOCALAPPDATA 'CodexWallpaper'
if(Test-Path -LiteralPath (Join-Path $oldRoot 'images')){Get-ChildItem -LiteralPath (Join-Path $oldRoot 'images') -File -Force | ForEach-Object { $target=Join-Path $images $_.Name; if(-not (Test-Path -LiteralPath $target)){Copy-Item -LiteralPath $_.FullName -Destination $target} }}
if(-not (Test-Path -LiteralPath (Join-Path $root 'settings.json')) -and (Test-Path -LiteralPath (Join-Path $oldRoot 'settings.json'))){Copy-Item -LiteralPath (Join-Path $oldRoot 'settings.json') -Destination $root}
$oldLibraryTask=Get-ScheduledTask -TaskName 'CodexWallpaperService' -ErrorAction SilentlyContinue
$restartLibrary=$oldLibraryTask -and [string]$oldLibraryTask.State -in @('Running','Queued')
if($restartLibrary){
  Stop-ScheduledTask -TaskName 'CodexWallpaperService'
  for($attempt=0;$attempt -lt 50;$attempt++){
    $oldLibraryTask=Get-ScheduledTask -TaskName 'CodexWallpaperService'
    if([string]$oldLibraryTask.State -notin @('Running','Queued')){break}
    Start-Sleep -Milliseconds 100
  }
  if([string]$oldLibraryTask.State -in @('Running','Queued')){throw 'Dịch vụ thư viện cũ chưa dừng.'}
}
$overlayExe=Join-Path $app 'CodexWallpaperOverlay.exe'
$oldOverlayTask=Get-ScheduledTask -TaskName 'CodexWallpaperOverlay' -ErrorAction SilentlyContinue
if($oldOverlayTask){Stop-ScheduledTask -TaskName 'CodexWallpaperOverlay'}
foreach($overlayProcess in @(Get-Process -Name 'CodexWallpaperOverlay' -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $overlayExe})){
  Stop-Process -Id $overlayProcess.Id -ErrorAction SilentlyContinue
  if(-not $overlayProcess.WaitForExit(5000)){throw 'Bộ nạp ảnh cũ chưa dừng.'}
}
if($oldOverlayTask){
  for($attempt=0;$attempt -lt 50;$attempt++){
    $oldOverlayTask=Get-ScheduledTask -TaskName 'CodexWallpaperOverlay'
    if([string]$oldOverlayTask.State -notin @('Running','Queued')){break}
    Start-Sleep -Milliseconds 100
  }
  if([string]$oldOverlayTask.State -in @('Running','Queued')){throw 'Tác vụ bộ nạp cũ chưa dừng. Chạy lại bộ cài sau vài giây.'}
}
Get-ChildItem -LiteralPath $source -File | Where-Object {$_.Name -ne 'install.ps1'} | Copy-Item -Destination $app -Force
$pkg=Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
$iconExe=if($pkg){Join-Path $pkg.InstallLocation 'app\ChatGPT.exe'}else{''}
& (Join-Path $app 'build-launcher.ps1') -AppRoot $app -IconExe $iconExe
& (Join-Path $app 'build-overlay.ps1') -AppRoot $app
$powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launch=Join-Path $app 'launch.ps1'
$taskArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -Root "{1}"' -f (Join-Path $app 'service.ps1'),$root
$action=New-ScheduledTaskAction -Execute $powershell -Argument $taskArgs -WorkingDirectory $app
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'CodexWallpaperService' -Action $action -Principal $principal -Settings $settings -Description 'Dịch vụ hình nền Codex; chỉ khởi động khi mở Codex Wallpaper.' -Force | Out-Null
$overlayAction=New-ScheduledTaskAction -Execute $overlayExe -Argument ('--root "'+$root+'"') -WorkingDirectory $app
$overlayTrigger=New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$overlayTrigger.Delay='PT2S'
$overlaySettings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'CodexWallpaperOverlay' -Action $overlayAction -Trigger $overlayTrigger -Principal $principal -Settings $overlaySettings -Description 'Tự hiện ảnh đã lưu khi mở ứng dụng Codex gốc.' -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $root 'integration.json'),'{"mode":"overlay"}',[Text.UTF8Encoding]::new($false))
$shell=New-Object -ComObject WScript.Shell
if(Test-Path -LiteralPath $legacy){
  Get-ChildItem -LiteralPath $legacy -Filter '*.lnk' -File | ForEach-Object {
    $old=$shell.CreateShortcut($_.FullName)
    if($old.TargetPath -eq $powershell -and ($old.Arguments.Contains($launch) -or $old.Arguments.Contains((Join-Path $oldRoot 'app\launch.ps1')))){Remove-Item -LiteralPath $_.FullName -Force}
  }
  if(-not (Get-ChildItem -LiteralPath $legacy -Force)){Remove-Item -LiteralPath $legacy}
}
$shortcut=Join-Path $programs 'Codex Wallpaper.lnk'
$link=$shell.CreateShortcut($shortcut)
$link.TargetPath=Join-Path $app 'CodexWallpaper.exe'
$link.Arguments='--settings'
$link.WorkingDirectory=$app
$link.Description='Đổi ảnh và độ mờ; mở ứng dụng Codex gốc hằng ngày như bình thường'
$link.IconLocation=(Join-Path $app 'CodexWallpaper.exe')+',0'
$link.Save()
Add-Type -Path (Join-Path $app 'Taskbar.cs')
if($iconExe){& (Join-Path $app 'restore-original-pins.ps1') -Root $root -PackageExe $iconExe}
[CodexWallpaperTaskbar]::SetShortcutId($shortcut,'CodexWallpaper.Settings')
$libraryLink=$shell.CreateShortcut((Join-Path $root 'Wallpaper Settings.lnk'))
$libraryLink.TargetPath=Join-Path $app 'CodexWallpaper.exe';$libraryLink.Arguments='--settings';$libraryLink.WorkingDirectory=$app;$libraryLink.IconLocation=$link.IconLocation;$libraryLink.Save()
$desktopAlias=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex With Wallpaper.lnk'
if(Test-Path -LiteralPath $desktopAlias){
  $desktopLink=$shell.CreateShortcut($desktopAlias)
  if($desktopLink.TargetPath -eq (Join-Path $app 'CodexWallpaper.exe')){
    $desktopLink.Arguments='--settings'
    $desktopLink.Description='Chọn ảnh và chỉnh độ mờ cho Codex'
    $desktopLink.Save()
    [CodexWallpaperTaskbar]::SetShortcutId($desktopAlias,'CodexWallpaper.Settings')
  }
}
$overlayStart=[DateTime]::UtcNow
Start-ScheduledTask -TaskName 'CodexWallpaperOverlay'
$overlayReady=$false
for($attempt=0;$attempt -lt 40;$attempt++){
  Start-Sleep -Milliseconds 200
  try{
    $overlayState=Get-Content -LiteralPath (Join-Path $root 'overlay-state.json') -Raw|ConvertFrom-Json
    $overlayProcess=Get-Process -Id $overlayState.pid -ErrorAction Stop
    if($overlayProcess.Path -eq $overlayExe -and [DateTimeOffset]::Parse($overlayState.updatedAt).UtcDateTime -ge $overlayStart.AddSeconds(-1)){$overlayReady=$true;break}
  }catch{}
}
if(-not $overlayReady){throw "Bộ nạp chưa sẵn sàng. Xem $root\overlay.log"}
if($restartLibrary){Start-ScheduledTask -TaskName 'CodexWallpaperService'}
Write-Output "Đã cài một app: $shortcut"
Write-Output "Thư viện ảnh: $images"
