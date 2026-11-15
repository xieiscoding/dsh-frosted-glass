param(
  [int]$OwnerPid = 0,
  [int]$HostPid = 0,
  [string]$OutDir = "$env:TEMP\dsh-desktop-glass",
  [int]$IntervalMs = 180,
  [double]$Scale = 0.5,
  [int]$MaxLayers = 4,
  [int]$Quality = 82
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class DshGlassHelper
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);
    [DllImport("shcore.dll")]
    private static extern int SetProcessDpiAwareness(int value);

    private class Win
    {
        public IntPtr H;
        public int L;
        public int T;
        public int R;
        public int B;
        public uint Pid;
        public string Cls = "";
        public string Title = "";
        public long Ex;
        public long Area { get { return (long)(R - L) * (long)(B - T); } }
    }

    private static Bitmap wallpaper;
    private static bool wallpaperTried;
    private static string logPath;
    private static readonly object logLock = new object();
    private static double statusFps;
    private static double statusScale;
    private static int statusPreMs;
    private static int statusWaitMs;

    private static double PickScale(int intervalMs)
    {
        double fps = 1000.0 / Math.Max(1, intervalMs);
        if (fps <= 10) return 0.5;
        if (fps <= 20) return 0.42;
        if (fps <= 35) return 0.35;
        if (fps <= 60) return 0.3;
        return 0.25;
    }

    public static void Init()
    {
        try { SetProcessDpiAwareness(2); } catch { }
    }

    public static void Run(int ownerPid, int hostPid, string outDir, int intervalMs, double scale, int maxLayers, int quality)
    {
        Init();
        Directory.CreateDirectory(outDir);
        logPath = Path.Combine(outDir, "helper.log");
        AcquireLock(outDir);
        Log("helper start pid=" + Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture) + " owner=" + ownerPid.ToString(CultureInfo.InvariantCulture) + " host=" + hostPid.ToString(CultureInfo.InvariantCulture) + " out=" + outDir);
        string statePath = Path.Combine(outDir, "state.json");
        string controlPath = Path.Combine(outDir, "control.json");
        DeleteOldFrames(outDir);
        int rev = 0;
        string lastHash = "";
        bool first = true;
        bool lastEnabled = true;
        string lastStatus = "";
        double measuredFps = 0;
        long fpsWindowStart = Environment.TickCount;
        int fpsWindowFrames = 0;
        long lastStateAt = 0;
        try
        {
            while (true)
            {
                if (ownerPid > 0 && !ProcessAlive(ownerPid))
                {
                    Log("owner process exited; stopping");
                    break;
                }
                if (hostPid > 0 && !ProcessAlive(hostPid))
                {
                    Log("host process exited; stopping");
                    break;
                }
                bool enabled = true;
                bool adaptive = true;
                bool stop = false;
                int interval = intervalMs;
                ReadControl(controlPath, ref enabled, ref adaptive, ref interval, ref stop);
                if (stop)
                {
                    Log("stop requested");
                    break;
                }
                if (!enabled)
                {
                    if (lastEnabled || lastStatus != "disabled") WriteState(statePath, "disabled", rev, "", 0, 0, null, 0, false, false, "");
                    lastEnabled = false;
                    lastStatus = "disabled";
                    Thread.Sleep(400);
                    continue;
                }
                lastEnabled = true;

                IntPtr fg;
                int preStarted = Environment.TickCount;
                List<Win> windows = Enumerate(out fg);
                IntPtr dsh = FindDshWindow(ownerPid, windows);
                if (dsh == IntPtr.Zero)
                {
                    if (lastStatus != "window-missing") WriteState(statePath, "window-missing", rev, "", 0, 0, null, 0, false, false, "");
                    lastStatus = "window-missing";
                    Thread.Sleep(700);
                    continue;
                }
                RECT client;
                if (!GetClientRect(dsh, out client) || client.Right <= 0 || client.Bottom <= 0)
                {
                    if (lastStatus != "window-missing") WriteState(statePath, "window-missing", rev, "", 0, 0, null, 0, false, false, "");
                    lastStatus = "window-missing";
                    Thread.Sleep(700);
                    continue;
                }
                bool focused = fg == dsh || ForegroundBelongsTo(fg, ownerPid);
                statusPreMs = Environment.TickCount - preStarted;
                bool occluded = false;
                if (!focused) occluded = IsCovered(windows, dsh, fg, client);
                if (adaptive && occluded)
                {
                    if (lastStatus != "occluded") WriteState(statePath, "occluded", rev, "", 0, 0, null, 0, false, true, "");
                    lastStatus = "occluded";
                    Thread.Sleep(500);
                    continue;
                }

                long started = Environment.TickCount;
                double effectiveScale = scale > 0 ? scale : PickScale(interval);
                statusScale = effectiveScale;
                statusFps = measuredFps;
                string hash;
                string info;
                int width;
                int height;
                int layers;
                string file;
                try
                {
                    file = "frame-" + (rev + 1).ToString(CultureInfo.InvariantCulture) + ".jpg";
                    string path = Path.Combine(outDir, file);
                    Capture(dsh, windows, fg, path, effectiveScale, maxLayers, quality, out hash, out info, out width, out height, out layers);
                }
                catch (Exception error)
                {
                    Log("capture failed: " + error.ToString());
                    WriteState(statePath, "error", rev, "", 0, 0, null, 0, focused, false, error.Message);
                    lastStatus = "error";
                    Thread.Sleep(900);
                    continue;
                }
                long elapsed = Environment.TickCount - started;
                fpsWindowFrames++;
                long fpsNow = Environment.TickCount;
                if (fpsNow - fpsWindowStart >= 1000)
                {
                    measuredFps = fpsWindowFrames * 1000.0 / Math.Max(1, fpsNow - fpsWindowStart);
                    fpsWindowFrames = 0;
                    fpsWindowStart = fpsNow;
                    statusFps = measuredFps;
                }
                bool changed = first || hash != lastHash;
                if (changed)
                {
                    rev = rev + 1;
                    lastHash = hash;
                    first = false;
                    PruneFrames(outDir, rev);
                }
                string stateFile = changed ? file : "frame-" + rev.ToString(CultureInfo.InvariantCulture) + ".jpg";
                if (!changed && !File.Exists(Path.Combine(outDir, stateFile)))
                {
                    stateFile = file;
                    changed = true;
                    rev = rev + 1;
                    PruneFrames(outDir, rev);
                }
                int stateNow = Environment.TickCount;
                if (changed || lastStatus != "live" || stateNow - lastStateAt >= 400)
                {
                    WriteState(statePath, "live", rev, stateFile, width, height, info, (int)elapsed, focused, false, "");
                    lastStateAt = stateNow;
                }
                lastStatus = "live";

                int wait = interval;
                if (layers == 0) wait = Math.Max(wait, 900);
                wait = wait - (int)(Environment.TickCount - started);
                int minWait = 2;
                if (wait < minWait) wait = minWait;
                statusWaitMs = wait;
                Thread.Sleep(wait);
            }
        }
        finally
        {
            try { WriteState(statePath, "stopped", rev, "", 0, 0, null, 0, false, false, ""); } catch { }
            ReleaseLock(outDir);
            Log("helper exit");
        }
    }

    private static void AcquireLock(string outDir)
    {
        try
        {
            string lockPath = Path.Combine(outDir, "helper.lock");
            if (File.Exists(lockPath))
            {
                int previous;
                if (Int32.TryParse(File.ReadAllText(lockPath).Trim(), out previous) && previous != Process.GetCurrentProcess().Id)
                {
                    try
                    {
                        using (Process stale = Process.GetProcessById(previous)) stale.Kill();
                    }
                    catch { }
                }
            }
            File.WriteAllText(lockPath, Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture));
        }
        catch { }
    }

    private static void ReleaseLock(string outDir)
    {
        try
        {
            string lockPath = Path.Combine(outDir, "helper.lock");
            if (File.Exists(lockPath) && File.ReadAllText(lockPath).Trim() == Process.GetCurrentProcess().Id.ToString(CultureInfo.InvariantCulture)) File.Delete(lockPath);
        }
        catch { }
    }

    private static void Capture(IntPtr dsh, List<Win> windows, IntPtr fg, string path, double scale, int maxLayers, int quality,
        out string hash, out string info, out int outWidth, out int outHeight, out int layerCount)
    {
        long t0 = Environment.TickCount;
        RECT client;
        GetClientRect(dsh, out client);
        POINT origin = new POINT();
        origin.X = 0;
        origin.Y = 0;
        ClientToScreen(dsh, ref origin);
        int cw = client.Right - client.Left;
        int ch = client.Bottom - client.Top;
        if (cw <= 0 || ch <= 0) throw new InvalidOperationException("empty client rect");
        outWidth = Math.Max(1, (int)Math.Round(cw * scale));
        outHeight = Math.Max(1, (int)Math.Round(ch * scale));

        List<Win> behind = new List<Win>();
        int dshIndex = -1;
        for (int i = 0; i < windows.Count; i++) { if (windows[i].H == dsh) { dshIndex = i; break; } }
        if (dshIndex >= 0)
        {
            for (int i = dshIndex + 1; i < windows.Count && behind.Count < maxLayers; i++)
            {
                Win w = windows[i];
                if (w.Pid == windows[dshIndex].Pid) continue;
                if (!IsWindowVisible(w.H)) continue;
                if (IsIconic(w.H)) continue;
                if (!IsUsable(w)) continue;
                if (IsCloaked(w.H)) continue;
                if (w.R <= w.L || w.B <= w.T) continue;
                if (!Intersects(w, origin.X, origin.Y, cw, ch)) continue;
                w.Title = WindowTitle(w.H);
                behind.Add(w);
            }
        }

        using (Bitmap output = new Bitmap(outWidth, outHeight, PixelFormat.Format32bppPArgb))
        {
            using (Graphics g = Graphics.FromImage(output))
            {
                g.CompositingMode = CompositingMode.SourceOver;
                g.InterpolationMode = InterpolationMode.NearestNeighbor;
                g.PixelOffsetMode = PixelOffsetMode.Half;
                DrawWallpaper(g, outWidth, outHeight);
                for (int i = behind.Count - 1; i >= 0; i--)
                {
                    Win w = behind[i];
                    try { DrawWindow(g, w, origin, cw, ch, scale, outWidth, outHeight); }
                    catch (Exception e) { Log("draw window failed: " + w.Cls + " " + e.Message); }
                }
            }
            hash = HashBitmap(output);
            SaveJpeg(output, path, quality);
        }

        StringBuilder json = new StringBuilder();
        json.Append("{");
        json.Append("\"clientX\":").Append(origin.X).Append(",");
        json.Append("\"clientY\":").Append(origin.Y).Append(",");
        json.Append("\"clientW\":").Append(cw).Append(",");
        json.Append("\"clientH\":").Append(ch).Append(",");
        json.Append("\"layers\":[");
        layerCount = behind.Count;
        for (int i = 0; i < behind.Count; i++)
        {
            if (i > 0) json.Append(",");
            Win w = behind[i];
            json.Append("{\"title\":").Append(JsonString(w.Title)).Append(",\"class\":").Append(JsonString(w.Cls))
                .Append(",\"rect\":[").Append(w.L).Append(",").Append(w.T).Append(",").Append(w.R).Append(",").Append(w.B)
                .Append("],\"pid\":").Append(w.Pid).Append("}");
        }
        json.Append("]}");
        info = json.ToString();
    }

    private static void DrawWindow(Graphics g, Win w, POINT origin, int cw, int ch, double scale, int outWidth, int outHeight)
    {
        int left = Math.Max(w.L, origin.X);
        int top = Math.Max(w.T, origin.Y);
        int right = Math.Min(w.R, origin.X + cw);
        int bottom = Math.Min(w.B, origin.Y + ch);
        if (right <= left || bottom <= top) return;
        int ww = w.R - w.L;
        int wh = w.B - w.T;
        if (ww <= 0 || wh <= 0 || ww > 20000 || wh > 20000) return;
        int shotW = Math.Max(1, (int)Math.Round(ww * scale));
        int shotH = Math.Max(1, (int)Math.Round(wh * scale));
        int dx = (int)Math.Round((left - origin.X) * scale);
        int dy = (int)Math.Round((top - origin.Y) * scale);
        int dr = (int)Math.Round((right - origin.X) * scale);
        int db = (int)Math.Round((bottom - origin.Y) * scale);
        int dw = Math.Max(1, dr - dx);
        int dh = Math.Max(1, db - dy);
        int sx = (int)Math.Round((left - w.L) * scale);
        int sy = (int)Math.Round((top - w.T) * scale);
        int sr = Math.Min(shotW, (int)Math.Round((right - w.L) * scale));
        int sb = Math.Min(shotH, (int)Math.Round((bottom - w.T) * scale));
        int sw = Math.Max(1, sr - sx);
        int sh = Math.Max(1, sb - sy);
        using (Bitmap shot = new Bitmap(shotW, shotH, PixelFormat.Format32bppArgb))
        {
            using (Graphics sg = Graphics.FromImage(shot))
            {
                IntPtr hdc = sg.GetHdc();
                bool ok = PrintWindow(w.H, hdc, 2);
                sg.ReleaseHdc(hdc);
                if (!ok)
                {
                    hdc = sg.GetHdc();
                    PrintWindow(w.H, hdc, 0);
                    sg.ReleaseHdc(hdc);
                }
            }
            g.DrawImage(shot, new Rectangle(dx, dy, dw, dh), new Rectangle(sx, sy, sw, sh), GraphicsUnit.Pixel);
        }
    }

    private static Bitmap wallpaperScaled;
    private static int wallpaperScaledWidth;
    private static int wallpaperScaledHeight;

    private static void DrawWallpaper(Graphics g, int width, int height)
    {
        Bitmap prepared = GetScaledWallpaper(width, height);
        if (prepared != null)
        {
            g.DrawImageUnscaled(prepared, 0, 0);
        }
        else
        {
            using (SolidBrush brush = new SolidBrush(Color.FromArgb(38, 40, 46)))
            {
                g.FillRectangle(brush, 0, 0, width, height);
            }
        }
    }

    private static Bitmap GetScaledWallpaper(int width, int height)
    {
        if (wallpaperScaled != null && wallpaperScaledWidth == width && wallpaperScaledHeight == height) return wallpaperScaled;
        Bitmap wp = LoadWallpaper();
        if (wp == null) return null;
        double ratio = Math.Max((double)width / (double)wp.Width, (double)height / (double)wp.Height);
        int dw = Math.Max(1, (int)Math.Ceiling(wp.Width * ratio));
        int dh = Math.Max(1, (int)Math.Ceiling(wp.Height * ratio));
        Bitmap scaled = new Bitmap(width, height, PixelFormat.Format32bppPArgb);
        using (Graphics sg = Graphics.FromImage(scaled))
        {
            sg.InterpolationMode = InterpolationMode.HighQualityBilinear;
            sg.PixelOffsetMode = PixelOffsetMode.HighQuality;
            sg.DrawImage(wp, new Rectangle((width - dw) / 2, (height - dh) / 2, dw, dh));
        }
        if (wallpaperScaled != null) wallpaperScaled.Dispose();
        wallpaperScaled = scaled;
        wallpaperScaledWidth = width;
        wallpaperScaledHeight = height;
        return wallpaperScaled;
    }

    private static Bitmap LoadWallpaper()
    {
        if (wallpaperTried) return wallpaper;
        wallpaperTried = true;
        try
        {
            string path = null;
            using (Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey("Control Panel\\Desktop"))
            {
                if (key != null)
                {
                    object value = key.GetValue("WallPaper");
                    if (value != null) path = value.ToString();
                }
            }
            if (!String.IsNullOrEmpty(path) && File.Exists(path))
            {
                byte[] bytes = File.ReadAllBytes(path);
                using (MemoryStream stream = new MemoryStream(bytes))
                {
                    using (Bitmap loaded = new Bitmap(stream))
                    {
                        wallpaper = new Bitmap(loaded);
                    }
                }
                Log("wallpaper loaded " + path);
            }
        }
        catch (Exception e)
        {
            Log("wallpaper failed: " + e.Message);
            wallpaper = null;
        }
        return wallpaper;
    }

    private static bool IsUsable(Win w)
    {
        if ((w.Ex & 0x80) != 0) return false;
        string cls = w.Cls;
        if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd") return false;
        if (cls == "Windows.UI.Core.CoreWindow") return false;
        if (cls == "ApplicationFrameWindow" && String.IsNullOrEmpty(w.Title)) return false;
        if (cls == "MSCTFIME UI" || cls == "IME") return false;
        if (cls == "CEF-OSC-WIDGET") return false;
        if (cls == "Windows Input Experience") return false;
        return true;
    }

    private static bool Intersects(Win w, int x, int y, int width, int height)
    {
        return w.R > x && w.L < x + width && w.B > y && w.T < y + height;
    }

    private static bool IsCovered(List<Win> windows, IntPtr dsh, IntPtr fg, RECT client)
    {
        if (fg == IntPtr.Zero || fg == dsh) return false;
        int dshIndex = -1;
        int fgIndex = -1;
        for (int i = 0; i < windows.Count; i++)
        {
            if (windows[i].H == dsh) dshIndex = i;
            if (windows[i].H == fg) fgIndex = i;
        }
        if (fgIndex < 0 || dshIndex < 0 || fgIndex > dshIndex) return false;
        Win w = windows[fgIndex];
        if (!IsWindowVisible(w.H) || IsIconic(w.H)) return false;
        POINT origin = new POINT();
        origin.X = 0;
        origin.Y = 0;
        ClientToScreen(dsh, ref origin);
        int cw = client.Right - client.Left;
        int ch = client.Bottom - client.Top;
        int ix = Math.Max(w.L, origin.X);
        int iy = Math.Max(w.T, origin.Y);
        int ir = Math.Min(w.R, origin.X + cw);
        int ib = Math.Min(w.B, origin.Y + ch);
        if (ir <= ix || ib <= iy) return false;
        long covered = (long)(ir - ix) * (long)(ib - iy);
        long total = (long)cw * (long)ch;
        return covered * 100 >= total * 96;
    }

    private static bool ForegroundBelongsTo(IntPtr fg, int ownerPid)
    {
        if (fg == IntPtr.Zero || ownerPid <= 0) return false;
        uint pid;
        GetWindowThreadProcessId(fg, out pid);
        return pid == (uint)ownerPid;
    }

    private static List<Win> Enumerate(out IntPtr foreground)
    {
        foreground = GetForegroundWindow();
        List<Win> list = new List<Win>();
        EnumWindows(delegate(IntPtr h, IntPtr l)
        {
            Win w = new Win();
            w.H = h;
            uint pid;
            GetWindowThreadProcessId(h, out pid);
            w.Pid = pid;
            StringBuilder cls = new StringBuilder(256);
            GetClassName(h, cls, 256);
            w.Cls = cls.ToString();
            w.Ex = GetWindowLongPtr(h, -20).ToInt64();
            RECT r;
            if (GetWindowRect(h, out r))
            {
                w.L = r.Left;
                w.T = r.Top;
                w.R = r.Right;
                w.B = r.Bottom;
            }
            list.Add(w);
            return true;
        }, IntPtr.Zero);
        return list;
    }

    private static string WindowTitle(IntPtr h)
    {
        StringBuilder title = new StringBuilder(512);
        GetWindowText(h, title, 512);
        return title.ToString();
    }

    private static IntPtr FindDshWindow(int ownerPid, List<Win> windows)
    {
        IntPtr best = IntPtr.Zero;
        long bestArea = 0;
        if (ownerPid > 0)
        {
            foreach (Win w in windows)
            {
                if (w.Pid != (uint)ownerPid) continue;
                if (w.Cls != "Chrome_WidgetWin_1") continue;
                if (!IsWindowVisible(w.H) || IsIconic(w.H)) continue;
                if (w.Area <= 100000) continue;
                if (w.Area > bestArea) { best = w.H; bestArea = w.Area; }
            }
        }
        if (best != IntPtr.Zero) return best;
        foreach (Win w in windows)
        {
            if (w.Cls != "Chrome_WidgetWin_1") continue;
            if (!IsWindowVisible(w.H) || IsIconic(w.H)) continue;
            if (w.Area <= 100000) continue;
            string title = WindowTitle(w.H);
            if (title != null && title.EndsWith("DeepSeek Harness", StringComparison.Ordinal))
            {
                if (w.Area > bestArea) { best = w.H; bestArea = w.Area; }
            }
        }
        return best;
    }

    private static bool IsCloaked(IntPtr h)
    {
        try
        {
            int value;
            int rc = DwmGetWindowAttribute(h, 14, out value, 4);
            return rc == 0 && value != 0;
        }
        catch { return false; }
    }

    private static string HashBitmap(Bitmap source)
    {
        using (Bitmap small = new Bitmap(32, 18, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(small))
            {
                g.InterpolationMode = InterpolationMode.Bilinear;
                g.PixelOffsetMode = PixelOffsetMode.Half;
                g.DrawImage(source, 0, 0, 32, 18);
            }
            BitmapData data = small.LockBits(new Rectangle(0, 0, 32, 18), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            try
            {
                int stride = data.Stride;
                byte[] buffer = new byte[stride * 18];
                Marshal.Copy(data.Scan0, buffer, 0, buffer.Length);
                ulong hash = 1469598103934665603UL;
                for (int i = 0; i < buffer.Length; i++)
                {
                    hash ^= buffer[i];
                    hash *= 1099511628211UL;
                }
                return hash.ToString("x16", CultureInfo.InvariantCulture);
            }
            finally
            {
                small.UnlockBits(data);
            }
        }
    }

    private static void SaveJpeg(Bitmap bitmap, string path, int quality)
    {
        ImageCodecInfo codec = null;
        foreach (ImageCodecInfo info in ImageCodecInfo.GetImageEncoders())
        {
            if (info.FormatID == ImageFormat.Jpeg.Guid) { codec = info; break; }
        }
        if (codec == null)
        {
            bitmap.Save(path, ImageFormat.Jpeg);
            return;
        }
        using (EncoderParameters parameters = new EncoderParameters(1))
        {
            parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
            bitmap.Save(path, codec, parameters);
        }
    }

    private static int ReadRev(string statePath)
    {
        try
        {
            if (!File.Exists(statePath)) return 0;
            string text = File.ReadAllText(statePath);
            int index = text.IndexOf("\"rev\":", StringComparison.Ordinal);
            if (index < 0) return 0;
            int start = index + 6;
            int end = start;
            while (end < text.Length && (Char.IsDigit(text[end]) || text[end] == '-')) end++;
            int rev;
            if (Int32.TryParse(text.Substring(start, end - start), out rev)) return Math.Max(0, rev);
        }
        catch { }
        return 0;
    }

    private static void DeleteOldFrames(string outDir)
    {
        try
        {
            foreach (string file in Directory.GetFiles(outDir, "frame-*.jpg")) File.Delete(file);
        }
        catch { }
    }

    private static void PruneFrames(string outDir, int rev)
    {
        try
        {
            foreach (string file in Directory.GetFiles(outDir, "frame-*.jpg"))
            {
                string name = Path.GetFileNameWithoutExtension(file);
                int dash = name.LastIndexOf('-');
                int value;
                if (dash > 0 && Int32.TryParse(name.Substring(dash + 1), out value))
                {
                    if (value < rev - 2) File.Delete(file);
                }
            }
        }
        catch { }
    }

    private static void ReadControl(string controlPath, ref bool enabled, ref bool adaptive, ref int interval, ref bool stop)
    {
        try
        {
            if (!File.Exists(controlPath)) return;
            string text = File.ReadAllText(controlPath);
            if (text.IndexOf("\"enabled\":true", StringComparison.Ordinal) >= 0) enabled = true;
            if (text.IndexOf("\"enabled\":false", StringComparison.Ordinal) >= 0) enabled = false;
            if (text.IndexOf("\"adaptive\":false", StringComparison.Ordinal) >= 0) adaptive = false;
            if (text.IndexOf("\"adaptive\":true", StringComparison.Ordinal) >= 0) adaptive = true;
            if (text.IndexOf("\"stop\":true", StringComparison.Ordinal) >= 0) stop = true;
            int index = text.IndexOf("\"intervalMs\":", StringComparison.Ordinal);
            if (index >= 0)
            {
                int start = index + 13;
                int end = start;
                while (end < text.Length && Char.IsDigit(text[end])) end++;
                int value;
                if (Int32.TryParse(text.Substring(start, end - start), out value) && value >= 8 && value <= 2000) interval = value;
            }
        }
        catch { }
    }

    private static bool ProcessAlive(int pid)
    {
        try
        {
            using (Process process = Process.GetProcessById(pid)) return !process.HasExited;
        }
        catch { return false; }
    }

    private static void WriteState(string statePath, string status, int rev, string file, int width, int height,
        string info, int captureMs, bool focused, bool occluded, string error)
    {
        try
        {
            StringBuilder json = new StringBuilder();
            json.Append("{\"ok\":").Append(status == "live" ? "true" : "false");
            json.Append(",\"status\":").Append(JsonString(status));
            json.Append(",\"rev\":").Append(rev);
            json.Append(",\"file\":").Append(JsonString(file));
            json.Append(",\"width\":").Append(width);
            json.Append(",\"height\":").Append(height);
            json.Append(",\"captureMs\":").Append(captureMs);
            json.Append(",\"focused\":").Append(focused ? "true" : "false");
            json.Append(",\"occluded\":").Append(occluded ? "true" : "false");
            json.Append(",\"ts\":").Append(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            json.Append(",\"error\":").Append(error == null || error.Length == 0 ? "null" : JsonString(error));
            if (statusFps > 0) json.Append(",\"fps\":").Append(statusFps.ToString("0.#", CultureInfo.InvariantCulture));
            if (statusScale > 0) json.Append(",\"scale\":").Append(statusScale.ToString("0.##", CultureInfo.InvariantCulture));
            json.Append(",\"preMs\":").Append(statusPreMs);
            json.Append(",\"waitMs\":").Append(statusWaitMs);
            if (info != null && info.Length > 0)
            {
                string trimmed = info.TrimStart('{');
                json.Append(",").Append(trimmed);
            }
            else
            {
                json.Append(",\"layers\":[]}");
            }
            string text = json.ToString();
            string temp = statePath + ".tmp";
            File.WriteAllText(temp, text, new UTF8Encoding(false));
            if (File.Exists(statePath))
            {
                try { File.Replace(temp, statePath, null); }
                catch { File.Copy(temp, statePath, true); File.Delete(temp); }
            }
            else
            {
                File.Move(temp, statePath);
            }
        }
        catch (Exception e)
        {
            Log("state write failed: " + e.Message);
        }
    }

    private static string JsonString(string value)
    {
        if (value == null) return "null";
        StringBuilder sb = new StringBuilder();
        sb.Append("\"");
        for (int i = 0; i < value.Length; i++)
        {
            char c = value[i];
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 32) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else sb.Append(c);
                    break;
            }
        }
        sb.Append("\"");
        return sb.ToString();
    }

    private static void Log(string message)
    {
        try
        {
            if (logPath == null) return;
            lock (logLock)
            {
                string line = DateTime.Now.ToString("HH:mm:ss.fff", CultureInfo.InvariantCulture) + " " + message + Environment.NewLine;
                File.AppendAllText(logPath, line, Encoding.UTF8);
            }
        }
        catch { }
    }
}
'@

[DshGlassHelper]::Run($OwnerPid, $HostPid, $OutDir, $IntervalMs, $Scale, $MaxLayers, $Quality)
