//! Autoupdate ueber Velopack.
//!
//! Velopack liefert eine synchrone API. Jeder Aufruf landet deshalb in
//! `spawn_blocking`, sonst blockiert die Pruefung den Tokio-Worker und damit
//! die Oberflaeche.
//!
//! `UpdateManager::new` verlangt eine installierte Anwendung. Im Entwicklungs-
//! lauf und im portablen Betrieb gibt es kein Velopack-Manifest, dort meldet
//! die Pruefung schlicht "kein Update" statt einen Fehler nach oben zu geben.

use std::sync::Mutex;

use velopack::sources::GithubSource;
use velopack::{Error, UpdateCheck, UpdateInfo, UpdateManager};

/// Von hier zieht die App ihre Releases. Muss zum `--repoUrl` in
/// `scripts/release-velopack.mjs` passen.
pub const REPO_URL: &str = "https://github.com/mkj777/poe-leveling-app";

/// Zwischen Pruefung und Installation muss der gefundene Stand gehalten
/// werden, sonst laedt die Installation ein zweites Mal aus dem Netz.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<UpdateInfo>>);

fn manager() -> Result<UpdateManager, Error> {
    UpdateManager::new(GithubSource::new(REPO_URL, None, false), None, None)
}

fn to_message(error: Error) -> String {
    error.to_string()
}

/// Liefert die Version eines verfuegbaren Updates, sonst `None`.
#[tauri::command]
pub async fn update_check(state: tauri::State<'_, PendingUpdate>) -> Result<Option<String>, String> {
    let found = tauri::async_runtime::spawn_blocking(|| {
        let manager = match manager() {
            Ok(manager) => manager,
            // Nicht installiert heisst: Entwicklungslauf oder portabel. Kein
            // Grund, dem Nutzer einen Fehler zu zeigen.
            Err(Error::NotInstalled(reason)) => {
                println!("[updater] keine Velopack-Installation: {}", reason);
                return Ok(None);
            }
            Err(error) => return Err(to_message(error)),
        };

        match manager.check_for_updates().map_err(to_message)? {
            UpdateCheck::UpdateAvailable(info) => Ok(Some(*info)),
            UpdateCheck::NoUpdateAvailable | UpdateCheck::RemoteIsEmpty => Ok(None),
        }
    })
    .await
    .map_err(|error| error.to_string())??;

    let version = found
        .as_ref()
        .map(|info| info.TargetFullRelease.Version.clone());

    *state.0.lock().unwrap() = found;

    Ok(version)
}

/// Laedt das vorgemerkte Update und startet die App darauf neu. Kehrt im
/// Erfolgsfall nicht zurueck, weil Velopack den Prozess ersetzt.
#[tauri::command]
pub async fn update_install(state: tauri::State<'_, PendingUpdate>) -> Result<(), String> {
    let pending = state.0.lock().unwrap().clone();

    let Some(info) = pending else {
        return Err("Kein Update vorgemerkt, erst pruefen".to_string());
    };

    tauri::async_runtime::spawn_blocking(move || {
        let manager = manager().map_err(to_message)?;
        manager.download_updates(&info, None).map_err(to_message)?;
        manager.apply_updates_and_restart(&info).map_err(to_message)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Die laufende Version, wie Velopack sie sieht. Ohne Installation faellt sie
/// auf die Version aus `tauri.conf.json` zurueck.
#[tauri::command]
pub fn update_current_version(app: tauri::AppHandle) -> String {
    match manager() {
        Ok(manager) => manager.get_current_version_as_string(),
        Err(_) => app.package_info().version.to_string(),
    }
}
