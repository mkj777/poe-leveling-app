//! Fetches the raw walkthrough data from the upstream repository and stores
//! it sha-pinned in the app data directory. See ADR-0001 and ADR-0003.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

const REPO: &str = "HeartofPhos/exile-leveling";
const USER_AGENT: &str = "poe-leveling-app";

const ROUTE_FILES: [&str; 10] = [
    "act-1", "act-2", "act-3", "act-4", "act-5", "act-6", "act-7", "act-8", "act-9", "act-10",
];

const JSON_FILES: [&str; 8] = [
    "areas",
    "awakened-gem-lookup",
    "characters",
    "gem-colours",
    "gems",
    "kill-waypoints",
    "quests",
    "vaal-gem-lookup",
];

#[derive(Serialize, Deserialize, Clone, Default)]
struct Manifest {
    sha: String,
    etag: String,
    fetched_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamStatus {
    pub changed: bool,
    pub sha: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedData {
    pub sha: String,
    pub routes: Vec<String>,
    pub json: HashMap<String, String>,
}

fn root(handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir not available: {}", e))?
        .join("exile-leveling");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_manifest(handle: &tauri::AppHandle) -> Manifest {
    root(handle)
        .ok()
        .map(|dir| dir.join("manifest.json"))
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|body| serde_json::from_str(&body).ok())
        .unwrap_or_default()
}

fn write_manifest(handle: &tauri::AppHandle, manifest: &Manifest) -> Result<(), String> {
    let path = root(handle)?.join("manifest.json");
    let body = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    std::fs::write(path, body).map_err(|e| e.to_string())
}

fn now_seconds() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

/// Asks for the last commit that touches `common/data`. With `If-None-Match`
/// GitHub answers 304 when nothing changed, without a body and without
/// rate-limit cost.
#[tauri::command]
pub async fn check_upstream(handle: tauri::AppHandle) -> Result<UpstreamStatus, String> {
    let manifest = read_manifest(&handle);

    let url = format!(
        "https://api.github.com/repos/{}/commits?path=common/data&per_page=1",
        REPO
    );

    let client = reqwest::Client::new();
    let mut request = client.get(&url).header("User-Agent", USER_AGENT);
    if !manifest.etag.is_empty() {
        request = request.header("If-None-Match", manifest.etag.clone());
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        return Ok(UpstreamStatus {
            changed: false,
            sha: manifest.sha,
        });
    }

    if !response.status().is_success() {
        return Err(format!("GitHub answered {}", response.status()));
    }

    let etag = response
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();

    let commits: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let sha = commits
        .get(0)
        .and_then(|commit| commit.get("sha"))
        .and_then(|sha| sha.as_str())
        .ok_or_else(|| "no sha in the response".to_string())?
        .to_string();

    // Reload even with the same sha if the directory is missing.
    let changed = sha != manifest.sha || !root(&handle)?.join(&sha).exists();

    write_manifest(
        &handle,
        &Manifest {
            sha: manifest.sha.clone(),
            etag,
            fetched_at: manifest.fetched_at.clone(),
        },
    )?;

    Ok(UpstreamStatus { changed, sha })
}

/// Downloads the 10 route files and 8 JSON files of the given sha into a
/// staging directory and only then renames it. An aborted download therefore
/// cannot damage the last good state.
#[tauri::command]
pub async fn fetch_upstream(handle: tauri::AppHandle, sha: String) -> Result<(), String> {
    let base = root(&handle)?;
    let staging = base.join(format!(".staging-{}", sha));
    if staging.exists() {
        std::fs::remove_dir_all(&staging).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(staging.join("routes")).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(staging.join("json")).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();

    for name in ROUTE_FILES.iter() {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/common/data/routes/{}.txt",
            REPO, sha, name
        );
        let body = download(&client, &url).await?;
        std::fs::write(staging.join("routes").join(format!("{}.txt", name)), body)
            .map_err(|e| e.to_string())?;
    }

    for name in JSON_FILES.iter() {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/common/data/json/{}.json",
            REPO, sha, name
        );
        let body = download(&client, &url).await?;
        std::fs::write(staging.join("json").join(format!("{}.json", name)), body)
            .map_err(|e| e.to_string())?;
    }

    let final_dir = base.join(&sha);
    if final_dir.exists() {
        std::fs::remove_dir_all(&final_dir).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&staging, &final_dir).map_err(|e| e.to_string())?;

    let mut manifest = read_manifest(&handle);
    manifest.sha = sha;
    manifest.fetched_at = now_seconds();
    write_manifest(&handle, &manifest)?;

    Ok(())
}

async fn download(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("{} answered {}", url, response.status()));
    }

    response.text().await.map_err(|e| e.to_string())
}

/// Reads the last completely downloaded state. `None` if nothing is there
/// yet, so the frontend can fall back to the build snapshot.
#[tauri::command]
pub async fn read_cached(handle: tauri::AppHandle) -> Result<Option<CachedData>, String> {
    let manifest = read_manifest(&handle);
    if manifest.sha.is_empty() {
        return Ok(None);
    }

    let dir = root(&handle)?.join(&manifest.sha);
    if !dir.exists() {
        return Ok(None);
    }

    let mut routes = Vec::new();
    for name in ROUTE_FILES.iter() {
        let path = dir.join("routes").join(format!("{}.txt", name));
        routes.push(std::fs::read_to_string(path).map_err(|e| e.to_string())?);
    }

    let mut json = HashMap::new();
    for name in JSON_FILES.iter() {
        let path = dir.join("json").join(format!("{}.json", name));
        json.insert(
            name.to_string(),
            std::fs::read_to_string(path).map_err(|e| e.to_string())?,
        );
    }

    Ok(Some(CachedData {
        sha: manifest.sha,
        routes,
        json,
    }))
}
