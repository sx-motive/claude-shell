use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

pub struct PtyEntry {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

#[derive(Default)]
pub struct PtyManager {
    next_id: u64,
    entries: HashMap<u64, Arc<PtyEntry>>,
}

pub type PtyState = Arc<Mutex<PtyManager>>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySpawnArgs {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    pub cols: u16,
    pub rows: u16,
    #[serde(default)]
    pub env: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PtyExitPayload {
    pub handle: u64,
    pub code: Option<i32>,
}

fn resolve_command(name: &str) -> Result<std::path::PathBuf, String> {
    which::which(name).map_err(|e| format!("command not found on PATH: {name} ({e})"))
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    args: PtySpawnArgs,
) -> Result<u64, String> {
    let resolved = resolve_command(&args.command)?;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: args.rows,
            cols: args.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(resolved);
    for a in &args.args {
        cmd.arg(a);
    }
    if let Some(cwd) = &args.cwd {
        cmd.cwd(cwd);
    }
    if let Some(env) = &args.env {
        for (k, v) in env {
            cmd.env(k, v);
        }
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let entry = Arc::new(PtyEntry {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        child: Arc::new(Mutex::new(child)),
    });

    let handle = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.next_id += 1;
        let id = manager.next_id;
        manager.entries.insert(id, entry.clone());
        id
    };

    let app_for_thread = app.clone();
    let state_for_thread: PtyState = state.inner().clone();
    let child_for_thread = entry.child.clone();
    thread::spawn(move || {
        let mut reader = reader;
        let mut buf = vec![0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = B64.encode(&buf[..n]);
                    let _ = app_for_thread.emit(&format!("pty:output:{handle}"), encoded);
                }
                Err(_) => break,
            }
        }

        let code = {
            let mut child = child_for_thread.lock().ok();
            child
                .as_mut()
                .and_then(|c| c.wait().ok())
                .map(|s| s.exit_code() as i32)
        };
        let _ = app_for_thread.emit(
            &format!("pty:exit:{handle}"),
            PtyExitPayload {
                handle,
                code,
            },
        );

        if let Ok(mut manager) = state_for_thread.lock() {
            manager.entries.remove(&handle);
        }
    });

    Ok(handle)
}

#[tauri::command]
pub fn pty_write(state: State<'_, PtyState>, handle: u64, data: String) -> Result<(), String> {
    let entry = {
        let manager = state.lock().map_err(|e| e.to_string())?;
        manager
            .entries
            .get(&handle)
            .cloned()
            .ok_or_else(|| format!("invalid pty handle: {handle}"))?
    };
    let mut writer = entry.writer.lock().map_err(|e| e.to_string())?;
    writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    handle: u64,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let entry = {
        let manager = state.lock().map_err(|e| e.to_string())?;
        manager
            .entries
            .get(&handle)
            .cloned()
            .ok_or_else(|| format!("invalid pty handle: {handle}"))?
    };
    let master = entry.master.lock().map_err(|e| e.to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, PtyState>, handle: u64) -> Result<(), String> {
    let entry = {
        let manager = state.lock().map_err(|e| e.to_string())?;
        manager.entries.get(&handle).cloned()
    };
    if let Some(entry) = entry {
        if let Ok(mut child) = entry.child.lock() {
            let _ = child.kill();
        }
    }
    Ok(())
}
