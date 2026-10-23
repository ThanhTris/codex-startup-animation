param([Parameter(Mandatory=$true)][string]$AppRoot)
$ErrorActionPreference='Stop'
$temporary=Join-Path $AppRoot ('overlay-build-'+[guid]::NewGuid()+'.exe')
$provider=New-Object Microsoft.CSharp.CSharpCodeProvider
$parameters=New-Object CodeDom.Compiler.CompilerParameters
$parameters.GenerateExecutable=$true
$parameters.OutputAssembly=$temporary
$parameters.CompilerOptions='/target:winexe /optimize /platform:x64'
@('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Web.Extensions.dll') | ForEach-Object {$parameters.ReferencedAssemblies.Add($_)|Out-Null}
try {
  $result=$provider.CompileAssemblyFromFile($parameters,(Join-Path $AppRoot 'Overlay.cs'))
  if($result.Errors.HasErrors){throw ($result.Errors|Out-String)}
  Move-Item -LiteralPath $temporary -Destination (Join-Path $AppRoot 'CodexWallpaperOverlay.exe') -Force
} finally {$provider.Dispose();if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -Force}}
