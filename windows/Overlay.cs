using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace CodexWallpaper {
    internal static class Native {
        internal delegate bool EnumProc(IntPtr window, IntPtr parameter);
        internal delegate void WinEventProc(IntPtr hook,uint eventType,IntPtr window,int objectId,int childId,uint thread,uint time);
        [DllImport("user32.dll")] internal static extern IntPtr SetWinEventHook(uint first,uint last,IntPtr module,WinEventProc callback,uint process,uint thread,uint flags);
        [DllImport("user32.dll")] internal static extern bool UnhookWinEvent(IntPtr hook);
        [StructLayout(LayoutKind.Sequential)] internal struct Rect { internal int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] internal struct Point { internal int X, Y; }
        [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
        [DllImport("user32.dll")] internal static extern bool IsWindow(IntPtr window);
        [DllImport("user32.dll")] internal static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] internal static extern bool IsIconic(IntPtr window);
        [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr window, int command);
        [DllImport("user32.dll")] internal static extern IntPtr GetWindow(IntPtr window, uint command);
        [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
        [DllImport("user32.dll", CharSet=CharSet.Unicode)] internal static extern int GetClassName(IntPtr window, StringBuilder name, int size);
        [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr window, out Rect rect);
        [DllImport("user32.dll")] internal static extern bool ClientToScreen(IntPtr window, ref Point point);
        [DllImport("user32.dll")] internal static extern int GetWindowLong(IntPtr window, int index);
        [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
        [DllImport("kernel32.dll")] private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref uint size);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
        [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
        internal static void DpiAware() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { SetProcessDPIAware(); } }
        internal static string ProcessPath(uint pid) {
            IntPtr handle=OpenProcess(0x1000,false,pid);
            if(handle==IntPtr.Zero)return "";
            try { var value=new StringBuilder(32768); uint length=(uint)value.Capacity; return QueryFullProcessImageName(handle,0,value,ref length)?value.ToString():""; }
            finally { CloseHandle(handle); }
        }
        internal static Rectangle ClientBounds(IntPtr window) {
            Rect rect; var point=new Point();
            if(!GetClientRect(window,out rect)||!ClientToScreen(window,ref point))return Rectangle.Empty;
            return new Rectangle(point.X,point.Y,rect.Right-rect.Left,rect.Bottom-rect.Top);
        }
        internal static bool CanShow(IntPtr window) {
            int cloaked;
            return IsWindow(window)&&IsWindowVisible(window)&&!IsIconic(window)&&
                (DwmGetWindowAttribute(window,14,out cloaked,4)!=0||cloaked==0);
        }
    }

    // Out-of-context callbacks run on this UI thread; no DLL is injected into Codex.
    internal sealed class WindowEvents : IDisposable {
        private IntPtr objects, system;
        private GCHandle callbackRoot;
        internal bool Active {get{return objects!=IntPtr.Zero&&system!=IntPtr.Zero;}}
        internal WindowEvents(Action<IntPtr,uint> changed) {
            Native.WinEventProc callback=delegate(IntPtr hook,uint type,IntPtr window,int objectId,int childId,uint thread,uint time) {
                if(window==IntPtr.Zero||(type>=0x8000&&(objectId!=0||childId!=0)))return;
                try {changed(window,type);}catch { } // Never throw across the native callback boundary.
            };
            callbackRoot=GCHandle.Alloc(callback);
            objects=Native.SetWinEventHook(0x8001,0x800B,IntPtr.Zero,callback,0,0,2);
            system=Native.SetWinEventHook(3,0x17,IntPtr.Zero,callback,0,0,2);
        }
        public void Dispose() {
            if(objects!=IntPtr.Zero){Native.UnhookWinEvent(objects);objects=IntPtr.Zero;}
            if(system!=IntPtr.Zero){Native.UnhookWinEvent(system);system=IntPtr.Zero;}
            if(callbackRoot.IsAllocated)callbackRoot.Free();
        }
    }

    internal sealed class GifPlayback : IDisposable {
        private readonly MemoryStream stream;
        internal readonly Bitmap Source, Frame;
        private readonly Graphics graphics;
        private readonly long[] ends;
        private readonly Stopwatch clock=new Stopwatch();
        internal int CurrentFrame {get;private set;}
        internal int Count {get{return ends.Length;}}
        internal GifPlayback(byte[] data) {
            stream=new MemoryStream(data,false);
            try {
                Source=(Bitmap)System.Drawing.Image.FromStream(stream,true,true);
                int count=Source.GetFrameCount(FrameDimension.Time);
                if(Source.Width>4096||Source.Height>4096||(long)Source.Width*Source.Height>2073600||count>300||(long)Source.Width*Source.Height*count>120000000)throw new InvalidDataException("GIF quá lớn hoặc quá dài. Hãy giảm kích thước hoặc rút ngắn GIF.");
                ends=new long[count];byte[] delays=null;
                try {delays=Source.GetPropertyItem(0x5100).Value;}catch(ArgumentException) { }
                long duration=0;
                for(int i=0;i<count;i++) {
                    long delay=delays!=null&&delays.Length>=(i+1)*4?BitConverter.ToUInt32(delays,i*4)*10L:100;
                    duration+=delay==0?100:Math.Max(20,Math.Min(600000,delay));ends[i]=duration;
                }
                Frame=new Bitmap(Source.Width,Source.Height,PixelFormat.Format32bppPArgb);
                graphics=Graphics.FromImage(Frame);graphics.CompositingMode=CompositingMode.SourceCopy;
                DrawFrame(0);
            }catch {Dispose();throw;}
        }
        private void DrawFrame(int index) {
            Source.SelectActiveFrame(FrameDimension.Time,index);
            graphics.Clear(Color.Transparent);graphics.DrawImageUnscaled(Source,0,0);graphics.Flush(FlushIntention.Sync);CurrentFrame=index;
        }
        internal void SetRunning(bool running) {if(running)clock.Start();else clock.Stop();}
        internal bool Advance() {
            long time=clock.ElapsedMilliseconds%ends[ends.Length-1];
            int index=Array.BinarySearch(ends,time);index=index>=0?index+1:~index;
            if(index==CurrentFrame)return false;
            DrawFrame(index);return true;
        }
        public void Dispose() {clock.Stop();if(graphics!=null)graphics.Dispose();if(Frame!=null)Frame.Dispose();if(Source!=null)Source.Dispose();if(stream!=null)stream.Dispose();}
    }

    // One decoder and two reusable pixel buffers, shared by every Codex window.
    // Frames are requested by the UI timer; a full pipe blocks the decoder while hidden.
    internal sealed class VideoPlayback : IDisposable {
        internal readonly Bitmap Frame;
        private readonly string executable,path;
        private readonly object gate=new object();
        private readonly System.Threading.AutoResetEvent demand;
        private Process process;
        private System.Threading.Thread worker;
        private byte[] readBuffer,readyBuffer;
        private bool ready;
        private volatile bool disposed,running;
        internal volatile string Error="";
        internal int DecodedFrames;
        internal int ProcessId {get{return process==null?0:process.Id;}}
        internal VideoPlayback(string exe,string file,string poster,int width,int height) {
            if(width<2||height<2||width>1280||height>720||(long)width*height>921600||!Path.IsPathRooted(exe)||!File.Exists(exe))throw new InvalidDataException("Thiếu FFmpeg hoặc kích thước video không hợp lệ.");
            executable=exe;path=file;
            using(var source=System.Drawing.Image.FromFile(poster)) {
                if(source.Width!=width||source.Height!=height)throw new InvalidDataException("Ảnh xem trước video không khớp.");
                Frame=new Bitmap(width,height,PixelFormat.Format32bppArgb);using(var graphics=Graphics.FromImage(Frame))graphics.DrawImageUnscaled(source,0,0);
            }
            readBuffer=new byte[width*height*4];readyBuffer=new byte[readBuffer.Length];demand=new System.Threading.AutoResetEvent(false);
        }
        internal void SetRunning(bool value) {
            bool resume=value&&!running;running=value;if(!value||disposed||Error.Length>0)return;
            if(process==null) {
                try {
                    var info=new ProcessStartInfo {FileName=executable,Arguments="-nostdin -v error -threads 2 -stream_loop -1 -protocol_whitelist file,pipe -i \""+path+"\" -map 0:v:0 -an -sn -dn -vf fps=15,scale="+Frame.Width+":"+Frame.Height+" -pix_fmt bgra -threads 1 -f rawvideo pipe:1",UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                    process=new Process {StartInfo=info};process.ErrorDataReceived+=delegate(object sender,DataReceivedEventArgs e){if(!disposed&&!String.IsNullOrWhiteSpace(e.Data))Error=e.Data.Length>500?e.Data.Substring(0,500):e.Data;};
                    process.Start();process.BeginErrorReadLine();
                    worker=new System.Threading.Thread(ReadFrames);worker.IsBackground=true;worker.Start();
                }catch(Exception error){Error=error.Message;return;}
            }
            if(resume)demand.Set();
        }
        private void ReadFrames() {
            try {
                var stream=process.StandardOutput.BaseStream;
                while(!disposed){demand.WaitOne();if(disposed)break;if(!running)continue;
                    int offset=0;while(offset<readBuffer.Length){int count=stream.Read(readBuffer,offset,readBuffer.Length-offset);if(count==0)throw new EndOfStreamException("Bộ giải mã video đã dừng.");offset+=count;}
                    lock(gate){var previous=readyBuffer;readyBuffer=readBuffer;readBuffer=previous;ready=true;DecodedFrames++;}
                }
            }catch(Exception error){if(!disposed)Error=error.Message;}
        }
        internal bool Advance() {
            if(Error.Length>0)throw new InvalidDataException(Error);
            bool changed=false;
            lock(gate){if(ready){var bits=Frame.LockBits(new Rectangle(0,0,Frame.Width,Frame.Height),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);try{Marshal.Copy(readyBuffer,0,bits.Scan0,readyBuffer.Length);}finally{Frame.UnlockBits(bits);}ready=false;changed=true;}}
            if(running)demand.Set();return changed;
        }
        public void Dispose() {
            disposed=true;running=false;demand.Set();
            if(process!=null){try{if(!process.HasExited)process.Kill();}catch{}if(worker!=null&&worker.IsAlive)worker.Join(2000);process.Dispose();process=null;}
            // The worker touches only byte buffers, never the bitmap.
            if(worker==null||!worker.IsAlive)demand.Dispose();Frame.Dispose();
        }
    }

    internal sealed class CropSettings {
        internal string Fit="cover";
        internal double Zoom=1, X=.5, Y=.5;
        private static double Read(Dictionary<string,object> data,string key,double fallback,double min,double max) {
            object value;if(data==null||!data.TryGetValue(key,out value)||!(value is int||value is long||value is double||value is decimal))return fallback;
            double number=Convert.ToDouble(value);return Double.IsNaN(number)||Double.IsInfinity(number)?fallback:Math.Max(min,Math.Min(max,number));
        }
        internal static CropSettings Parse(object value) {
            var data=value as Dictionary<string,object>;object fit;
            return new CropSettings {Fit=data!=null&&data.TryGetValue("fit",out fit)&&Object.Equals(fit,"contain")?"contain":"cover",Zoom=Read(data,"zoom",1,.25,4),X=Read(data,"x",.5,0,1),Y=Read(data,"y",.5,0,1)};
        }
        internal RectangleF Bounds(int iw,int ih,int w,int h) {
            double scale=(Fit=="contain"?Math.Min((double)w/iw,(double)h/ih):Math.Max((double)w/iw,(double)h/ih))*Zoom;
            double width=iw*scale,height=ih*scale;
            return new RectangleF((float)((w-width)*X),(float)((h-height)*Y),(float)width,(float)height);
        }
    }
    internal sealed class WallpaperSettings : IDisposable {
        internal CropSettings Crop=new CropSettings();
        internal Bitmap Image;
        internal double Opacity;
        internal string Name="", Error="";
        internal bool Paused;
        private GifPlayback animation;
        private VideoPlayback video;
        private string failedVideoText;
        internal bool IsVideo {get{return video!=null;}}
        internal int VideoFrames {get{return video==null?0:video.DecodedFrames;}}
        internal int VideoProcessId {get{return video==null?0:video.ProcessId;}}
        internal bool IsGif {get{return animation!=null;}}
        internal bool IsAnimated {get{return video!=null||(animation!=null&&animation.Count>1);}}
        internal int CurrentFrame {get{return animation==null?0:animation.CurrentFrame;}}
        internal Bitmap DisplayImage {get{return animation==null?Image:animation.Frame;}}
        internal void SetAnimationRunning(bool running){if(animation!=null)animation.SetRunning(running&&!Paused);if(video!=null)video.SetRunning(running&&!Paused);}
        internal bool AdvanceAnimation(){return !Paused&&(video!=null?video.Advance():animation!=null&&animation.Advance());}
        private void ReleaseImage(){if(video!=null){video.Dispose();video=null;}else if(animation!=null){animation.Dispose();animation=null;}else if(Image!=null)Image.Dispose();Image=null;}
        private string lastText;
        private readonly string root;
        private readonly Func<DateTime> clock;
        private DateTime unreadableSince=DateTime.MinValue;
        internal WallpaperSettings(string rootPath,Func<DateTime> utcNow=null) { root=rootPath;clock=utcNow??(()=>DateTime.UtcNow); }
        internal bool Reload() {
            string text;
            try {
                using(var stream=new FileStream(Path.Combine(root,"settings.json"),FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete))
                using(var reader=new StreamReader(stream))text=reader.ReadToEnd();
            }
            catch(Exception error) {
                if(error is FileNotFoundException&&lastText==null)text="{}";
                else {
                    // An atomic replacement or brief sharing lock must not flash the wallpaper off.
                    // A missing/inaccessible file still becomes an explicit error after two seconds.
                    if(lastText!=null) {
                        if(unreadableSince==DateTime.MinValue)unreadableSince=clock();
                        if((clock()-unreadableSince).TotalSeconds<2)return false;
                    }
                    Error=error.Message;ReleaseImage();Opacity=0;return true;
                }
            }
            unreadableSince=DateTime.MinValue;
            if(video!=null&&video.Error.Length>0){Error=video.Error;failedVideoText=text;ReleaseImage();Opacity=0;return true;}
            if(text==failedVideoText)return false;
            if(text==lastText&&Error.Length==0)return false;
            try {
                var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(text);
                object enabled, rawStrength, rawName;
                bool active=data!=null&&data.TryGetValue("enabled",out enabled)&&enabled is bool&&(bool)enabled;
                double strength=data!=null&&data.TryGetValue("strength",out rawStrength)?Convert.ToDouble(rawStrength):35;
                if(Double.IsNaN(strength)||Double.IsInfinity(strength))throw new InvalidDataException("Invalid opacity.");
                strength=Math.Max(0,Math.Min(75,strength));
                Bitmap next=null;GifPlayback nextAnimation=null;VideoPlayback nextVideo=null;string name="";object rawKind,rawPaused;
                bool gif=data!=null&&data.TryGetValue("kind",out rawKind)&&Object.Equals(rawKind,"gif");
                bool movie=data!=null&&data.TryGetValue("kind",out rawKind)&&Object.Equals(rawKind,"video");
                bool paused=data!=null&&data.TryGetValue("paused",out rawPaused)&&Object.Equals(rawPaused,true);
                if(active&&strength>0) {
                    if(!data.TryGetValue("renderedName",out rawName)&&!data.TryGetValue("name",out rawName))throw new InvalidDataException("No wallpaper selected.");
                    name=rawName as string;
                    if(String.IsNullOrWhiteSpace(name)||name=="."||name==".."||name.IndexOfAny(Path.GetInvalidFileNameChars())>=0||Path.GetFileName(name)!=name)throw new InvalidDataException("Invalid image name.");
                    string imagePath=Path.Combine(root,movie?"videos":gif?"gifs":"images",name);
                    var info=new FileInfo(imagePath);
                    if(!info.Exists||info.Length>(movie?200:30)*1024*1024||(info.Attributes&FileAttributes.ReparsePoint)!=0)throw new InvalidDataException("Invalid wallpaper file.");
                    if(movie){
                        object rawVideo;var details=data.TryGetValue("video",out rawVideo)?rawVideo as Dictionary<string,object>:null;
                        if(details==null)throw new InvalidDataException("Chưa chuẩn bị video. Hãy áp dụng lại từ thư viện.");
                        string poster=Convert.ToString(details["poster"]);
                        if(!System.Text.RegularExpressions.Regex.IsMatch(poster,"^[a-f0-9]{64}\\.jpg$"))throw new InvalidDataException("Ảnh xem trước video không hợp lệ.");
                        var runtime=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"video-runtime.json")));
                        nextVideo=new VideoPlayback(Convert.ToString(runtime["ffmpeg"]),imagePath,Path.Combine(root,"video-cache",poster),Convert.ToInt32(details["width"]),Convert.ToInt32(details["height"]));next=nextVideo.Frame;
                    }
                    else if(gif){nextAnimation=new GifPlayback(File.ReadAllBytes(imagePath));next=nextAnimation.Source;}
                    else using(var stream=new FileStream(imagePath,FileMode.Open,FileAccess.Read,FileShare.Read|FileShare.Delete))
                        using(var decoded=System.Drawing.Image.FromStream(stream,true,true)) {
                            if((long)decoded.Width*decoded.Height>40000000)throw new InvalidDataException("Image exceeds 40 megapixels.");next=new Bitmap(decoded);
                        }
                }
                object rawCrop;Crop=CropSettings.Parse(data!=null&&data.TryGetValue("crop",out rawCrop)?rawCrop:null);
                ReleaseImage();Image=next;animation=nextAnimation;video=nextVideo;failedVideoText=null;Paused=paused;Opacity=next==null?0:strength/100;Name=name;lastText=text;Error="";
                return true;
            } catch(Exception error) {
                // Retry a transient replacement or missing image on the next tick.
                Error=error.Message;
                ReleaseImage();
                Opacity=0;
                return true;
            }
        }
        public void Dispose() {ReleaseImage();}
    }

    internal sealed class OverlayForm : Form {
        private readonly WallpaperSettings settings;
        internal readonly IntPtr Target;
        private readonly uint targetPid, targetThread;
        private bool wasShown;
        internal bool IsCurrent {
            get {
                if(IsDisposed||Disposing||!Native.IsWindow(Target))return false;
                uint pid;uint thread=Native.GetWindowThreadProcessId(Target,out pid);
                if(pid!=targetPid||thread!=targetThread)return false;
                return !wasShown||(IsHandleCreated&&Native.IsWindow(Handle)&&Native.GetWindow(Handle,4)==Target);
            }
        }
        internal bool IsActuallyVisible { get {return !IsDisposed&&IsHandleCreated&&Native.IsWindowVisible(Handle);} }
        private sealed class OwnerHandle : IWin32Window { public IntPtr Handle {get;private set;} internal OwnerHandle(IntPtr value){Handle=value;} }
        internal OverlayForm(IntPtr target, WallpaperSettings value) {
            Target=target; settings=value; FormBorderStyle=FormBorderStyle.None; ShowInTaskbar=false;
            targetThread=Native.GetWindowThreadProcessId(target,out targetPid);
            StartPosition=FormStartPosition.Manual; AutoScaleMode=AutoScaleMode.None; BackColor=Color.Black;
            SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);
        }
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams {
            get { var p=base.CreateParams; p.ExStyle|=0x20|0x80|0x08000000; return p; }
        }
        protected override void WndProc(ref Message message) {
            if(message.Msg==0x84){message.Result=new IntPtr(-1);return;}
            if(message.Msg==0x21){message.Result=new IntPtr(3);return;}
            base.WndProc(ref message);
        }
        protected override void OnPaint(PaintEventArgs e) {
            base.OnPaint(e);
            Bitmap image=settings.DisplayImage;
            if(image==null||ClientSize.Width<=0||ClientSize.Height<=0)return;
            e.Graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;
            e.Graphics.DrawImage(image,settings.Crop.Bounds(image.Width,image.Height,ClientSize.Width,ClientSize.Height),new RectangleF(0,0,image.Width,image.Height),GraphicsUnit.Pixel);
        }
        internal void UpdateForTarget(bool changed) {
            Rectangle rect=Native.ClientBounds(Target);
            if(settings.Image==null||settings.Opacity<=0||!Native.CanShow(Target)||rect.Width<300||rect.Height<200) { if(Visible)Hide(); return; }
            bool blocked=false; IntPtr foreground=Native.GetForegroundWindow();
            // Native file pickers and other owned dialogs stay undecorated.
            for(IntPtr owner=foreground; owner!=IntPtr.Zero&&owner!=Handle; owner=Native.GetWindow(owner,4)) {
                if(owner==Target){blocked=foreground!=Target;break;}
            }
            if(blocked) { if(Visible)Hide(); return; }
            if(Bounds!=rect)Bounds=rect;
            if(Opacity!=settings.Opacity)Opacity=settings.Opacity;
            if(changed)Invalidate();
            if(!Visible){Show(new OwnerHandle(Target));wasShown=true;}
            // Windows can hide an owned HWND without changing Form.Visible.
            if(!Native.IsWindowVisible(Handle))Native.ShowWindow(Handle,4); // SW_SHOWNOACTIVATE
            // Keep the layer directly above its app, below any window covering the app.
            // Never raise the owner or use a global topmost layer.
            if(Native.GetWindow(Handle,2)!=Target) {
                IntPtr previous=Native.GetWindow(Target,3);
                bool ownerTopmost=(Native.GetWindowLong(Target,-20)&8)!=0;
                if(previous!=IntPtr.Zero&&(Native.GetWindowLong(previous,-20)&8)!=0&&!ownerTopmost)previous=IntPtr.Zero;
                if(previous!=Handle)Native.SetWindowPos(Handle,previous,0,0,0,0,0x0213);
            }
        }
    }

    internal sealed class OverlayContext : ApplicationContext {
        private readonly string root;
        private readonly Func<List<IntPtr>> findTargets;
        private readonly Timer timer;
        private readonly Timer animationTimer;
        private readonly WindowEvents events;
        internal readonly WallpaperSettings Settings;
        internal readonly Dictionary<IntPtr,OverlayForm> Layers=new Dictionary<IntPtr,OverlayForm>();
        private DateTime lastState=DateTime.MinValue;
        private string lastError="";
        private bool updating, disposed;
        private int recoveries;
        private string lastTransition="", lastLog="";
        private DateTime lastLogAt=DateTime.MinValue;
        internal OverlayContext(string rootPath, Func<List<IntPtr>> targets) {
            root=rootPath; findTargets=targets; Settings=new WallpaperSettings(root);
            animationTimer=new Timer {Interval=67};animationTimer.Tick+=delegate{Animate();};
            timer=new Timer {Interval=350}; timer.Tick+=delegate { Tick(); }; timer.Start(); Tick();
            events=new WindowEvents(OnWindowEvent);
            if(!events.Active)Log("window events unavailable; using periodic scan");
        }
        private void OnWindowEvent(IntPtr handle,uint eventType) {
            if(disposed||updating)return;
            OverlayForm layer;
            if(!Layers.TryGetValue(handle,out layer)) {if(eventType==3)Tick();return;}
            if(!layer.IsCurrent){Tick();return;}
            updating=true;
            try {layer.UpdateForTarget(false);UpdateAnimationState();}
            catch(Exception error){RemoveLayer(handle);recoveries++;Log("window-event "+handle+": "+error.Message);}
            finally {updating=false;}
        }
        internal void Tick() {
            if(updating||disposed)return;
            updating=true;
            try {
                bool changed=Settings.Reload(); var targets=new HashSet<IntPtr>(findTargets());
                foreach(IntPtr handle in new List<IntPtr>(Layers.Keys))if(!targets.Contains(handle))RemoveLayer(handle);
                string windowError="";
                foreach(IntPtr handle in targets) {
                    try {
                        if(!Native.IsWindow(handle)){RemoveLayer(handle);continue;}
                        OverlayForm layer;
                        if(Layers.TryGetValue(handle,out layer)&&!layer.IsCurrent){RemoveLayer(handle);recoveries++;Log("recreated overlay for target "+handle);}
                        if(!Layers.TryGetValue(handle,out layer)){layer=new OverlayForm(handle,Settings);Layers.Add(handle,layer);}
                        layer.UpdateForTarget(changed);
                    }catch(Exception error){RemoveLayer(handle);windowError=error.Message;Log("window-update "+handle+": "+error.Message);}
                }
                if(Settings.Error!=lastError){lastError=Settings.Error;if(lastError.Length>0)Log(lastError);}
                UpdateAnimationState();
                if((DateTime.UtcNow-lastState).TotalSeconds>=1){WriteState(windowError);lastState=DateTime.UtcNow;}
            } catch(Exception error) { Log("scan: "+error.Message); }
            finally {updating=false;}
        }
        private void UpdateAnimationState() {
            bool visible=false;foreach(var layer in Layers.Values)if(layer.IsActuallyVisible){visible=true;break;}
            bool running=visible&&Settings.IsAnimated&&!Settings.Paused&&Settings.Opacity>0;
            Settings.SetAnimationRunning(running);animationTimer.Enabled=running;
        }
        private void Animate() {
            if(disposed||updating)return;
            updating=true;
            try {
                UpdateAnimationState();if(!animationTimer.Enabled||!Settings.AdvanceAnimation())return;
                foreach(var layer in Layers.Values)if(layer.IsActuallyVisible){layer.Invalidate();layer.Update();}
            }catch(Exception error){animationTimer.Stop();Settings.SetAnimationRunning(false);Log("animation: "+error.Message);}
            finally{updating=false;}
        }
        private void RemoveLayer(IntPtr handle) {
            OverlayForm layer;
            if(!Layers.TryGetValue(handle,out layer))return;
            Layers.Remove(handle);
            try {if(!layer.IsDisposed)layer.Dispose();}catch(Exception error){Log("dispose: "+error.Message);}
        }
        private void WriteState(string windowError) {
            int visible=0; foreach(var layer in Layers.Values)if(layer.IsActuallyVisible)visible++;
            string error=Settings.Error.Length>0?Settings.Error:windowError;
            string status=error.Length>0?"error":Settings.Image==null?"disabled":visible>0?"applied":"waiting";
            string transition=status+" targets="+Layers.Count+" visible="+visible+" image="+Settings.Name+" opacity="+Settings.Opacity;
            if(transition!=lastTransition){Log(transition);lastTransition=transition;}
            string message=status=="error"?"Bộ nạp đang thử khôi phục: "+error:status=="disabled"?"Hình nền đã tắt. Ảnh cá nhân vẫn được giữ trong thư viện.":status=="applied"?"Lớp ảnh đã hiện trên Codex. Lần sau mở app gốc, ảnh sẽ tự hiện.":"Bộ nạp đang chạy. Ảnh sẽ tự hiện khi cửa sổ Codex được mở hoặc khôi phục.";
            var state=new {mode="overlay",rendererVersion=5,status=status,message=message,pid=Process.GetCurrentProcess().Id,updatedAt=DateTime.UtcNow.ToString("o"),targetWindows=Layers.Count,visibleOverlays=visible,recoveries=recoveries,eventHooks=events!=null&&events.Active,kind=Settings.IsVideo?"video":Settings.IsGif?"gif":"image",videoFrames=Settings.VideoFrames,animationRunning=animationTimer.Enabled,animationFpsLimit=15,paused=Settings.Paused,strength=Settings.Opacity*100,image=Settings.Name};
            string temporary=Path.Combine(root,"overlay-state-"+Guid.NewGuid()+".tmp"),target=Path.Combine(root,"overlay-state.json");
            try { File.WriteAllText(temporary,new JavaScriptSerializer().Serialize(state),new UTF8Encoding(false)); if(File.Exists(target))File.Replace(temporary,target,null);else File.Move(temporary,target); }
            finally { if(File.Exists(temporary))File.Delete(temporary); }
        }
        private void Log(string message) {
            if(message==lastLog&&(DateTime.UtcNow-lastLogAt).TotalSeconds<10)return;
            lastLog=message;lastLogAt=DateTime.UtcNow;
            try {
                string path=Path.Combine(root,"overlay.log");
                if(File.Exists(path)&&new FileInfo(path).Length>2*1024*1024){string previous=Path.Combine(root,"overlay.previous.log");if(File.Exists(previous))File.Delete(previous);File.Move(path,previous);}
                File.AppendAllText(path,DateTime.UtcNow.ToString("o")+" "+message+Environment.NewLine);
            }catch { }
        }
        protected override void Dispose(bool disposing) {
            if(disposing){disposed=true;if(events!=null)events.Dispose();timer.Dispose();animationTimer.Dispose();foreach(IntPtr handle in new List<IntPtr>(Layers.Keys))RemoveLayer(handle);Settings.Dispose();}
            base.Dispose(disposing);
        }
    }

    internal static class TargetWindows {
        private static readonly Dictionary<uint,KeyValuePair<DateTime,bool>> Cache=new Dictionary<uint,KeyValuePair<DateTime,bool>>();
        internal static bool MainStyle(int style) { return (style&0x00040000)!=0&&(style&0x40000000)==0; }
        internal static bool OfficialPath(string path) {
            string basePath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"WindowsApps")+Path.DirectorySeparatorChar;
            if(!path.StartsWith(basePath+"OpenAI.Codex_",StringComparison.OrdinalIgnoreCase))return false;
            string relative=path.Substring(basePath.Length);string[] parts=relative.Split('\\');
            Version version;
            string[] package=parts[0].Split('_');
            return parts.Length==3&&parts[1].Equals("app",StringComparison.OrdinalIgnoreCase)&&parts[2].Equals("ChatGPT.exe",StringComparison.OrdinalIgnoreCase)&&package.Length==5&&Version.TryParse(package[1],out version)&&package[4]=="2p2nqsd0c76g0";
        }
        internal static List<IntPtr> Find() {
            var result=new List<IntPtr>();
            Native.EnumWindows(delegate(IntPtr handle,IntPtr parameter) {
                // Keep temporarily hidden main windows so hide/show does not churn layers.
                if(Native.GetWindow(handle,4)!=IntPtr.Zero)return true;
                var name=new StringBuilder(128);Native.GetClassName(handle,name,name.Capacity);
                if(name.ToString()!="Chrome_WidgetWin_1")return true;
                // Current Codex uses a captionless custom frame. Require resize support,
                // rather than WS_CAPTION, to include it while excluding small popovers.
                if(!MainStyle(Native.GetWindowLong(handle,-16)))return true;
                uint pid;Native.GetWindowThreadProcessId(handle,out pid);
                KeyValuePair<DateTime,bool> cached;
                if(!Cache.TryGetValue(pid,out cached)||(DateTime.UtcNow-cached.Key).TotalSeconds>5) {
                    cached=new KeyValuePair<DateTime,bool>(DateTime.UtcNow,OfficialPath(Native.ProcessPath(pid)));Cache[pid]=cached;
                }
                if(cached.Value)result.Add(handle);
                return true;
            },IntPtr.Zero);
            if(Cache.Count>256)Cache.Clear();
            return result;
        }
    }

    internal static class OverlayProgram {
        [STAThread] private static void Main(string[] args) {
            if(args.Length!=2||args[0]!="--root")return;
            string root=Path.GetFullPath(args[1]); Directory.CreateDirectory(root);
            string identity; using(var sha=System.Security.Cryptography.SHA256.Create())identity=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).Replace("-","");
            using(var mutex=new System.Threading.Mutex(false,"Local\\CodexWallpaperOverlay-"+identity)) {
                bool acquired=false;
                try { try {acquired=mutex.WaitOne(0);}catch(System.Threading.AbandonedMutexException){acquired=true;} if(!acquired)return;
                    Native.DpiAware(); Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);Application.EnableVisualStyles();
                    using(var context=new OverlayContext(root,TargetWindows.Find))Application.Run(context);
                } catch(Exception error) { Environment.ExitCode=1; File.AppendAllText(Path.Combine(root,"overlay.log"),DateTime.UtcNow.ToString("o")+" fatal "+error+Environment.NewLine); }
                finally {if(acquired)mutex.ReleaseMutex();}
            }
        }
    }
}
