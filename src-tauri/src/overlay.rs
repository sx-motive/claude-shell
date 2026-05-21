use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToastPayload {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    pub body: String,
    #[serde(default)]
    pub tab_id: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<u32>,
}

struct OverlayState {
    ready: bool,
    pending: Vec<ToastPayload>,
}

static OVERLAY_STATE: OnceLock<Mutex<OverlayState>> = OnceLock::new();

fn state() -> &'static Mutex<OverlayState> {
    OVERLAY_STATE.get_or_init(|| {
        Mutex::new(OverlayState {
            ready: false,
            pending: Vec::new(),
        })
    })
}

#[cfg(windows)]
fn is_fullscreen_foreground() -> bool {
    use std::mem::{size_of, zeroed};
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, GetWindowRect,
    };

    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }

        let mut class_buf = [0u16; 256];
        let n = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if n > 0 {
            let class_str = String::from_utf16_lossy(&class_buf[..n as usize]);
            if class_str == "Progman"
                || class_str == "WorkerW"
                || class_str.starts_with("Shell_")
            {
                return false;
            }
        }

        let mut rect: RECT = zeroed();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return false;
        }
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.is_null() {
            return false;
        }
        let mut mi: MONITORINFO = zeroed();
        mi.cbSize = size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut mi) == 0 {
            return false;
        }
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        let mw = mi.rcMonitor.right - mi.rcMonitor.left;
        let mh = mi.rcMonitor.bottom - mi.rcMonitor.top;
        w >= mw && h >= mh
    }
}

#[cfg(not(windows))]
fn is_fullscreen_foreground() -> bool {
    false
}

#[cfg(windows)]
fn show_no_activate(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOWNOACTIVATE};
    let Ok(raw) = window.hwnd() else { return };
    let hwnd = raw.0 as HWND;
    unsafe {
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

#[cfg(not(windows))]
fn show_no_activate(window: &tauri::WebviewWindow) {
    let _ = window.show();
}

static CURSOR_TRACKING_STARTED: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
fn cursor_pos() -> Option<(i32, i32)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
    let mut pt = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut pt) } == 0 {
        return None;
    }
    Some((pt.x, pt.y))
}

#[cfg(not(windows))]
fn cursor_pos() -> Option<(i32, i32)> {
    None
}

fn ensure_cursor_tracking(app: &AppHandle) {
    if CURSOR_TRACKING_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let mut last_inside = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(50));
            let Some(overlay) = app.get_webview_window("overlay") else {
                continue;
            };
            let visible = overlay.is_visible().unwrap_or(false);
            if !visible {
                if last_inside {
                    let _ = overlay.set_ignore_cursor_events(true);
                    last_inside = false;
                }
                continue;
            }
            let Some((cx, cy)) = cursor_pos() else { continue };
            let Ok(pos) = overlay.outer_position() else { continue };
            let Ok(size) = overlay.outer_size() else { continue };
            let inside = cx >= pos.x
                && cx < pos.x + size.width as i32
                && cy >= pos.y
                && cy < pos.y + size.height as i32;
            if inside != last_inside {
                let _ = overlay.set_ignore_cursor_events(!inside);
                last_inside = inside;
            }
        }
    });
}

fn position_top_right(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let Ok(win_size) = window.outer_size() else {
        return;
    };
    let scale = monitor.scale_factor();
    let margin = (16.0 * scale) as i32;
    let x =
        monitor_pos.x + monitor_size.width as i32 - win_size.width as i32 - margin;
    let y = monitor_pos.y + margin;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

#[tauri::command]
pub fn push_overlay_toast(app: AppHandle, payload: ToastPayload) -> Result<bool, String> {
    if is_fullscreen_foreground() {
        return Ok(false);
    }
    let overlay = app
        .get_webview_window("overlay")
        .ok_or_else(|| "overlay window missing".to_string())?;
    let _ = overlay.set_ignore_cursor_events(true);
    position_top_right(&overlay);
    show_no_activate(&overlay);
    let _ = overlay.set_always_on_top(true);
    ensure_cursor_tracking(&app);

    let ready = {
        let mut s = state().lock().unwrap();
        if s.ready {
            true
        } else {
            s.pending.push(payload.clone());
            false
        }
    };
    if ready {
        overlay
            .emit("toast://new", &payload)
            .map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
pub fn overlay_ready(app: AppHandle) -> Result<(), String> {
    let pending = {
        let mut s = state().lock().unwrap();
        s.ready = true;
        std::mem::take(&mut s.pending)
    };
    if pending.is_empty() {
        return Ok(());
    }
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Ok(());
    };
    for p in pending {
        let _ = overlay.emit("toast://new", &p);
    }
    Ok(())
}

#[tauri::command]
pub fn hide_overlay_window(app: AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_ignore_cursor_events(true);
        let _ = overlay.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn resize_overlay_window(app: AppHandle, width: u32, height: u32) -> Result<(), String> {
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Ok(());
    };
    let w = width.max(1) as f64;
    let h = height.max(1) as f64;
    overlay
        .set_size(LogicalSize::new(w, h))
        .map_err(|e| e.to_string())?;
    position_top_right(&overlay);
    Ok(())
}

#[tauri::command]
pub fn overlay_activate_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
        let _ = main.emit("main://activate-tab", tab_id);
    }
    Ok(())
}
