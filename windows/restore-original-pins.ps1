param([Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$PackageExe,[string]$PinFolder=(Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'))
$ErrorActionPreference='Stop'
if(-not ('CodexWallpaperTaskbar' -as [type])){Add-Type -Path (Join-Path $Root 'app\Taskbar.cs')}
$entry=Join-Path $Root 'app\CodexWallpaper.exe'
$shell=New-Object -ComObject WScript.Shell
foreach($file in @(Get-ChildItem -LiteralPath $pinFolder -Filter '*.lnk' -File -ErrorAction SilentlyContinue)){
  $link=$shell.CreateShortcut($file.FullName)
  # Undo only the launcher replacement made by our previous installer.
  if($link.TargetPath -ne $entry -or $link.Arguments.Trim() -ne ''){continue}
  $backup=Join-Path $Root ('backups\'+$file.BaseName+'-original.lnk')
  $before=Join-Path $Root ('backups\'+$file.BaseName+'-before-overlay.lnk')
  New-Item -ItemType Directory -Path (Split-Path -Parent $before) -Force | Out-Null
  if(-not (Test-Path -LiteralPath $before)){Copy-Item -LiteralPath $file.FullName -Destination $before}
  if(Test-Path -LiteralPath $backup){
    $original=$shell.CreateShortcut($backup)
    if($original.TargetPath -like '*\WindowsApps\OpenAI.Codex_*\app\ChatGPT.exe'){
      Copy-Item -LiteralPath $backup -Destination $file.FullName -Force
      $link=$shell.CreateShortcut($file.FullName)
    }
  }
  $link.TargetPath=$PackageExe;$link.Arguments='';$link.WorkingDirectory=Split-Path -Parent $PackageExe;$link.IconLocation=$PackageExe+',0';$link.Save()
  [CodexWallpaperTaskbar]::SetShortcutId($file.FullName,'com.openai.codex')
  Write-Output ('Restored original app target: '+$file.Name)
}
foreach($proc in @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $PackageExe})){
  foreach($handle in [CodexWallpaperTaskbar]::Windows($proc.Id)){
    if([CodexWallpaperTaskbar]::WindowAppId($handle) -eq 'CodexWallpaper.Codex'){
      $command='"'+(Join-Path $env:WINDIR 'explorer.exe')+'" shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App'
      [CodexWallpaperTaskbar]::SetWindow($handle,'com.openai.codex',$command,$PackageExe+',0')
    }
  }
}
