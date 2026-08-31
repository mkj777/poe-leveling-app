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
//! und ohne dass zwischendurch ein Fenster verschwindet. Wer nicht warten will,
//! nimmt `update_apply_now`: derselbe Vorgang, nur sofort und mit Neustart.
//!
//! Velopack liefert eine synchrone API. Jeder Aufruf landet deshalb in
//! `spawn_blocking`, sonst blockiert die Pruefung den Tokio-Worker und damit
//! die Oberflaeche.
//!
//! `UpdateManager::new` verlangt eine installierte Anwendung. Im Entwicklungs-
//! lauf und im portablen Betrieb gibt es kein Velopack-Manifest, dort passiert
//! schlicht nichts.

use std::sync::atomic::{AtomicBool, Ordering};

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

/// Gesetzt, sobald ein Neustart mit Update angestossen wurde. `app.exit` loest
/// gleich darauf `apply_on_exit` aus, und der Auftrag darf nicht zweimal
/// erteilt werden: der zweite wuerde denselben Ordner ein zweites Mal
/// uebernehmen wollen.
static RESTART_REQUESTED: AtomicBool = AtomicBool::new(false);

/// Spielt ein bereitliegendes Paket sofort ein und startet die App neu.
///
/// Fuer den Fall, dass jemand die neue Version jetzt haben will, statt die App
/// von Hand zu schliessen und wieder zu oeffnen. Der Updater wartet auch hier
/// auf das Ende dieses Prozesses, darum wird direkt danach beendet.
#[tauri::command]
pub fn update_apply_now(app: tauri::AppHandle) -> Result<String, String> {
    let manager = manager_if_installed()
        .ok_or_else(|| "Die App ist nicht installiert, es gibt nichts einzuspielen".to_string())?;

    let asset = manager
        .get_update_pending_restart()
        .ok_or_else(|| "Es liegt kein geladenes Update bereit".to_string())?;

    let version = asset.Version.clone();

    // silent: kein Fortschrittsfenster. restart: die App kommt von selbst
    // wieder, sonst waere der Knopf nur ein umstaendliches Beenden.
    manager
        .wait_exit_then_apply_updates(&asset, true, true, Vec::<String>::new())
        .map_err(|error| error.to_string())?;

    RESTART_REQUESTED.store(true, Ordering::SeqCst);
    println!("[updater] {} wird jetzt eingespielt, die App startet neu", version);

    app.exit(0);
    Ok(version)
}

/// Uebergibt ein bereitliegendes Paket an den Velopack-Updater, der es
/// einspielt, sobald dieser Prozess beendet ist.
///
/// Gefragt wird der Ordner, nicht der Speicher: so wird auch ein Paket
/// eingespielt, das eine fruehere Sitzung geladen hat und das damals liegen
/// blieb, etwa weil die App abgestuerzt ist.
pub fn apply_on_exit() {
    // Schon ueber update_apply_now angestossen, samt Neustart.
    if RESTART_REQUESTED.load(Ordering::SeqCst) {
        return;
    }

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
