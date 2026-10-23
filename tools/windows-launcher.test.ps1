$ErrorActionPreference='Stop'
$directory=Join-Path ([IO.Path]::GetTempPath()) ('codex launcher test '+[guid]::NewGuid())
$app=Join-Path $directory 'app'
New-Item -ItemType Directory -Path $app|Out-Null
try {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\windows\Launcher.cs') -Destination $app
  & (Join-Path $PSScriptRoot '..\windows\build-launcher.ps1') -AppRoot $app
  $fake=@'
param([string]$Mode)
$root=Split-Path -Parent $PSScriptRoot
$settings=Get-Content (Join-Path $root 'settings.json') -Raw|ConvertFrom-Json
[IO.File]::WriteAllText((Join-Path $root ('result-'+$Mode+'.txt')),$settings.name)
'@
  [IO.File]::WriteAllText((Join-Path $app 'launch.ps1'),$fake)
  foreach($name in @('first.jpg','new image.jpg')){
    [IO.File]::WriteAllText((Join-Path $directory 'settings.json'),(@{name=$name}|ConvertTo-Json))
    Start-Process -FilePath (Join-Path $app 'CodexWallpaper.exe') -Wait
    $observed=''
    for($i=0;$i -lt 50;$i++){
      $marker=Join-Path $directory 'result-launch.txt'
      if(Test-Path -LiteralPath $marker){$observed=[IO.File]::ReadAllText($marker)}
      if($observed -eq $name){break};Start-Sleep -Milliseconds 100
    }
    if($observed -ne $name){throw 'Launching the executable again did not load the new saved configuration.'}
  }
  Start-Process -FilePath (Join-Path $app 'CodexWallpaper.exe') -ArgumentList '--settings' -Wait
  for($i=0;$i -lt 50 -and -not(Test-Path -LiteralPath (Join-Path $directory 'result-library.txt'));$i++){Start-Sleep -Milliseconds 100}
  if([IO.File]::ReadAllText((Join-Path $directory 'result-library.txt')) -ne 'new image.jpg'){throw 'Settings mode did not use the same data directory.'}
  Write-Output 'PASS: native launcher reopens with fresh settings; settings mode shares the same root; paths with spaces work.'
} finally {
  # This unique directory was created by this test; no user data or taskbar pins are accessed.
  foreach($folder in @($app,$directory)){
    Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue|ForEach-Object{Remove-Item -LiteralPath $_.FullName}
    Remove-Item -LiteralPath $folder -ErrorAction SilentlyContinue
  }
}
