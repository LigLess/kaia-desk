$src = @"
using System; using System.Runtime.InteropServices; using System.Text;
public class IslFs {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  public struct RECT { public int L, T, R, B; }
  public static int Check() {
    IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return 0;
    StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, 256); string c = sb.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "XamlExplorerHostIslandWindow") return 0;
    RECT r; if (!GetWindowRect(h, out r)) return 0;
    int w = GetSystemMetrics(0), hh = GetSystemMetrics(1);
    return (r.L <= 0 && r.T <= 0 && r.R >= w && r.B >= hh) ? 1 : 0;
  }
}
"@
Add-Type -TypeDefinition $src
while ($true) { [Console]::Out.WriteLine([IslFs]::Check()); [Console]::Out.Flush(); Start-Sleep -Milliseconds 1500 }
