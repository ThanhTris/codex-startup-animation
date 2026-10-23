param([Parameter(Mandatory=$true)][string]$AppRoot,[string]$IconExe)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$compilerOptions='/optimize'
if($IconExe -and (Test-Path -LiteralPath $IconExe)){
  $icon=[Drawing.Icon]::ExtractAssociatedIcon($IconExe)
  if($icon){
    $iconPath=Join-Path $AppRoot 'CodexWallpaper.ico'
    $stream=[IO.File]::Create($iconPath)
    try{$icon.Save($stream)}finally{$stream.Dispose();$icon.Dispose()}
    $compilerOptions+=' /win32icon:"'+$iconPath+'"'
  }
}
$output=Join-Path $AppRoot 'CodexWallpaper.exe'
$temporary=Join-Path $AppRoot ('launcher-build-'+[guid]::NewGuid()+'.exe')
$provider=New-Object Microsoft.CSharp.CSharpCodeProvider
$parameters=New-Object CodeDom.Compiler.CompilerParameters
$parameters.GenerateExecutable=$true;$parameters.GenerateInMemory=$false
$parameters.OutputAssembly=$temporary;$parameters.CompilerOptions='/target:winexe '+$compilerOptions
$parameters.ReferencedAssemblies.Add('System.dll')|Out-Null
$parameters.ReferencedAssemblies.Add('System.Windows.Forms.dll')|Out-Null
try{
  $result=$provider.CompileAssemblyFromFile($parameters,(Join-Path $AppRoot 'Launcher.cs'))
  if($result.Errors.HasErrors){throw ($result.Errors|Out-String)}
  Move-Item -LiteralPath $temporary -Destination $output -Force
}finally{$provider.Dispose()}
