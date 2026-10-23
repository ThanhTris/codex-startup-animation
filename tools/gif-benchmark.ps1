param([Parameter(Mandatory=$true)][string]$PythonPath,[ValidateRange(2,30)][int]$Seconds=6,[ValidateRange(1,3)][int]$Rounds=2,[ValidateSet('HighQualityBicubic','Bilinear')][string]$Interpolation='HighQualityBicubic',[string]$FixtureRoot)
$ErrorActionPreference='Stop'
$root=Join-Path $env:USERPROFILE ('CodexWallpaper\research\gif-benchmark-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root|Out-Null
if(-not $FixtureRoot){
  $FixtureRoot=$root
  & $PythonPath (Join-Path $PSScriptRoot 'gif-fixtures.py') $FixtureRoot
  if($LASTEXITCODE -ne 0){throw 'Fixture generation failed.'}
}
$provider=New-Object Microsoft.CSharp.CSharpCodeProvider
try {
  $parameters=New-Object CodeDom.Compiler.CompilerParameters
  $parameters.GenerateExecutable=$true;$parameters.OutputAssembly=Join-Path $root 'GifBenchmark.exe'
  $parameters.CompilerOptions='/target:exe /platform:x64 /optimize'
  @('System.dll','System.Core.dll','System.Drawing.dll','System.Web.Extensions.dll')|ForEach-Object {$parameters.ReferencedAssemblies.Add($_)|Out-Null}
  $compiled=$provider.CompileAssemblyFromFile($parameters,(Join-Path $PSScriptRoot 'gif-benchmark.cs'))
  if($compiled.Errors.HasErrors){throw ($compiled.Errors|Out-String)}
}finally{$provider.Dispose()}
$cases=@(
  @{name='static-1080p';file='static-1080p.png';fps=0},
  @{name='gif-720p-15';file='synthetic-720p.gif';fps=15},
  @{name='gif-1080p-15';file='synthetic-1080p.gif';fps=15},
  @{name='gif-1080p-30';file='synthetic-1080p.gif';fps=30},
  @{name='gif-1080p-paused';file='synthetic-1080p.gif';fps=0}
)
$results=@()
if($Interpolation -eq 'Bilinear'){$cases=@($cases|Where-Object {$_.fps -gt 0})}
for($round=1;$round -le $Rounds;$round++){
  foreach($case in $cases){
    $line=& $parameters.OutputAssembly (Join-Path $FixtureRoot $case.file) $case.fps $Seconds $Interpolation
    if($LASTEXITCODE -ne 0){throw ('Benchmark failed: '+$case.name)}
    $row=$line|ConvertFrom-Json;$row|Add-Member NoteProperty case $case.name;$row|Add-Member NoteProperty round $round
    $results+=$row
    Write-Output ($row|ConvertTo-Json -Compress)
  }
}
$report=@{measuredAt=[DateTime]::UtcNow.ToString('o');interpolation=$Interpolation;cpu=(Get-CimInstance Win32_Processor|Select-Object Name,NumberOfCores,NumberOfLogicalProcessors);physicalMemoryBytes=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory;fixtureRoot=$FixtureRoot;fixtures=(Get-Content -LiteralPath (Join-Path $FixtureRoot 'fixtures.json') -Raw|ConvertFrom-Json);results=$results;limitations=@('Synthetic 24-frame inputs, not a user GIF.','Offscreen CPU/GDI+ full-resolution drawing; DWM/GPU composition and power usage excluded.','Process CPU normalized over all logical processors; RAM is benchmark process total, not whole Codex.','Short runs under current system load; not a long-term memory or battery test.')}
$report|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $root 'results.json') -Encoding UTF8
Write-Output ('REPORT='+$root)
