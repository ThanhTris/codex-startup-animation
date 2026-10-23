$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath="$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:WINDIR\System32\WindowsPowerShell\v1.0\Modules"}
Add-Type -Path (Join-Path $PSScriptRoot '..\windows\Taskbar.cs')
Add-Type -AssemblyName System.Windows.Forms
$directory=Join-Path ([IO.Path]::GetTempPath()) ('codex-taskbar-test-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $directory|Out-Null
$form=New-Object Windows.Forms.Form
try {
  $path=Join-Path $directory 'test.lnk'
  $shell=New-Object -ComObject WScript.Shell
  $link=$shell.CreateShortcut($path)
  $exe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $arguments='-NoProfile -File "C:\A Folder\start.ps1"'
  $link.TargetPath=$exe;$link.Arguments=$arguments;$link.Save()
  [CodexWallpaperTaskbar]::SetShortcutId($path,'codex.wallpaper.test')
  $folder=(New-Object -ComObject Shell.Application).NameSpace($directory)
  $id=$folder.ParseName('test.lnk').ExtendedProperty('System.AppUserModel.ID')
  if($id -ne 'codex.wallpaper.test'){throw 'Shortcut application identity was not persisted.'}
  $saved=$shell.CreateShortcut($path)
  if($saved.TargetPath -ne $exe -or $saved.Arguments -ne $arguments){throw 'Setting AppUserModelID changed the launch command.'}
  $command='"'+$exe+'" '+$arguments
  [CodexWallpaperTaskbar]::SetWindow($form.Handle,'codex.wallpaper.test',$command,$exe+',0')
  if([CodexWallpaperTaskbar]::WindowCommand($form.Handle) -ne $command){throw 'Window relaunch command was not retained.'}
  if([CodexWallpaperTaskbar]::WindowAppId($form.Handle) -ne 'codex.wallpaper.test'){throw 'Window identity does not match the shortcut.'}
  Write-Output 'PASS: shortcut identity persisted; launch command preserved; window relaunch and identity match.'
  $entry=Join-Path $directory 'app\CodexWallpaper.exe'
  foreach($pin in @(@{name='legacy.lnk';arguments='';id='CodexWallpaper.Codex'},@{name='settings.lnk';arguments='--settings';id='CodexWallpaper.Settings'})){
    $pinPath=Join-Path $directory $pin.name
    $shortcut=$shell.CreateShortcut($pinPath);$shortcut.TargetPath=$entry;$shortcut.Arguments=$pin.arguments;$shortcut.Save()
    [CodexWallpaperTaskbar]::SetShortcutId($pinPath,$pin.id)
  }
  $official=Join-Path $directory 'official\ChatGPT.exe'
  & (Join-Path $PSScriptRoot '..\windows\restore-original-pins.ps1') -Root $directory -PackageExe $official -PinFolder $directory
  $legacy=$shell.CreateShortcut((Join-Path $directory 'legacy.lnk'))
  $settingsPin=$shell.CreateShortcut((Join-Path $directory 'settings.lnk'))
  if($legacy.TargetPath -ne $official){throw 'Legacy launcher pin was not restored to the original app.'}
  if($settingsPin.TargetPath -ne $entry -or $settingsPin.Arguments -ne '--settings'){throw 'Installer incorrectly changed a pinned wallpaper library.'}
  if($folder.ParseName('settings.lnk').ExtendedProperty('System.AppUserModel.ID') -ne 'CodexWallpaper.Settings'){throw 'Settings pin identity was changed.'}
  if($shell.CreateShortcut($path).TargetPath -ne $exe){throw 'An unrelated pin was changed.'}
  Write-Output 'PASS: migration repairs only legacy app pins and preserves pinned wallpaper settings and unrelated shortcuts.'
} finally {
  $form.Dispose()
  # Only test-created files; never touch user taskbar shortcuts here.
  $resolvedTest=[IO.Path]::GetFullPath($directory)
  $temporaryBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if(-not $resolvedTest.StartsWith($temporaryBase,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid test directory.'}
  Remove-Item -LiteralPath $resolvedTest -Recurse -Force
}
