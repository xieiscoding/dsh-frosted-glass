param(
  [int]$OwnerPid = 0
)
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class DshGlassWindowProbe
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

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
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    public static string Probe(uint pid)
    {
        IntPtr best = IntPtr.Zero;
        long bestArea = 0;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (pid != 0 && windowPid != pid) return true;
            StringBuilder cls = new StringBuilder(128);
            GetClassName(hWnd, cls, 128);
            if (cls.ToString() != "Chrome_WidgetWin_1") return true;
            StringBuilder title = new StringBuilder(256);
            GetWindowText(hWnd, title, 256);
            string windowTitle = title.ToString();
            if (windowTitle.Contains("Developer Tools")) return true;
            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) return true;
            long area = (long)(rect.Right - rect.Left) * (long)(rect.Bottom - rect.Top);
            if (area <= 100000) return true;
            if (area > bestArea) { best = hWnd; bestArea = area; }
            return true;
        }, IntPtr.Zero);
        if (best == IntPtr.Zero) return "{\"found\":false,\"native\":false}";
        long ex = GetWindowLongPtr(best, -20).ToInt64();
        bool layered = (ex & 0x80000L) != 0;
        bool noRedirection = (ex & 0x200000L) != 0;
        int backdrop = -1;
        try
        {
            int value;
            if (DwmGetWindowAttribute(best, 38, out value, 4) == 0) backdrop = value;
        }
        catch { }
        int build = Environment.OSVersion.Version.Build;
        bool acrylic = backdrop == 3 || (layered && build >= 22621);
        return "{\"found\":true,\"hwnd\":" + best.ToInt64().ToString() +
            ",\"exStyle\":" + ex.ToString() +
            ",\"layered\":" + (layered ? "true" : "false") +
            ",\"noRedirection\":" + (noRedirection ? "true" : "false") +
            ",\"backdropType\":" + backdrop.ToString() +
            ",\"build\":" + build.ToString() +
            ",\"native\":" + (acrylic ? "true" : "false") + "}";
    }
}
'@

$json = [DshGlassWindowProbe]::Probe([uint32]$OwnerPid)
$native = $false
try { $native = ($json | ConvertFrom-Json).native } catch {}
$transparency = $null
try {
  $personalize = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -ErrorAction Stop
  $transparency = $personalize.EnableTransparency
} catch {}
if ($transparency -ne 1) {
  $json = $json -replace '"native":true', '"native":false'
}
Write-Output $json
