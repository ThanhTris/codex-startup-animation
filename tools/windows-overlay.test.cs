using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace CodexWallpaper {
    internal static class OverlayTests {
        private sealed class TestWindow : Form {
            internal TestWindow() { ShowInTaskbar=false; StartPosition=FormStartPosition.Manual; Bounds=new Rectangle(-25000,-25000,700,500); }
            protected override bool ShowWithoutActivation {get{return true;}}
        }
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wParam,IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window,int command);
        [DllImport("user32.dll")] private static extern uint GetGuiResources(IntPtr process,uint flags);
        private static void Assert(bool condition,string name) { if(!condition)throw new Exception("FAIL "+name); Console.WriteLine("PASS "+name); }
        private static void Save(string root,string image,int strength,bool enabled) {
            File.WriteAllText(Path.Combine(root,"settings.json"),new JavaScriptSerializer().Serialize(new {enabled=enabled,renderedName=image,strength=strength}));
        }
        private static List<IntPtr> Existing(Form form) {return form!=null&&!form.IsDisposed?new List<IntPtr>{form.Handle}:new List<IntPtr>();}
        private static bool PumpUntil(Func<bool> condition) {
            var clock=Stopwatch.StartNew();
            while(clock.ElapsedMilliseconds<3000){Application.DoEvents();if(condition())return true;Thread.Sleep(10);}
            return false;
        }
        private static void PumpFor(int milliseconds){var watch=Stopwatch.StartNew();while(watch.ElapsedMilliseconds<milliseconds){Application.DoEvents();Thread.Sleep(10);}}
        private static int RunFixture() {
            Form window=new TestWindow();window.Show();
            var queue=new ConcurrentQueue<string>();
            var reader=new Thread(delegate(){string line;while((line=Console.ReadLine())!=null)queue.Enqueue(line);});reader.IsBackground=true;reader.Start();
            using(var context=new ApplicationContext())
            using(var timer=new System.Windows.Forms.Timer {Interval=20}) {
                timer.Tick+=delegate {
                    string line;
                    while(queue.TryDequeue(out line)) {
                        string[] command=line.Split(' ');string action=command[1];
                        if(action=="move")window.Bounds=new Rectangle(-24500,-24900,660,430);
                        else if(action=="hide")window.Hide();
                        else if(action=="show")window.Show();
                        else if(action=="minimize")window.WindowState=FormWindowState.Minimized;
                        else if(action=="restore")window.WindowState=FormWindowState.Normal;
                        else if(action=="close"){window.Close();window=null;}
                        else if(action=="open"){window=new TestWindow();window.Show();}
                        Console.WriteLine(command[0]+" "+(window==null?0:window.Handle.ToInt64()));Console.Out.Flush();
                        if(action=="quit"){if(window!=null)window.Dispose();context.ExitThread();}
                    }
                };
                timer.Start();Application.Run(context);
            }
            return 0;
        }
        private sealed class Fixture : IDisposable {
            private readonly Process process;
            private readonly ConcurrentQueue<string> output=new ConcurrentQueue<string>();
            private int serial;
            internal Fixture() {
                process=new Process {StartInfo=new ProcessStartInfo {FileName=Assembly.GetExecutingAssembly().Location,Arguments="--fixture",UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true}};
                process.OutputDataReceived+=delegate(object sender,DataReceivedEventArgs e){if(e.Data!=null)output.Enqueue(e.Data);};
                process.Start();process.BeginOutputReadLine();
            }
            internal IntPtr Command(string command) {
                int id=++serial;process.StandardInput.WriteLine(id+" "+command);process.StandardInput.Flush();
                string response=null;
                if(!PumpUntil(()=>output.TryDequeue(out response)))throw new Exception("Fixture timeout: "+command);
                string[] parts=response.Split(' ');
                if(parts[0]!=id.ToString())throw new Exception("Unexpected fixture response: "+response);
                return new IntPtr(Int64.Parse(parts[1]));
            }
            public void Dispose() {
                if(!process.HasExited){try{Command("quit");}catch{}if(!process.WaitForExit(2000)){process.Kill();process.WaitForExit();}}
                process.Dispose();
            }
        }
        [STAThread] private static int Main(string[] args) {
            try {
                Native.DpiAware();Application.EnableVisualStyles();
                if(args[0]=="--fixture")return RunFixture();
                string root=args[0];
                Directory.CreateDirectory(Path.Combine(root,"images"));
                using(var image=new Bitmap(40,30)) {using(var g=Graphics.FromImage(image))g.Clear(Color.Red);image.Save(Path.Combine(root,"images","red.png"));}
                using(var image=new Bitmap(40,30)) {using(var g=Graphics.FromImage(image))g.Clear(Color.Blue);image.Save(Path.Combine(root,"images","blue.png"));}
                Save(root,"red.png",23,true);
                Form host=new TestWindow();host.Show();Application.DoEvents();
                using(var context=new OverlayContext(root,()=>Existing(host))) {
                    Application.DoEvents();context.Tick();
                    var layer=context.Layers[host.Handle];
                    Assert(layer.Visible,"saved wallpaper appears for an existing window");
                    Assert(Math.Abs(layer.Opacity-.23)<.01,"saved opacity is used");
                    Assert(Native.GetWindow(layer.Handle,4)==host.Handle,"overlay is owned by the target window");
                    Assert(layer.Bounds==Native.ClientBounds(host.Handle),"overlay fits the client area in screen coordinates");
                    int styles=Native.GetWindowLong(layer.Handle,-20);
                    Assert((styles&0x080800a0)==0x080800a0,"native layered, click-through, tool-window and no-activate styles");
                    Assert((styles&8)==0,"overlay does not use global topmost");
                    Assert(SendMessage(layer.Handle,0x84,IntPtr.Zero,IntPtr.Zero).ToInt64()==-1,"native hit test passes input through");
                    Assert(SendMessage(layer.Handle,0x21,IntPtr.Zero,IntPtr.Zero).ToInt64()==3,"overlay refuses mouse activation");
                    layer.Close();Application.DoEvents();context.Tick();
                    Assert(context.Layers[host.Handle]!=layer&&!context.Layers[host.Handle].IsDisposed,"a disposed overlay is recreated while its target still exists");
                    layer=context.Layers[host.Handle];
                    ShowWindow(layer.Handle,0);
                    Assert(!Native.IsWindowVisible(layer.Handle),"native-hidden state is measured directly");
                    context.Tick();Assert(Native.IsWindowVisible(layer.Handle),"native-hidden overlay is restored without restarting the app");
                    Assert(context.Settings.Image.GetPixel(5,5).R>240,"first image decoded");
                    Save(root,"blue.png",17,true);context.Tick();
                    Assert(context.Settings.Image.GetPixel(5,5).B>240&&Math.Abs(layer.Opacity-.17)<.01,"new image and opacity reload while app is open");
                    string config=Path.Combine(root,"settings.json"),savedConfig=config+".hold";
                    File.Move(config,savedConfig);context.Tick();
                    Assert(layer.IsActuallyVisible&&context.Settings.Image!=null,"briefly missing settings keep the current wallpaper");
                    File.Move(savedConfig,config);context.Tick();Assert(layer.IsActuallyVisible,"returning settings keep the same image visible");
                    using(var configLock=new FileStream(config,FileMode.Open,FileAccess.Read,FileShare.None)) {
                        context.Tick();Assert(layer.IsActuallyVisible,"temporary settings lock does not flash wallpaper off");
                    }
                    context.Tick();
                    using(var exclusive=new FileStream(Path.Combine(root,"images","blue.png"),FileMode.Open,FileAccess.Read,FileShare.None))Assert(exclusive.Length>0,"renderer releases the image file after decoding");
                    host.WindowState=FormWindowState.Minimized;Application.DoEvents();context.Tick();Assert(!layer.Visible,"minimized app hides the layer");
                    host.WindowState=FormWindowState.Normal;Application.DoEvents();context.Tick();Assert(layer.Visible,"restore shows the saved image");
                    Save(root,"blue.png",0,true);context.Tick();Assert(!layer.Visible,"zero opacity hides the layer");
                    Save(root,"blue.png",17,false);context.Tick();Assert(!layer.Visible,"restore appearance hides the layer");
                    Save(root,"../private.jpg",17,true);context.Tick();Assert(context.Settings.Image==null&&context.Settings.Error.Length>0,"paths outside the library are rejected");
                    File.WriteAllText(Path.Combine(root,"settings.json"),"{");context.Tick();Assert(context.Settings.Image==null,"incomplete settings hide the layer without crashing");
                    Save(root,"blue.png",19,true);context.Tick();Assert(layer.Visible,"valid settings recover after an error");
                    File.WriteAllText(Path.Combine(root,"settings.json"),"{");context.Tick();
                    Save(root,"blue.png",19,true);context.Tick();Assert(layer.Visible,"restoring the exact previous settings recovers after invalid JSON");
                    host.Close();Application.DoEvents();context.Tick();Assert(context.Layers.Count==0,"closing the app removes its layer");
                    host=new TestWindow();host.Show();Application.DoEvents();context.Tick();
                    Assert(context.Layers[host.Handle].Visible&&context.Settings.Image.GetPixel(5,5).B>240,"opening a new app window uses the last saved image");
                    host.Close();Application.DoEvents();context.Tick();
                }
                host=new TestWindow();host.Show();Application.DoEvents();
                using(var restarted=new OverlayContext(root,()=>Existing(host)))Assert(restarted.Layers[host.Handle].Visible&&Math.Abs(restarted.Settings.Opacity-.19)<.01,"restarting the loader retains image and opacity");
                host.Close();
                DateTime fakeClock=DateTime.UtcNow;
                using(var settings=new WallpaperSettings(root,()=>fakeClock)) {
                    settings.Reload();string file=Path.Combine(root,"settings.json"),saved=file+".hold";
                    File.Move(file,saved);settings.Reload();fakeClock=fakeClock.AddSeconds(3);settings.Reload();
                    Assert(settings.Image==null&&settings.Error.Length>0,"a persistently missing config becomes an explicit error");
                    File.Move(saved,file);settings.Reload();Assert(settings.Image!=null&&settings.Error.Length==0,"loader recovers when the config returns after the grace period");
                }
                // Cross-process owners exercise native destruction and WinEvent delivery.
                IntPtr external=IntPtr.Zero;
                using(var context=new OverlayContext(root,()=>external==IntPtr.Zero?new List<IntPtr>():new List<IntPtr>{external})) {
                    var poll=(System.Windows.Forms.Timer)typeof(OverlayContext).GetField("timer",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(context);
                    poll.Stop(); // Move/minimize assertions below must pass through real native events.
                    for(int restart=0;restart<3;restart++)using(var fixture=new Fixture()) {
                        external=fixture.Command("hello");context.Tick();Application.DoEvents();
                        Assert(context.Layers[external].IsActuallyVisible,"cold process start gets wallpaper #"+restart);
                        var layer=context.Layers[external];
                        fixture.Command("move");
                        Assert(PumpUntil(()=>layer.Bounds==Native.ClientBounds(external)),"native move events follow the external app without polling #"+restart);
                        fixture.Command("minimize");Assert(PumpUntil(()=>!layer.IsActuallyVisible),"native minimize event hides wallpaper #"+restart);
                        fixture.Command("restore");Assert(PumpUntil(()=>layer.IsActuallyVisible),"native restore event restores wallpaper #"+restart);
                        fixture.Command("hide");Assert(PumpUntil(()=>!layer.IsActuallyVisible),"hidden external app hides wallpaper #"+restart);
                        fixture.Command("show");Assert(PumpUntil(()=>layer.IsActuallyVisible),"reshown external app restores wallpaper #"+restart);
                        for(int reopen=0;reopen<8;reopen++) {
                            fixture.Command("close");Application.DoEvents();context.Tick();
                            external=fixture.Command("open");context.Tick();Application.DoEvents();
                            Assert(context.Layers[external].IsActuallyVisible,"external window close/reopen #"+restart+"/"+reopen);
                        }
                    }
                    external=IntPtr.Zero;Application.DoEvents();context.Tick();Assert(context.Layers.Count==0,"all external process layers are removed on exit");
                }
                using(var first=new TestWindow())using(var second=new TestWindow()) {
                    first.Show();second.Show();
                    using(var context=new OverlayContext(root,()=>new List<IntPtr>{first.Handle,second.Handle})) {
                        var healthy=context.Layers[second.Handle];context.Layers[first.Handle].Dispose();context.Tick();
                        Assert(context.Layers[first.Handle].IsActuallyVisible,"one window recovers its disposed layer");
                        Assert(Object.ReferenceEquals(context.Layers[second.Handle],healthy)&&healthy.IsActuallyVisible,"recovering one window keeps the other window intact");
                    }
                }
                Directory.CreateDirectory(Path.Combine(root,"gifs"));
                byte[] gif=Convert.FromBase64String("R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAGQAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBGQABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7");
                File.WriteAllBytes(Path.Combine(root,"gifs","loop.gif"),gif);
                Action<bool> saveGif=paused=>File.WriteAllText(Path.Combine(root,"settings.json"),new JavaScriptSerializer().Serialize(new {enabled=true,kind="gif",name="loop.gif",renderedName="loop.gif",strength=20,paused=paused}));
                saveGif(false);
                using(var animatedHost=new TestWindow()) {
                    animatedHost.Show();
                    using(var context=new OverlayContext(root,()=>Existing(animatedHost))) {
                        Assert(context.Settings.IsAnimated,"GIF retains its animation decoder");
                        Assert(PumpUntil(()=>context.Settings.CurrentFrame==1&&context.Settings.DisplayImage.GetPixel(1,1).B>240),"GIF timer advances to a different rendered frame");
                        animatedHost.WindowState=FormWindowState.Minimized;Application.DoEvents();context.Tick();int held=context.Settings.CurrentFrame;PumpFor(550);
                        Assert(context.Settings.CurrentFrame==held,"GIF playback stops while its app is minimized");
                        animatedHost.WindowState=FormWindowState.Normal;Application.DoEvents();context.Tick();
                        Assert(PumpUntil(()=>context.Settings.CurrentFrame!=held),"GIF playback resumes when its app is restored");
                        saveGif(true);context.Tick();PumpFor(550);
                        Assert(context.Settings.Paused&&context.Settings.CurrentFrame==0,"saved pause keeps the GIF on a still frame");
                        using(var exclusive=new FileStream(Path.Combine(root,"gifs","loop.gif"),FileMode.Open,FileAccess.Read,FileShare.None))Assert(exclusive.Length==gif.Length,"animated decoder does not lock the user's GIF file");
                        byte[] replacement=(byte[])gif.Clone();replacement[13]=0;replacement[14]=255;
                        File.WriteAllBytes(Path.Combine(root,"gifs","loop.gif"),replacement);
                        File.WriteAllText(Path.Combine(root,"settings.json"),new JavaScriptSerializer().Serialize(new {enabled=true,kind="gif",name="loop.gif",renderedName="loop.gif",strength=20,paused=true,revision=Guid.NewGuid().ToString()}));context.Tick();
                        Assert(context.Settings.DisplayImage.GetPixel(1,1).G>240,"reapplying a replaced GIF under the same name loads the new pixels");
                        File.WriteAllBytes(Path.Combine(root,"gifs","loop.gif"),gif);
                        Save(root,"blue.png",19,true);context.Tick();Assert(!context.Settings.IsGif&&context.Settings.Image.GetPixel(1,1).B>240,"switching from GIF back to a static image releases playback");
                        uint handlesBefore=GetGuiResources(Process.GetCurrentProcess().Handle,0);
                        for(int cycle=0;cycle<40;cycle++){saveGif(cycle%2==0);context.Tick();Save(root,"blue.png",19,true);context.Tick();}
                        uint handlesAfter=GetGuiResources(Process.GetCurrentProcess().Handle,0);
                        Assert(handlesAfter<=handlesBefore+8,"40 GIF/static switches do not accumulate GDI handles");
                        saveGif(false);context.Tick();Save(root,"blue.png",19,false);context.Tick();Assert(context.Settings.Image==null&&!context.Settings.IsAnimated,"restoring original appearance stops and releases GIF playback");
                    }
                    saveGif(true);using(var restarted=new OverlayContext(root,()=>Existing(animatedHost)))Assert(restarted.Settings.IsGif&&restarted.Settings.Paused,"GIF selection and pause survive a loader restart");
                }
                string official=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"WindowsApps","OpenAI.Codex_26.1016.8120.0_x64__2p2nqsd0c76g0","app","ChatGPT.exe");
                Assert(TargetWindows.OfficialPath(official),"official package path recognized");
                Assert(!TargetWindows.OfficialPath(Path.Combine(root,"ChatGPT.exe")),"unrelated ChatGPT process rejected");
                Assert(!TargetWindows.OfficialPath(official.Replace("2p2nqsd0c76g0","otherpublisher")),"other package publisher rejected");
                Assert(TargetWindows.MainStyle(0x15070000),"current captionless Codex frame accepted");
                Assert(TargetWindows.MainStyle(0x16CF0000),"traditional resizable frame accepted");
                Assert(!TargetWindows.MainStyle(0x14000000),"non-resizable popover rejected");
                Console.WriteLine("All native overlay checks passed.");return 0;
            } catch(Exception error) {Console.Error.WriteLine(error);return 1;}
        }
    }
}
