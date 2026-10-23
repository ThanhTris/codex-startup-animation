param([Parameter(Mandatory=$true)][string]$Root)
# Desktop PowerShell must use its own modules when launched from PowerShell 7 / Codex.
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath="$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:WINDIR\System32\WindowsPowerShell\v1.0\Modules"}
$ErrorActionPreference='Stop'
$mutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperLaunch')
$locked=$false
function Set-State([string]$Status,[string]$Message){
  $json=@{status=$Status;message=$Message;updatedAt=(Get-Date -Format o)}|ConvertTo-Json
  $temp=Join-Path $Root ('launch-state-'+[guid]::NewGuid()+'.tmp')
  [IO.File]::WriteAllText($temp,$json,[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temp -Destination (Join-Path $Root 'launch-state.json') -Force
}
try {
  try {$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
  if(-not $locked){exit 0}
  $pkg=Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if(-not $pkg){throw 'Không tìm thấy bản Codex Microsoft Store.'}
  $directory=Join-Path $pkg.InstallLocation 'app'
  $exe=Join-Path $directory 'ChatGPT.exe'
  $sig=Get-AuthenticodeSignature -LiteralPath $exe
  if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'OpenAI'){throw 'Không xác minh được chữ ký Codex.'}
  $integration=Join-Path $Root 'integration.json'
  if((Test-Path -LiteralPath $integration) -and ((Get-Content -LiteralPath $integration -Raw|ConvertFrom-Json).mode -eq 'overlay')){
    Start-ScheduledTask -TaskName 'CodexWallpaperOverlay'
    # Shell activation uses the original packaged app and its original taskbar identity.
    Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('shell:AppsFolder\'+$pkg.PackageFamilyName+'!App')
    exit 0
  }
  function Get-CodexProcesses { @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object {$_.ExecutablePath -eq $exe}) }
  $existing=Get-CodexProcesses
  try {
    $saved=Get-Content (Join-Path $Root 'codex-session.json') -Raw | ConvertFrom-Json
    $agent=Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.agentPid)"
    if(($existing.ProcessId -contains $saved.pid) -and $agent.CommandLine -like "*$(Join-Path $Root 'app\agent.mjs')*"){
      Set-State 'running' 'Codex đã mở với bộ hình nền. Các thay đổi ảnh sẽ được nạp tự động.';exit 0
    }
  } catch {}
  if($existing.Count){Set-State 'waiting' 'Đã sẵn sàng. Lưu công việc rồi chọn Thoát hoàn toàn trong Codex (đóng cửa sổ có thể vẫn còn chạy nền). Công cụ sẽ tự mở lại Codex với hình nền.'}
  while((Get-CodexProcesses).Count){Start-Sleep -Seconds 1}
  Set-State 'starting' 'Đang mở Codex và kết nối hình nền…'
  $runtime=Get-Command node.exe -ErrorAction SilentlyContinue
  if($runtime){$node=$runtime.Source}else{$node=Join-Path $directory 'resources\cua_node\bin\node.exe'}
  $tcp=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
  $tcp.Start();$port=([Net.IPEndPoint]$tcp.LocalEndpoint).Port;$tcp.Stop()
  $codex=Start-Process -FilePath $exe -ArgumentList @('--remote-debugging-address=127.0.0.1',"--remote-debugging-port=$port") -WorkingDirectory $directory -PassThru
  $taskbarArguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -Root "{1}" -WatchPid {2} -RepairPins' -f (Join-Path $Root 'app\taskbar.ps1'),$Root,$codex.Id
  Start-Process -FilePath (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList $taskbarArguments -WindowStyle Hidden
  $agentArguments='"{0}" --pid {1} --port {2} --package "{3}" --root "{4}"' -f (Join-Path $Root 'app\agent.mjs'),$codex.Id,$port,$directory,$Root
  $agent=Start-Process -FilePath $node -ArgumentList $agentArguments -WindowStyle Hidden -WorkingDirectory (Join-Path $Root 'app') -PassThru
  [IO.File]::WriteAllText((Join-Path $Root 'codex-session.json'),(@{pid=$codex.Id;agentPid=$agent.Id;port=$port}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
} catch {Set-State 'error' $_.Exception.Message;Add-Content (Join-Path $Root 'launcher.log') $_.Exception.ToString();exit 1}
finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
