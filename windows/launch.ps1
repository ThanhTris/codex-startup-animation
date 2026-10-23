param([ValidateSet('launch','library')][string]$Mode='launch')
# Desktop PowerShell must use its own modules when launched from PowerShell 7 / Codex.
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath="$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:WINDIR\System32\WindowsPowerShell\v1.0\Modules"}
$ErrorActionPreference='Stop'
$root=Join-Path $env:USERPROFILE 'CodexWallpaper'
$app=Join-Path $root 'app'
$mutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperManager')
$locked=$false
function Read-Session {
  try {
    $session=Get-Content (Join-Path $root 'instance.json') -Raw | ConvertFrom-Json
    $uri=[uri]$session.url
    if($uri.Host -ne '127.0.0.1' -or $uri.Scheme -ne 'http' -or $uri.Query -notmatch '^\?token=[a-f0-9]{48}$'){return $null}
    $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($session.pid)"
    if(-not $proc -or $proc.CommandLine -notlike "*$(Join-Path $app 'server.mjs')*"){return $null}
    $health=Invoke-RestMethod -Uri ($uri.GetLeftPart([UriPartial]::Authority)+'/api/health'+$uri.Query) -TimeoutSec 2
    if($health.app -eq 'CodexWallpaper' -and $health.pid -eq $session.pid){return $session}
  } catch {}
  return $null
}
try {
  try {$locked=$mutex.WaitOne(15000)}catch [Threading.AbandonedMutexException]{$locked=$true}
  if(-not $locked){throw 'Công cụ đang khởi động. Hãy thử lại sau vài giây.'}
  if(Test-Path -LiteralPath (Join-Path $root 'integration.json')){
    $integration=Get-Content -LiteralPath (Join-Path $root 'integration.json') -Raw|ConvertFrom-Json
    if($integration.mode -eq 'overlay'){Start-ScheduledTask -TaskName 'CodexWallpaperOverlay'}
  }
  $session=Read-Session
  if(-not $session){
    $runtime=Get-Command node.exe -ErrorAction SilentlyContinue
    if($runtime){$node=$runtime.Source}else{
      $pkg=Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
      if(-not $pkg){throw 'Không tìm thấy Codex hoặc Node.js.'}
      $node=Join-Path $pkg.InstallLocation 'app\resources\cua_node\bin\node.exe'
    }
    if(-not (Test-Path -LiteralPath $node)){throw 'Không tìm thấy Node.js. Hãy cài Node.js 22 trở lên.'}
    $version=(& $node --version).Trim()
    if($version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22){throw 'Cần Node.js 22 trở lên.'}
    # The on-demand Windows task survives closing the Codex app or this launcher.
    Start-ScheduledTask -TaskName 'CodexWallpaperService'
    for($i=0;$i -lt 40;$i++){Start-Sleep -Milliseconds 250;$session=Read-Session;if($session){break}}
    if(-not $session){throw "Dịch vụ chưa sẵn sàng. Xem $root\launcher.log"}
  }
  if($Mode -eq 'launch'){
    $uri=[uri]$session.url
    Invoke-RestMethod -Method Post -Uri ($uri.GetLeftPart([UriPartial]::Authority)+'/api/launch-codex'+$uri.Query) -TimeoutSec 10 | Out-Null
    return
  }
  $edge=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
  if(Test-Path -LiteralPath $edge){Start-Process -FilePath $edge -ArgumentList ('--app="{0}"' -f $session.url)}
  else{Start-Process $session.url}
} catch {
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  Add-Content -LiteralPath (Join-Path $root 'launcher.log') -Value ((Get-Date -Format o)+' '+$_.Exception.Message)
  Add-Type -AssemblyName System.Windows.Forms
  [Windows.Forms.MessageBox]::Show($_.Exception.Message,'Codex Wallpaper') | Out-Null
  exit 1
} finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
