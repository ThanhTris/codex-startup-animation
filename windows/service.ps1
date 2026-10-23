param([Parameter(Mandatory=$true)][string]$Root)
# Desktop PowerShell must use its own modules when launched from PowerShell 7 / Codex.
if($PSVersionTable.PSEdition -eq 'Desktop'){$env:PSModulePath="$PSHOME\Modules;$env:ProgramFiles\WindowsPowerShell\Modules;$env:WINDIR\System32\WindowsPowerShell\v1.0\Modules"}
$ErrorActionPreference='Stop'
try {
  $runtime=Get-Command node.exe -ErrorAction SilentlyContinue
  if($runtime){$node=$runtime.Source}else{
    $pkg=Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
    $node=Join-Path $pkg.InstallLocation 'app\resources\cua_node\bin\node.exe'
  }
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$node
  $info.Arguments='"{0}" --root "{1}" --no-open' -f (Join-Path $Root 'app\server.mjs'),$Root.TrimEnd('\')
  $info.WorkingDirectory=Join-Path $Root 'app'
  $info.UseShellExecute=$false
  $info.CreateNoWindow=$true
  $info.RedirectStandardOutput=$true
  $info.RedirectStandardError=$true
  $process=New-Object Diagnostics.Process
  $process.StartInfo=$info
  $log=[IO.File]::Open((Join-Path $Root 'service.log'),[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite)
  try {
    if(-not $process.Start()){throw 'Không khởi động được dịch vụ thư viện.'}
    # Drain both pipes while the server runs; no console is allocated for Node.js.
    $output=$process.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)
    $errors=$process.StandardError.BaseStream.CopyToAsync($log)
    $process.WaitForExit()
    $output.GetAwaiter().GetResult();$errors.GetAwaiter().GetResult()
    if($process.ExitCode -ne 0){throw "Dịch vụ dừng với mã $($process.ExitCode)"}
  } finally {$process.Dispose();$log.Dispose()}
} catch {Add-Content -LiteralPath (Join-Path $Root 'launcher.log') -Value $_.Exception.ToString();exit 1}
