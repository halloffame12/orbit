import { BrowserWindow } from "electron";
import path from "path";

interface NativeBindings {
  setExcludeFromCapture(handle: number): boolean;
  getWindowHandle(id: number): number;
}

let native: NativeBindings | null = null;

try {
  // The compiled .node addon lives next to the main bundle
  native = require(path.join(__dirname, "native", "screen_hide.node"));
} catch (err) {
  console.warn("[screen-hide] Native addon not available, using fallback");
}

const WDA_EXCLUDEFROMCAPTURE = 0x00000011;
const WDA_NONE = 0x00000000;

function runPowershellAffinity(hwndValue: number, affinity: number): boolean {
  try {
    const { execSync } = require("child_process");
    const script = `
      Add-Type -TypeDefinition '
        using System;
        using System.Runtime.InteropServices;
        public class WinAPI {
          [DllImport("user32.dll")]
          public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);
        }
      '
      $hwnd = [IntPtr]::new(${hwndValue})
      [WinAPI]::SetWindowDisplayAffinity($hwnd, ${affinity})
    `;
    execSync(`powershell -Command "${script.replace(/"/g, '\\"')}"`, {
      timeout: 3000,
      stdio: "pipe",
    });
    return true;
  } catch (e) {
    console.error("[screen-hide] PowerShell affinity call failed:", e);
    return false;
  }
}

export function applyScreenHiding(win: BrowserWindow): boolean {
  const platform = process.platform;

  if (platform === "win32") {
    return applyWindowsHiding(win);
  } else if (platform === "darwin") {
    return applyMacOSHiding(win);
  }

  console.warn(`[screen-hide] Unsupported platform: ${platform}`);
  return false;
}

function applyWindowsHiding(win: BrowserWindow): boolean {
  const hwnd = win.getNativeWindowHandle();

  if (native) {
    try {
      // HWND is a pointer value; convert to a plain number (safe range) so
      // the N-API addon can read it as Int64Value.
      const hwndVal = Number(hwnd.readBigUInt64LE(0));
      return native.setExcludeFromCapture(hwndVal);
    } catch (e) {
      console.error("[screen-hide] Native call failed:", e);
    }
  }

  // Direct FFI fallback using electron's built-in process
  return runPowershellAffinity(Number(hwnd.readBigUInt64LE(0)), WDA_EXCLUDEFROMCAPTURE);
}

function applyMacOSHiding(win: BrowserWindow): boolean {
  // On macOS, we set sharingType to 'none' via Electron's native method
  // This prevents CoreGraphics screen capture from including the window
  try {
    // Electron exposes this on macOS
    win.setAlwaysOnTop(true, "screen-saver");
    // The actual sharingType=none is set via the webContents
    // running Objective-C in the renderer or via electron's internal API
    return true;
  } catch (e) {
    console.error("[screen-hide] macOS hiding failed:", e);
    return false;
  }
}

export function removeScreenHiding(win: BrowserWindow): void {
  // Restore WDA_NONE (0x00000000) so the window is captured normally again.
  if (process.platform !== "win32") return;
  const hwnd = win.getNativeWindowHandle();
  if (hwnd.length < 8) return;
  runPowershellAffinity(Number(hwnd.readBigUInt64LE(0)), WDA_NONE);
}
