$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$temporaryBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot=[IO.Path]::GetFullPath((Join-Path $temporaryBase ('codex-overlay-test-'+[guid]::NewGuid())))
if(-not $testRoot.StartsWith($temporaryBase,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid test directory.'}
New-Item -ItemType Directory -Path $testRoot | Out-Null
$provider=New-Object Microsoft.CSharp.CSharpCodeProvider
try {
  $parameters=New-Object CodeDom.Compiler.CompilerParameters
  $parameters.GenerateExecutable=$true
  $parameters.OutputAssembly=Join-Path $testRoot 'OverlayTests.exe'
  $parameters.CompilerOptions='/target:exe /platform:x64 /main:CodexWallpaper.OverlayTests'
  @('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Web.Extensions.dll')|ForEach-Object {$parameters.ReferencedAssemblies.Add($_)|Out-Null}
  $sources=[string[]]@((Join-Path $repo 'windows\Overlay.cs'),(Join-Path $PSScriptRoot 'windows-overlay.test.cs'))
  $result=$provider.CompileAssemblyFromFile($parameters,$sources)
  if($result.Errors.HasErrors){throw ($result.Errors|Out-String)}
  & $parameters.OutputAssembly $testRoot
  if($LASTEXITCODE -ne 0){throw 'Native overlay tests failed.'}
} finally {
  $provider.Dispose()
  Remove-Item -LiteralPath $testRoot -Recurse -Force
}
