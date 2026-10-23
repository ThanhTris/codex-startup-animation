param([Parameter(Mandatory=$true)][string]$Root,[int]$WatchPid=0,[switch]$RepairPins)
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath="$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:WINDIR\System32\WindowsPowerShell\v1.0\Modules"}
$ErrorActionPreference='Stop'
try {
  Add-Type -Path (Join-Path $Root 'app\Taskbar.cs')
  $pkg=Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if(-not $pkg){throw 'Không tìm thấy Codex.'}
  $exe=Join-Path $pkg.InstallLocation 'app\ChatGPT.exe'
  $appId='CodexWallpaper.Codex'
  $powershell=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $entry=Join-Path $Root 'app\CodexWallpaper.exe'
  if(-not (Test-Path -LiteralPath $entry)){throw 'Thiếu CodexWallpaper.exe. Chạy lại bộ cài.'}
  $command='"{0}"' -f $entry
  if($RepairPins){
    $pinFolder=Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
    $shell=New-Object -ComObject WScript.Shell
    $namespace=(New-Object -ComObject Shell.Application).NameSpace($pinFolder)
    foreach($file in @(Get-ChildItem -LiteralPath $pinFolder -Filter '*.lnk' -ErrorAction SilentlyContinue)){
      $link=$shell.CreateShortcut($file.FullName)
      $id=$namespace.ParseName($file.Name).ExtendedProperty('System.AppUserModel.ID')
      $isCodex=($id -in @('com.openai.codex',$appId) -and ($link.TargetPath -eq $exe -or $link.TargetPath -like '*\OpenAI.Codex_*\app\ChatGPT.exe'))
      $isOurs=($link.TargetPath -eq $entry -or ($link.TargetPath -eq $powershell -and $link.Arguments.Contains((Join-Path $Root 'app\start-codex.ps1'))))
      if(-not ($isCodex -or $isOurs)){continue}
      if($isCodex){
        $backup=Join-Path $Root 'backups';New-Item -ItemType Directory -Force -Path $backup|Out-Null
        $saved=Join-Path $backup ($file.BaseName+'-original.lnk')
        if(-not(Test-Path -LiteralPath $saved)){Copy-Item -LiteralPath $file.FullName -Destination $saved}
      }
      $link.TargetPath=$entry;$link.Arguments='';$link.WorkingDirectory=(Join-Path $Root 'app');$link.IconLocation=$entry+',0';$link.Save()
      [CodexWallpaperTaskbar]::SetShortcutId($file.FullName,$appId)
      Write-Output ('Đã sửa icon ghim: '+$file.Name)
    }
  }
  do {
    $processes=@(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object {$_.ExecutablePath -eq $exe -and $_.CommandLine -notmatch '--type='})
    foreach($proc in $processes){
      if($WatchPid -and $proc.ProcessId -ne $WatchPid){continue}
      foreach($handle in [CodexWallpaperTaskbar]::Windows($proc.ProcessId)){
        [CodexWallpaperTaskbar]::SetWindow($handle,$appId,$command,$entry+',0')
      }
    }
    if(-not $WatchPid){break}
    if(-not ($processes.ProcessId -contains $WatchPid)){break}
    Start-Sleep -Seconds 3
  } while($true)
} catch {Add-Content -LiteralPath (Join-Path $Root 'taskbar.log') -Value ((Get-Date -Format o)+' '+$_.Exception.ToString());throw}
