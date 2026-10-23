using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class WallpaperEntry {
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
    static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
    [STAThread]
    static void Main(string[] args) {
        try {
            string directory=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            string script=Path.Combine(directory,"launch.ps1");
            string mode=Array.IndexOf(args,"--settings")>=0 ? "library" : "launch";
            SetCurrentProcessExplicitAppUserModelID(mode=="library"?"CodexWallpaper.Settings":"CodexWallpaper.Codex");
            var info=new ProcessStartInfo {
                FileName=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","WindowsPowerShell","v1.0","powershell.exe"),
                Arguments="-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File \""+script+"\" -Mode "+mode,
                WorkingDirectory=directory, UseShellExecute=false, CreateNoWindow=true,
                WindowStyle=ProcessWindowStyle.Hidden
            };
            Process.Start(info);
        } catch(Exception error) { MessageBox.Show(error.Message,"Codex Wallpaper"); }
    }
}
