#include <napi.h>

#ifdef _WIN32
#include <windows.h>
#include <dwmapi.h>

#pragma comment(lib, "dwmapi.lib")

// WDA_EXCLUDEFROMCAPTURE = 0x00000011
// Available on Windows 10 2004+ / Windows 11
#define WDA_EXCLUDEFROMCAPTURE 0x00000011

Napi::Value SetExcludeFromCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected window handle (number)")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Electron passes BrowserWindow handle as int64
  int64_t handleVal = info[0].As<Napi::Number>().Int64Value();
  HWND hwnd = reinterpret_cast<HWND>(handleVal);

  if (!IsWindow(hwnd)) {
    Napi::Error::New(env, "Invalid window handle").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Primary method: SetWindowDisplayAffinity
  // This removes the window from all DWM capture APIs including
  // Windows Graphics Capture, BitBlt, and DXGI Desktop Duplication.
  // Zoom, Google Meet, Teams — all use these APIs for screen sharing.
  BOOL result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);

  if (!result) {
    // Fallback: try the older WDA_MONITOR (0x00000002) which
    // renders black rectangles in captured regions instead
    result = SetWindowDisplayAffinity(hwnd, 0x00000002);

    if (!result) {
      DWORD err = GetLastError();
      std::string msg = "SetWindowDisplayAffinity failed, error: "
                       + std::to_string(err);
      Napi::Error::New(env, msg).ThrowAsJavaScriptException();
      return env.Undefined();
    }
  }

  return Napi::Boolean::New(env, true);
}

Napi::Value GetWindowHandle(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected integer window id")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  // Electron gives us the OS window ID via BrowserWindow.getNativeWindowHandle()
  // We interpret it here as a raw HWND for direct Win32 API calls
  double id = info[0].As<Napi::Number>().DoubleValue();
  HWND hwnd = reinterpret_cast<HWND>(static_cast<intptr_t>(id));

  return Napi::Number::New(env, static_cast<double>(
      reinterpret_cast<intptr_t>(hwnd)));
}

// Stub implementations for non-Windows builds
Napi::Value SetExcludeFromCaptureMac(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  // macOS handled via Electron's sharingType in main process
  return Napi::Boolean::New(env, false);
}

#endif

Napi::Object Init(Napi::Env env, Napi::Object exports) {
#ifdef _WIN32
  exports.Set("setExcludeFromCapture",
    Napi::Function::New(env, SetExcludeFromCapture));
  exports.Set("getWindowHandle",
    Napi::Function::New(env, GetWindowHandle));
#else
  exports.Set("setExcludeFromCapture",
    Napi::Function::New(env, SetExcludeFromCaptureMac));
#endif
  return exports;
}

NODE_API_MODULE(screen_hide, Init)
