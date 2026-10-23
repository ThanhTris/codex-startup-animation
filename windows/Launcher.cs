using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class WallpaperEntry {
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
    static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
    [STAThread]
    static int Main(string[] args) {
        bool service=Array.IndexOf(args,"--service")>=0;
        try {
            string directory=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            string script=Path.Combine(directory,service?"service.ps1":"launch.ps1");
            string mode=Array.IndexOf(args,"--settings")>=0 ? "library" : "launch";
            string arguments=" -Mode "+mode;
            if(service) {
                int index=Array.IndexOf(args,"--root");
                if(index<0 || index+1>=args.Length)throw new ArgumentException("Thiếu thư mục dữ liệu dịch vụ.");
                string root=Path.GetFullPath(args[index+1]).TrimEnd(Path.DirectorySeparatorChar);
                arguments=" -Root \""+root+"\"";
            } else SetCurrentProcessExplicitAppUserModelID(mode=="library"?"CodexWallpaper.Settings":"CodexWallpaper.Codex");
            var info=new ProcessStartInfo {
                FileName=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","WindowsPowerShell","v1.0","powershell.exe"),
                Arguments="-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \""+script+"\""+arguments,
                WorkingDirectory=directory, UseShellExecute=false, CreateNoWindow=true,
                WindowStyle=ProcessWindowStyle.Hidden
            };
            using(var process=Process.Start(info)) {
                // Keep the scheduled task alive for exactly as long as its service.
                if(service){process.WaitForExit();return process.ExitCode;}
            }
            return 0;
        } catch(Exception error) {
            if(service) {
                try { File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"service-launcher.log"),DateTime.UtcNow.ToString("o")+" "+error+Environment.NewLine); }catch{}
            } else MessageBox.Show(error.Message,"Codex Wallpaper");
            return 1;
        }
    }
}
