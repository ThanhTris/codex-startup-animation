$ErrorActionPreference='Stop'
$directory=Join-Path ([IO.Path]::GetTempPath()) ('codex hidden service '+[guid]::NewGuid())
$app=Join-Path $directory 'app'
$bin=Join-Path $directory 'bin'
New-Item -ItemType Directory -Path $app,$bin|Out-Null
$supervisor=$null
try {
  foreach($file in @('Launcher.cs','service.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('..\windows\'+$file)) -Destination $app}
  & (Join-Path $PSScriptRoot '..\windows\build-launcher.ps1') -AppRoot $app
  $source=@'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
class FakeNode {
  [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
  static int Main(string[] args) {
    int index=Array.IndexOf(args,"--root");
    if(index<0||index+1>=args.Length)return 9;
    string root=args[index+1];
    File.WriteAllText(Path.Combine(root,"node-console.txt"),GetConsoleWindow().ToInt64().ToString());
    Console.Out.Write(new string('o',200000));
    Console.Error.WriteLine("service-test-error");
    Console.Error.Write(new string('e',200000));
    File.WriteAllText(Path.Combine(root,"service-ready.txt"),System.Diagnostics.Process.GetCurrentProcess().Id.ToString());
    for(int i=0;i<600&&!File.Exists(Path.Combine(root,"stop.txt"));i++)Thread.Sleep(50);
    return File.Exists(Path.Combine(root,"fail.txt"))?7:0;
  }
}
'@
  $provider=New-Object Microsoft.CSharp.CSharpCodeProvider
  $parameters=New-Object CodeDom.Compiler.CompilerParameters
  $parameters.GenerateExecutable=$true;$parameters.OutputAssembly=Join-Path $bin 'node.exe';$parameters.CompilerOptions='/target:exe'
  $parameters.ReferencedAssemblies.Add('System.dll')|Out-Null
  try{$result=$provider.CompileAssemblyFromSource($parameters,$source);if($result.Errors.HasErrors){throw ($result.Errors|Out-String)}}finally{$provider.Dispose()}
  foreach($fail in @($false,$true)){
    foreach($marker in @('service-ready.txt','stop.txt','node-console.txt')){Remove-Item -LiteralPath (Join-Path $directory $marker) -ErrorAction SilentlyContinue}
    if($fail){[IO.File]::WriteAllText((Join-Path $directory 'fail.txt'),'1')}
    $info=New-Object Diagnostics.ProcessStartInfo
    $info.FileName=Join-Path $app 'CodexWallpaper.exe';$info.Arguments='--service --root "'+$directory+'"'
    $info.UseShellExecute=$false;$info.EnvironmentVariables['PATH']=$bin+';'+$env:PATH
    $supervisor=[Diagnostics.Process]::Start($info)
    for($i=0;$i -lt 100 -and -not(Test-Path -LiteralPath (Join-Path $directory 'service-ready.txt'));$i++){if($supervisor.HasExited){throw 'Dịch vụ dừng trước khi sẵn sàng.'};Start-Sleep -Milliseconds 100}
    if(-not(Test-Path -LiteralPath (Join-Path $directory 'service-ready.txt'))){throw 'Dịch vụ không sẵn sàng; có thể bị nghẽn ống nhật ký.'}
    if([IO.File]::ReadAllText((Join-Path $directory 'node-console.txt')) -ne '0'){throw 'Node.js có cửa sổ console.'}
    if($supervisor.HasExited){throw 'Tác vụ không còn theo dõi dịch vụ đang chạy.'}
    [IO.File]::WriteAllText((Join-Path $directory 'stop.txt'),'1')
    if(-not $supervisor.WaitForExit(10000)){throw 'Dịch vụ chưa thoát.'}
    $expected=if($fail){1}else{0}
    if($supervisor.ExitCode -ne $expected){throw 'Mã thoát dịch vụ không được chuyển về tác vụ.'}
    $supervisor.Dispose();$supervisor=$null
    if([IO.File]::ReadAllText((Join-Path $directory 'service.log')) -notmatch 'service-test-error'){throw 'Nhật ký lỗi bị mất.'}
  }
  Write-Output 'PASS: service runs without a console; supervisor tracks its lifetime; output pipes do not block; errors remain logged; paths with spaces work.'
} finally {
  if($supervisor){[IO.File]::WriteAllText((Join-Path $directory 'stop.txt'),'1');if(-not $supervisor.WaitForExit(10000)){$supervisor.Kill()};$supervisor.Dispose()}
  # Only remove files inside the unique test directory created above.
  $resolved=[IO.Path]::GetFullPath($directory)
  if($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('codex hidden service ')){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
