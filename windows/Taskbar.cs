using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

// Windows Shell application identity and relaunch metadata; does not alter Codex binaries.
public static class CodexWallpaperTaskbar {
    [StructLayout(LayoutKind.Sequential)] struct Key {
        public Guid fmtid; public uint pid;
        public Key(uint id) { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"); pid = id; }
    }
    [StructLayout(LayoutKind.Sequential)] struct Value {
        public ushort vt, r1, r2, r3; public IntPtr text, padding;
        public static Value From(string value) { return new Value { vt = 31, text = Marshal.StringToCoTaskMemUni(value) }; }
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Store {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out Key key);
        [PreserveSig] int GetValue(ref Key key, out Value value);
        [PreserveSig] int SetValue(ref Key key, ref Value value);
        [PreserveSig] int Commit();
    }
    [DllImport("shell32.dll", CharSet=CharSet.Unicode, PreserveSig=true)]
    static extern int SHGetPropertyStoreFromParsingName(string path, IntPtr context, uint flags, ref Guid iid, out Store store);
    [DllImport("shell32.dll", PreserveSig=true)]
    static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid iid, out Store store);
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref Value value);
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
    delegate bool WindowCallback(IntPtr hwnd, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    static Guid StoreId = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
    static void Set(Store store, uint id, string text) {
        var key = new Key(id); var value = Value.From(text);
        try { Marshal.ThrowExceptionForHR(store.SetValue(ref key, ref value)); }
        finally { PropVariantClear(ref value); }
    }
    static string Get(Store store, uint id) {
        var key = new Key(id); Value value;
        Marshal.ThrowExceptionForHR(store.GetValue(ref key, out value));
        try { return value.vt == 31 ? Marshal.PtrToStringUni(value.text) : null; }
        finally { PropVariantClear(ref value); }
    }
    public static void SetShortcutId(string path, string appId) {
        Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreFromParsingName(path, IntPtr.Zero, 2, ref StoreId, out store));
        try { Set(store, 5, appId); Marshal.ThrowExceptionForHR(store.Commit()); }
        finally { Marshal.ReleaseComObject(store); }
        SHChangeNotify(0x2000, 0x5, path, IntPtr.Zero);
    }
    public static void SetWindow(IntPtr hwnd, string appId, string command, string icon) {
        Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(hwnd, ref StoreId, out store));
        try {
            Set(store, 2, command); Set(store, 4, "Codex"); Set(store, 3, icon); Set(store, 5, appId);
        } finally { Marshal.ReleaseComObject(store); }
    }
    public static string WindowCommand(IntPtr hwnd) {
        Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(hwnd, ref StoreId, out store));
        try { return Get(store, 2); } finally { Marshal.ReleaseComObject(store); }
    }
    public static string WindowAppId(IntPtr hwnd) {
        Store store; Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(hwnd, ref StoreId, out store));
        try { return Get(store, 5); } finally { Marshal.ReleaseComObject(store); }
    }
    public static IntPtr[] Windows(uint pid) {
        var windows = new List<IntPtr>();
        EnumWindows((hwnd, p) => { uint owner; GetWindowThreadProcessId(hwnd, out owner); if (owner == pid && IsWindowVisible(hwnd)) windows.Add(hwnd); return true; }, IntPtr.Zero);
        return windows.ToArray();
    }
}
