param (
    [Parameter(Mandatory=$false)]
    [string]$Target = ""
)
if (-not $Target) { $Target = Join-Path (Split-Path $PSScriptRoot -Parent) 'data' }

Add-Type @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class ForegroundFolderOpener {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    private static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    const uint DESKTOP_ALL_ACCESS = 0x01FF;

    public static int OpenAndFocus(string target) {
        bool hasExt = Path.HasExtension(target);
        bool fileExists = File.Exists(target);
        string folder = hasExt ? Path.GetDirectoryName(target) : target;
        if (!Directory.Exists(folder)) {
            try { Directory.CreateDirectory(folder); } catch {}
        }

        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"WinSta0\Default";
        si.wShowWindow = 1;
        si.dwFlags = 1;

        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        string cmd = fileExists 
            ? string.Format("explorer.exe /select,\"{0}\"", target)
            : string.Format("explorer.exe \"{0}\"", folder);

        bool success = CreateProcess(
            @"C:\Windows\explorer.exe",
            cmd,
            IntPtr.Zero,
            IntPtr.Zero,
            false,
            0,
            IntPtr.Zero,
            folder,
            ref si,
            out pi
        );

        if (!success) {
            return -Marshal.GetLastWin32Error();
        }

        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);

        // Give Explorer a moment to register window
        System.Threading.Thread.Sleep(700);

        // Bring the window to foreground on Default desktop
        IntPtr hDesk = OpenDesktop("Default", 0, false, DESKTOP_ALL_ACCESS);
        if (hDesk != IntPtr.Zero) {
            string folderName = Path.GetFileName(folder.TrimEnd('\\', '/'));
            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.IndexOf(folderName, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    title.IndexOf("data", StringComparison.OrdinalIgnoreCase) >= 0) {
                    ShowWindow(hWnd, 9); // SW_RESTORE
                    BringWindowToTop(hWnd);
                    SetForegroundWindow(hWnd);
                    return false; // Stop enumerating
                }
                return true;
            }, IntPtr.Zero);

            CloseDesktop(hDesk);
        }

        return pi.dwProcessId;
    }
}
"@ -ErrorAction SilentlyContinue

$res = [ForegroundFolderOpener]::OpenAndFocus($Target)
Write-Output "Folder/file opened and brought to front! Target: $Target PID: $res"
