//! Autoupdate ueber Velopack, ohne Zutun des Nutzers.
//!
//! Der Ablauf ist bewusst auf zwei Zeitpunkte verteilt:
//!
//! * Beim Start wird im Hintergrund geprueft und gegebenenfalls das Paket
//!   heruntergeladen. Angewendet wird es dabei nicht, sonst muesste die App
//!   mitten im Betrieb neu starten.
//! * Beim Beenden wird ein bereitliegendes Paket uebernommen. Der Velopack-
//!   Updater wartet dafuer auf das Ende dieses Prozesses, und zwar hoechstens
//!   60 Sekunden. Deshalb gehoert der Aufruf ans Ende und nicht an den Anfang:
//!   beim Start aufgerufen gaebe der Updater laengst auf, bevor jemand die App
//!   wieder schliesst.
//!
//! Beim naechsten Start laeuft damit die neue Version, ohne Dialog, ohne Klick
//! und ohne dass zwischendurch ein Fenster verschwindet.
//!
//! Velopack liefert eine synchrone API. Jeder Aufruf landet deshalb in
//! `spawn_blocking`, sonst blockiert die Pruefung den Tokio-Worker und damit
//! die Oberflaeche.
//!
//! `UpdateManager::new` verlangt eine installierte Anwendung. Im Entwicklungs-
//! lauf und im portablen Betrieb gibt es kein Velopack-Manifest, dort passiert
//! schlicht nichts.

use tauri::Emitter;
use velopack::sources::GithubSource;
use velopack::{Error, UpdateCheck, UpdateManager};

/// Von hier zieht die App ihre Releases. Muss zum `--repoUrl` in
/// `scripts/release-velopack.mjs` passen.
pub const REPO_URL: &str = "https://github.com/mkj777/poe-leveling-app";

/// Wird gemeldet, sobald ein Update geladen ist und beim naechsten Start
/// greift. Nutzlast ist die Versionsnummer.
pub const UPDATE_READY_EVENT: &str = "update-ready";

fn manager() -> Result<UpdateManager, Error> {
    UpdateManager::new(GithubSource::new(REPO_URL, None, false), None, None)
}

/// Liefert den Manager, oder nichts, wenn die App nicht installiert ist.
/// Entwicklungslauf und portabler Betrieb sind kein Fehlerfall.
fn manager_if_installed() -> Option<UpdateManager> {
    match manager() {
        Ok(manager) => Some(manager),
        Err(Error::NotInstalled(reason)) => {
            println!("[updater] keine Velopack-Installation: {}", reason);
            None
        }
        Err(error) => {
            eprintln!("[updater] Manager nicht verfuegbar: {}", error);
            None
        }
    }
}

/// Prueft im Hintergrund und laedt ein gefundenes Update herunter. Laeuft ins
/// Leere, wenn kein Netz da ist oder GitHub bremst: ein Update ist nichts,
/// wofuer der Start stolpern darf.
pub fn check_and_download(app: tauri::AppHandle) {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(manager) = manager_if_installed() else {
            return;
        };

        let info = match manager.check_for_updates() {
            Ok(UpdateCheck::UpdateAvailable(info)) => *info,
            Ok(UpdateCheck::NoUpdateAvailable) | Ok(UpdateCheck::RemoteIsEmpty) => return,
            Err(error) => {
                eprintln!("[updater] Pruefung fehlgeschlagen: {}", error);
                return;
            }
        };

        let version = info.TargetFullRelease.Version.clone();

        // Laedt das Delta, wenn eines passt, sonst das volle Paket. Velopack
        // entscheidet das selbst anhand der Liste in `info`.
        if let Err(error) = manager.download_updates(&info, None) {
            eprintln!("[updater] Download fehlgeschlagen: {}", error);
            return;
        }

        println!(
            "[updater] {} liegt bereit und wird beim naechsten Start aktiv",
            version
        );

        let _ = app.emit(UPDATE_READY_EVENT, version);
    });
}

/// Uebergibt ein bereitliegendes Paket an den Velopack-Updater, der es
/// einspielt, sobald dieser Prozess beendet ist.
///
/// Gefragt wird der Ordner, nicht der Speicher: so wird auch ein Paket
/// eingespielt, das eine fruehere Sitzung geladen hat und das damals liegen
/// blieb, etwa weil die App abgestuerzt ist.
pub fn apply_on_exit() {
    let Some(manager) = manager_if_installed() else {
        return;
    };

    let Some(asset) = manager.get_update_pending_restart() else {
        return;
    };

    // silent: es soll kein Fortschrittsfenster aufgehen. Kein Neustart: wer
    // gerade beendet hat, will die App nicht wiedersehen.
    match manager.wait_exit_then_apply_updates(&asset, true, false, Vec::<String>::new()) {
        Ok(()) => println!("[updater] {} wird nach dem Beenden eingespielt", asset.Version),
        Err(error) => eprintln!("[updater] Uebernahme fehlgeschlagen: {}", error),
    }
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
