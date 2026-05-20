use std::sync::{Arc, Mutex};

mod overlay;
mod pty;
mod sessions;

use overlay::{
    hide_overlay_window, overlay_activate_tab, overlay_ready, push_overlay_toast,
    resize_overlay_window,
};
use pty::{pty_kill, pty_resize, pty_spawn, pty_write, PtyManager, PtyState};
use sessions::list_sessions;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

#[tauri::command]
fn ping(msg: String) -> String {
    format!("pong: {msg}")
}

#[tauri::command]
fn detect_claude_path() -> Option<String> {
    which::which("claude")
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn validate_claude_path(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path is empty".into());
    }
    let resolved =
        which::which(trimmed).map_err(|e| format!("not found or not executable: {e}"))?;
    Ok(resolved.to_string_lossy().into_owned())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(windows)]
fn disable_window_rounding(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
    };

    let Ok(raw) = window.hwnd() else { return };
    let hwnd = raw.0 as HWND;
    let pref: i32 = DWMWCP_DONOTROUND as i32;
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE as u32,
            &pref as *const i32 as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state: PtyState = Arc::new(Mutex::new(PtyManager::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(pty_state)
        .invoke_handler(tauri::generate_handler![
            ping,
            detect_claude_path,
            validate_claude_path,
            list_sessions,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            push_overlay_toast,
            overlay_ready,
            hide_overlay_window,
            overlay_activate_tab,
            resize_overlay_window
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                disable_window_rounding(&window);
            }

            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.set_position(tauri::PhysicalPosition::new(-32000, -32000));
                let _ = overlay.show();
                let _ = overlay.hide();
            }

            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
