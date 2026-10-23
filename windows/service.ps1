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
  & $node (Join-Path $Root 'app\server.mjs') --root $Root --no-open 2>> (Join-Path $Root 'service.log')
  if($LASTEXITCODE -ne 0){throw "Dịch vụ dừng với mã $LASTEXITCODE"}
} catch {Add-Content -LiteralPath (Join-Path $Root 'launcher.log') -Value $_.Exception.ToString();exit 1}