use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub cwd: Option<String>,
    pub title: Option<String>,
    pub last_timestamp_ms: Option<i64>,
    pub message_count: u32,
    pub file_size: u64,
}

#[derive(Deserialize)]
struct SlimRecord {
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default, rename = "type")]
    ty: Option<String>,
    #[serde(default, rename = "isMeta")]
    is_meta: Option<bool>,
    #[serde(default)]
    message: Option<SlimMessage>,
}

#[derive(Deserialize)]
struct SlimMessage {
    #[serde(default)]
    content: Option<Value>,
}

struct CacheEntry {
    mtime_ms: i64,
    size: u64,
    info: SessionInfo,
}

static CACHE: OnceLock<Mutex<HashMap<PathBuf, CacheEntry>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<PathBuf, CacheEntry>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("projects"))
}

fn extract_text_content(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => items
            .iter()
            .find_map(|i| i.get("text").and_then(|t| t.as_str()).map(str::to_string)),
        _ => None,
    }
}

fn looks_like_command(text: &str) -> bool {
    let t = text.trim_start();
    t.starts_with("<local-command-caveat>")
        || t.starts_with("<command-name>")
        || t.starts_with("<system-reminder>")
}

fn first_line(text: &str, max_chars: usize) -> String {
    let normalized = text.replace('\r', "");
    let first = normalized
        .lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("");
    if first.chars().count() <= max_chars {
        first.to_string()
    } else {
        let truncated: String = first.chars().take(max_chars).collect();
        format!("{truncated}…")
    }
}

fn byte_contains(hay: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() || hay.len() < needle.len() {
        return false;
    }
    hay.windows(needle.len()).any(|w| w == needle)
}

fn mtime_ms_of(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn parse_session_file(
    path: &Path,
    session_id: String,
    size: u64,
    mtime_ms: i64,
) -> SessionInfo {
    let mut info = SessionInfo {
        session_id,
        cwd: None,
        title: None,
        last_timestamp_ms: Some(mtime_ms),
        message_count: 0,
        file_size: size,
    };

    let Ok(file) = fs::File::open(path) else {
        return info;
    };
    let mut reader = BufReader::with_capacity(1 << 16, file);
    let mut buf: Vec<u8> = Vec::with_capacity(8 * 1024);

    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) => break,
            Ok(_) => {}
            Err(_) => break,
        }
        let line = match std::str::from_utf8(&buf) {
            Ok(s) => s.trim(),
            Err(_) => continue,
        };
        if line.is_empty() {
            continue;
        }

        if info.cwd.is_some() && info.title.is_some() {
            let bytes = line.as_bytes();
            let head = &bytes[..bytes.len().min(256)];
            let is_msg = byte_contains(head, br#""type":"user""#)
                || byte_contains(head, br#""type":"assistant""#);
            let is_meta = byte_contains(head, br#""isMeta":true"#);
            if is_msg && !is_meta {
                info.message_count = info.message_count.saturating_add(1);
            }
            continue;
        }

        let rec: SlimRecord = match serde_json::from_str(line) {
            Ok(r) => r,
            Err(_) => continue,
        };

        if info.cwd.is_none() {
            if let Some(c) = rec.cwd {
                info.cwd = Some(c);
            }
        }

        let is_meta = rec.is_meta.unwrap_or(false);
        let ty = rec.ty.as_deref().unwrap_or("");
        let is_msg = matches!(ty, "user" | "assistant") && !is_meta;
        if is_msg {
            info.message_count = info.message_count.saturating_add(1);
        }

        if info.title.is_none() && ty == "user" && !is_meta {
            if let Some(msg) = rec.message {
                if let Some(content) = msg.content {
                    if let Some(text) = extract_text_content(&content) {
                        if !looks_like_command(&text) {
                            info.title = Some(first_line(&text, 120));
                        }
                    }
                }
            }
        }
    }

    info
}

fn discover_files(root: &Path) -> Vec<(PathBuf, String, u64, i64)> {
    let mut out: Vec<(PathBuf, String, u64, i64)> = Vec::new();
    let Ok(project_dirs) = fs::read_dir(root) else {
        return out;
    };
    for project_entry in project_dirs.flatten() {
        let project_path = project_entry.path();
        if !project_path.is_dir() {
            continue;
        }
        let Ok(session_files) = fs::read_dir(&project_path) else {
            continue;
        };
        for file_entry in session_files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
                continue;
            }
            let Some(stem) = file_path
                .file_stem()
                .and_then(|s| s.to_str())
                .map(str::to_string)
            else {
                continue;
            };
            let Ok(meta) = file_entry.metadata() else {
                continue;
            };
            out.push((file_path, stem, meta.len(), mtime_ms_of(&meta)));
        }
    }
    out
}

#[tauri::command]
pub fn list_sessions() -> Result<Vec<SessionInfo>, String> {
    let Some(root) = projects_dir() else {
        return Ok(Vec::new());
    };
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let files = discover_files(&root);

    let cache_mu = cache();
    let mut hits: Vec<SessionInfo> = Vec::new();
    let mut misses: Vec<(PathBuf, String, u64, i64)> = Vec::new();
    {
        let cache = cache_mu.lock().unwrap();
        for f in files.iter() {
            if let Some(entry) = cache.get(&f.0) {
                if entry.mtime_ms == f.3 && entry.size == f.2 {
                    hits.push(entry.info.clone());
                    continue;
                }
            }
            misses.push(f.clone());
        }
    }

    let mut fresh_indexed: Vec<(usize, SessionInfo)> = Vec::with_capacity(misses.len());
    if !misses.is_empty() {
        let n_threads = thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .min(misses.len())
            .max(1);
        let next = AtomicUsize::new(0);
        let out: Mutex<Vec<(usize, SessionInfo)>> =
            Mutex::new(Vec::with_capacity(misses.len()));
        let misses_ref = &misses;
        let next_ref = &next;
        let out_ref = &out;
        thread::scope(|s| {
            for _ in 0..n_threads {
                s.spawn(move || loop {
                    let i = next_ref.fetch_add(1, Ordering::Relaxed);
                    if i >= misses_ref.len() {
                        break;
                    }
                    let (path, id, size, mtime) = &misses_ref[i];
                    let info = parse_session_file(path, id.clone(), *size, *mtime);
                    out_ref.lock().unwrap().push((i, info));
                });
            }
        });
        fresh_indexed = out.into_inner().unwrap();
    }

    {
        let mut cache = cache_mu.lock().unwrap();
        for (i, info) in fresh_indexed.iter() {
            let (path, _, size, mtime) = &misses[*i];
            cache.insert(
                path.clone(),
                CacheEntry {
                    mtime_ms: *mtime,
                    size: *size,
                    info: info.clone(),
                },
            );
        }
        let live: HashSet<&PathBuf> = files.iter().map(|f| &f.0).collect();
        cache.retain(|k, _| live.contains(k));
    }

    let mut all = hits;
    all.extend(fresh_indexed.into_iter().map(|(_, info)| info));
    all.sort_by(|a, b| b.last_timestamp_ms.cmp(&a.last_timestamp_ms));
    Ok(all)
}
