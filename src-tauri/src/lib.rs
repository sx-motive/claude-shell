use std::sync::{Arc, Mutex};

mod pty;

use pty::{pty_kill, pty_resize, pty_spawn, pty_write, PtyManager, PtyState};

#[tauri::command]
fn ping(msg: String) -> String {
    format!("pong: {msg}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state: PtyState = Arc::new(Mutex::new(PtyManager::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(pty_state)
        .invoke_handler(tauri::generate_handler![
            ping,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
