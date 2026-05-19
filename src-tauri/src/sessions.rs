use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub cwd: Option<String>,
    pub title: Option<String>,
    pub last_timestamp: Option<String>,
    pub message_count: u32,
    pub file_size: u64,
}

fn projects_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    Some(home.join(".claude").join("projects"))
}

fn extract_text_content(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => {
            for item in items {
                if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                    return Some(text.to_string());
                }
            }
            None
        }
        _ => None,
    }
}

fn is_meta_line(v: &Value) -> bool {
    v.get("isMeta").and_then(|x| x.as_bool()).unwrap_or(false)
}

fn looks_like_command(text: &str) -> bool {
    let trimmed = text.trim_start();
    trimmed.starts_with("<local-command-caveat>")
        || trimmed.starts_with("<command-name>")
        || trimmed.starts_with("<system-reminder>")
}

fn first_line(text: &str, max_chars: usize) -> String {
    let normalized = text.replace('\r', "");
    let first = normalized.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
    if first.chars().count() <= max_chars {
        first.to_string()
    } else {
        let truncated: String = first.chars().take(max_chars).collect();
        format!("{truncated}…")
    }
}

fn parse_session_file(path: &PathBuf, session_id: String) -> Option<SessionInfo> {
    let metadata = fs::metadata(path).ok()?;
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    let mut cwd: Option<String> = None;
    let mut title: Option<String> = None;
    let mut last_ts: Option<String> = None;
    let mut count: u32 = 0;

    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let v: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if let Some(c) = v.get("cwd").and_then(|x| x.as_str()) {
            if cwd.is_none() {
                cwd = Some(c.to_string());
            }
        }

        if let Some(ts) = v.get("timestamp").and_then(|x| x.as_str()) {
            last_ts = Some(ts.to_string());
        }

        let ty = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
        if matches!(ty, "user" | "assistant") && !is_meta_line(&v) {
            count = count.saturating_add(1);
        }

        if title.is_none() && ty == "user" && !is_meta_line(&v) {
            if let Some(content) = v.get("message").and_then(|m| m.get("content")) {
                if let Some(text) = extract_text_content(content) {
                    if !looks_like_command(&text) {
                        title = Some(first_line(&text, 120));
                    }
                }
            }
        }
    }

    Some(SessionInfo {
        session_id,
        cwd,
        title,
        last_timestamp: last_ts,
        message_count: count,
        file_size: metadata.len(),
    })
}

#[tauri::command]
pub fn list_sessions() -> Result<Vec<SessionInfo>, String> {
    let Some(root) = projects_dir() else {
        return Ok(Vec::new());
    };
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut out: Vec<SessionInfo> = Vec::new();

    let project_dirs = fs::read_dir(&root).map_err(|e| e.to_string())?;
    for project_entry in project_dirs.flatten() {
        let project_path = project_entry.path();
        if !project_path.is_dir() {
            continue;
        }
        let session_files = match fs::read_dir(&project_path) {
            Ok(d) => d,
            Err(_) => continue,
        };
        for file_entry in session_files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
                continue;
            }
            let stem = match file_path.file_stem().and_then(|s| s.to_str()) {
                Some(s) => s.to_string(),
                None => continue,
            };
            if let Some(info) = parse_session_file(&file_path, stem) {
                out.push(info);
            }
        }
    }

    out.sort_by(|a, b| b.last_timestamp.cmp(&a.last_timestamp));
    Ok(out)
}
