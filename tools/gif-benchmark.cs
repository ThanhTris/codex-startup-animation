using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Threading;
using System.Web.Script.Serialization;

// Experimental CPU/GDI+ decoder and full-resolution render test, not an installed GIF player.
// All draws target an in-memory 1920x1080 bitmap. DWM/GPU composition is not measured.
internal static class GifBenchmark {
    private static void Render(Image source,Graphics graphics,Rectangle destination,int frame,int count) {
        if(count>1)source.SelectActiveFrame(FrameDimension.Time,frame%count);
        double scale=Math.Max((double)destination.Width/source.Width,(double)destination.Height/source.Height);
        float width=(float)(destination.Width/scale),height=(float)(destination.Height/scale);
        graphics.DrawImage(source,destination,new RectangleF((source.Width-width)/2,(source.Height-height)/2,width,height),GraphicsUnit.Pixel);
        graphics.Flush(FlushIntention.Sync);
    }
    private static void Run(Image source,Graphics graphics,Rectangle destination,int count,int fps,double seconds,List<double> timings,out int skipped) {
        skipped=0;var clock=Stopwatch.StartNew();long previousSlot=-1;
        while(clock.Elapsed.TotalSeconds<seconds) {
            if(fps==0){Thread.Sleep(20);continue;}
            long slot=(long)(clock.Elapsed.TotalSeconds*fps);
            if(slot<=previousSlot){Thread.Sleep(1);continue;}
            if(previousSlot>=0&&slot>previousSlot+1)skipped+=(int)(slot-previousSlot-1);
            // The input has 30ms frames; cap redraws without slowing its playback timeline.
            int frame=(int)(clock.Elapsed.TotalMilliseconds/30)%count;
            long started=Stopwatch.GetTimestamp();Render(source,graphics,destination,frame,count);
            if(timings!=null)timings.Add((Stopwatch.GetTimestamp()-started)*1000.0/Stopwatch.Frequency);
            previousSlot=slot;
        }
    }
    private static int Main(string[] args) {
        try {
            string path=args[0];int fps=Int32.Parse(args[1]);double seconds=Double.Parse(args[2],System.Globalization.CultureInfo.InvariantCulture);
            var startup=Stopwatch.StartNew();
            using(var stream=new MemoryStream(File.ReadAllBytes(path),false))
            using(var image=Image.FromStream(stream,true,true))
            using(var surface=new Bitmap(1920,1080,PixelFormat.Format32bppPArgb))
            using(var graphics=Graphics.FromImage(surface))
            using(var process=Process.GetCurrentProcess()) {
                int count=Array.Exists(image.FrameDimensionsList,value=>value==FrameDimension.Time.Guid)?image.GetFrameCount(FrameDimension.Time):1;
                string quality=args.Length>3?args[3]:"HighQualityBicubic";
                graphics.InterpolationMode=(InterpolationMode)Enum.Parse(typeof(InterpolationMode),quality);
                graphics.Clear(Color.FromArgb(21,21,26));var destination=new Rectangle(0,0,1920,1080);
                Render(image,graphics,destination,0,count);double loadMs=startup.Elapsed.TotalMilliseconds;
                int ignored;Run(image,graphics,destination,count,fps,1,null,out ignored);
                process.Refresh();double privateBefore=process.PrivateMemorySize64/1048576.0,workingBefore=process.WorkingSet64/1048576.0;
                TimeSpan cpuBefore=process.TotalProcessorTime;var timings=new List<double>();
                var wall=Stopwatch.StartNew();int skipped;Run(image,graphics,destination,count,fps,seconds,timings,out skipped);wall.Stop();
                process.Refresh();double cpuMs=(process.TotalProcessorTime-cpuBefore).TotalMilliseconds;
                double sum=0;foreach(double value in timings)sum+=value;timings.Sort();
                double p95=timings.Count==0?0:timings[Math.Min(timings.Count-1,(int)Math.Ceiling(timings.Count*.95)-1)];
                bool pixelsChanged=false;
                if(count>1){image.SelectActiveFrame(FrameDimension.Time,0);using(var first=new Bitmap(image)){image.SelectActiveFrame(FrameDimension.Time,count/2);using(var next=new Bitmap(image)){for(int y=0;y<image.Height&&!pixelsChanged;y+=Math.Max(1,image.Height/12))for(int x=0;x<image.Width;x+=Math.Max(1,image.Width/12))if(first.GetPixel(x,y)!=next.GetPixel(x,y)){pixelsChanged=true;break;}}}}
                Console.WriteLine(new JavaScriptSerializer().Serialize(new {file=Path.GetFileName(path),interpolation=quality,sourceWidth=image.Width,sourceHeight=image.Height,frameCount=count,frameChangesVerified=pixelsChanged,targetWidth=1920,targetHeight=1080,targetFps=fps,seconds=wall.Elapsed.TotalSeconds,renderedFrames=timings.Count,effectiveFps=timings.Count/wall.Elapsed.TotalSeconds,skippedRenderSlots=skipped,cpuPercentOfMachine=cpuMs/wall.Elapsed.TotalMilliseconds/Environment.ProcessorCount*100,workingSetMiB=process.WorkingSet64/1048576.0,privateMiB=process.PrivateMemorySize64/1048576.0,peakWorkingSetMiB=process.PeakWorkingSet64/1048576.0,workingSetBeforeMiB=workingBefore,privateBeforeMiB=privateBefore,meanRenderMs=timings.Count==0?0:sum/timings.Count,p95RenderMs=p95,loadAndFirstDrawMs=loadMs,logicalProcessors=Environment.ProcessorCount}));
            }
            return 0;
        }catch(Exception error){Console.Error.WriteLine(error);return 1;}
    }
}
