//! Autoupdate via Velopack, without any action by the user.
//!
//! The flow is deliberately split across two moments:
//!
//! * At startup the check runs in the background and downloads the package if
//!   there is one. It is not applied at that point, otherwise the app would
//!   have to restart mid-session.
//! * On exit a waiting package is handed over. The Velopack updater waits for
//!   this process to end, at most 60 seconds. That is why the call belongs at
//!   the end and not at the start: called at startup, the updater would have
//!   given up long before anyone closes the app again.
//!
//! The next start then runs the new version, without a dialog, without a
//! click and without a window disappearing in between. Anyone who does not
//! want to wait uses `update_apply_now`: the same procedure, only immediately
//! and with a restart.
//!
//! Velopack provides a synchronous API. Every call therefore goes through
//! `spawn_blocking`, otherwise the check would block the Tokio worker and with
//! it the UI.
//!
//! `UpdateManager::new` requires an installed application. In development and
//! portable runs there is no Velopack manifest, so nothing happens there.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::Emitter;
use velopack::sources::GithubSource;
use velopack::{Error, UpdateCheck, UpdateManager};

/// Where the app pulls its releases from. Must match the `--repoUrl` in
/// `scripts/release-velopack.mjs`.
pub const REPO_URL: &str = "https://github.com/mkj777/poe-leveling-app";

/// Emitted as soon as an update is downloaded and takes effect on the next
/// start. The payload is the version number.
pub const UPDATE_READY_EVENT: &str = "update-ready";

fn manager() -> Result<UpdateManager, Error> {
    UpdateManager::new(GithubSource::new(REPO_URL, None, false), None, None)
}

/// Returns the manager, or nothing if the app is not installed. Development
/// and portable runs are not an error.
fn manager_if_installed() -> Option<UpdateManager> {
    match manager() {
        Ok(manager) => Some(manager),
        Err(Error::NotInstalled(reason)) => {
            println!("[updater] no Velopack installation: {}", reason);
            None
        }
        Err(error) => {
            eprintln!("[updater] manager not available: {}", error);
            None
        }
    }
}

/// Checks in the background and downloads an update it finds. Comes up empty
/// if there is no network or GitHub throttles: an update is nothing the
/// startup may stumble over.
pub fn check_and_download(app: tauri::AppHandle) {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(manager) = manager_if_installed() else {
            return;
        };

        let info = match manager.check_for_updates() {
            Ok(UpdateCheck::UpdateAvailable(info)) => *info,
            Ok(UpdateCheck::NoUpdateAvailable) | Ok(UpdateCheck::RemoteIsEmpty) => return,
            Err(error) => {
                eprintln!("[updater] check failed: {}", error);
                return;
            }
        };

        let version = info.TargetFullRelease.Version.clone();

        // Downloads the delta if one fits, otherwise the full package.
        // Velopack decides that itself from the list in `info`.
        if let Err(error) = manager.download_updates(&info, None) {
            eprintln!("[updater] download failed: {}", error);
            return;
        }

        println!(
            "[updater] {} is ready and becomes active on the next start",
            version
        );

        let _ = app.emit(UPDATE_READY_EVENT, version);
    });
}

/// Set as soon as a restart with update has been triggered. `app.exit` fires
/// `apply_on_exit` right after, and the job must not be issued twice: the
/// second one would want to apply the same folder a second time.
static RESTART_REQUESTED: AtomicBool = AtomicBool::new(false);

/// Applies a waiting package right away and restarts the app.
///
/// For the case that someone wants the new version now instead of closing and
/// reopening the app by hand. The updater waits for this process to end here
/// too, which is why the app exits right after.
#[tauri::command]
pub fn update_apply_now(app: tauri::AppHandle) -> Result<String, String> {
    let manager = manager_if_installed()
        .ok_or_else(|| "The app is not installed, there is nothing to apply".to_string())?;

    let asset = manager
        .get_update_pending_restart()
        .ok_or_else(|| "No downloaded update is waiting".to_string())?;

    let version = asset.Version.clone();

    // silent: no progress window. restart: the app comes back on its own,
    // otherwise the button would just be a roundabout way of quitting.
    manager
        .wait_exit_then_apply_updates(&asset, true, true, Vec::<String>::new())
        .map_err(|error| error.to_string())?;

    RESTART_REQUESTED.store(true, Ordering::SeqCst);
    println!("[updater] {} is being applied now, the app restarts", version);

    app.exit(0);
    Ok(version)
}

/// Hands a waiting package to the Velopack updater, which applies it once
/// this process has ended.
///
/// The folder is asked, not memory: that way a package downloaded by an
/// earlier session that was left behind, say because the app crashed, gets
/// applied too.
pub fn apply_on_exit() {
    // Already triggered via update_apply_now, restart included.
    if RESTART_REQUESTED.load(Ordering::SeqCst) {
        return;
    }

    let Some(manager) = manager_if_installed() else {
        return;
    };

    let Some(asset) = manager.get_update_pending_restart() else {
        return;
    };

    // silent: no progress window should open. No restart: whoever just quit
    // does not want to see the app again.
    match manager.wait_exit_then_apply_updates(&asset, true, false, Vec::<String>::new()) {
        Ok(()) => println!("[updater] {} will be applied after exit", asset.Version),
        Err(error) => eprintln!("[updater] apply failed: {}", error),
    }
}

/// The running version as Velopack sees it. Without an installation it falls
/// back to the version from `tauri.conf.json`.
#[tauri::command]
pub fn update_current_version(app: tauri::AppHandle) -> String {
    match manager() {
        Ok(manager) => manager.get_current_version_as_string(),
        Err(_) => app.package_info().version.to_string(),
    }
}
