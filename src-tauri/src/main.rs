// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod data_sync;
mod dev_control;
mod game_paths;
mod overlay;
mod updater;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

#[tokio::main]
async fn main() {
    // Muss vor allem anderen laufen. Velopack ruft die eigene Anwendung
    // waehrend Installation, Update und Deinstallation mit Sonderargumenten
    // auf und beendet den Prozess in diesen Faellen selbst. Kaeme davor ein
    // Fenster hoch, blitzte es bei jeder Installation kurz auf.
    velopack::VelopackApp::build().run();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Tray-Aufbau in Tauri 2: Menue und Icon werden gebaut und der
            // Klick-Handler haengt am Icon, nicht mehr am Builder.
            let open_app = MenuItem::with_id(app, "open_app", "Open App", true, None::<&str>)?;
            let quit_app = MenuItem::with_id(app, "quit_app", "Quit App", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open_app, &separator, &quit_app])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open_app" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        let _ = app.emit("showWindow", ());
                    }
                    "quit_app" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Prueft und laedt im Hintergrund. Eingespielt wird beim
            // Beenden, siehe den RunEvent::Exit weiter unten.
            updater::check_and_download(app.handle().clone());

            // Nur in Debug-Bauten, nur auf der Loopback-Adresse. Erlaubt es,
            // das Overlay ohne Klick im Fenster zu schalten.
            dev_control::serve(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            log_frontend,
            get_area_name,
            open_poe_window,
            data_sync::check_upstream,
            data_sync::fetch_upstream,
            data_sync::read_cached,
            overlay::start_poe_tracking,
            overlay::poe_bounds,
            game_paths::detect_client_txt,
            updater::update_current_version,
            updater::update_apply_now
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        // Nicht `.run(context)`, weil erst `build` den Zugriff auf die
        // Laufzeitereignisse gibt. Genau eines davon wird gebraucht: der
        // letzte Moment vor dem Ende des Prozesses.
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                updater::apply_on_exit();
            }
        });
}

/// Nimmt Fehler aus dem Webview entgegen und schreibt sie ins Terminal.
/// Ohne das sind Renderfehler nur in den Devtools sichtbar, an die von aussen
/// niemand herankommt.
#[tauri::command]
fn log_frontend(level: &str, message: &str) {
    eprintln!("[frontend {}] {}", level, message);
}

#[tauri::command]
async fn get_area_name(file_location: &str) -> Result<String, String> {
    let file = async_fs::read_to_string(file_location).await;

    if file.is_err() {
        return Err("Error while reading file".to_string());
    }

    let file = file.unwrap();

    let mut area_name = String::new();

    for line in file.lines().rev() {
        if line.contains("Generating level") {
            area_name = line.split("Generating level").collect::<Vec<&str>>()[1]
                .split(' ')
                .collect::<Vec<&str>>()[3]
                .trim()
                .replace("\"", "")
                .to_string();
            break;
        }
    }

    Ok(area_name)
}

#[tauri::command]
fn open_poe_window() -> Result<bool, String> {
    let window_found = if let Ok(windows) = windows::enumerate_windows() {
        for window in windows {
            if window.title == "Path of Exile" {
                if let Err(err) = windows::bring_to_front(window.hwnd) {
                    eprintln!("Failed to maximize window: {}", err);
                    return Ok(false);
                }
                return Ok(true);
            }
        }
        false
    } else {
        false
    };

    Ok(window_found)
}

#[cfg(target_os = "windows")]
mod windows {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi;
    use winapi::shared::minwindef::BOOL;
    use winapi::shared::minwindef::LPARAM;
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::SetForegroundWindow;
    use winapi::um::winuser::ShowWindow;
    use winapi::um::winuser::SW_MAXIMIZE;
    use winapi::um::winuser::{EnumWindows, GetWindowTextW, IsWindowVisible}; // Add this line to import the winapi crate

    // Structure to represent window information
    #[derive(Debug)]
    pub struct WindowInfo {
        pub hwnd: HWND,
        pub title: String,
    }

    pub fn enumerate_windows() -> Result<Vec<WindowInfo>, String> {
        let mut windows = Vec::new();
        unsafe {
            EnumWindows(
                Some(enum_windows_proc),
                &mut windows as *mut Vec<WindowInfo> as _,
            );
        }
        Ok(windows)
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, windows: LPARAM) -> BOOL {
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len > 0 && IsWindowVisible(hwnd) != 0 {
            let title = OsString::from_wide(&buf[..len as usize])
                .into_string()
                .unwrap();
            let windows_vec = &mut *(windows as *mut Vec<WindowInfo>);
            windows_vec.push(WindowInfo { hwnd, title });
        }
        1 // Continue enumeration
    }

    #[allow(dead_code)]
    pub fn maximize_window(hwnd: HWND) -> Result<(), String> {
        unsafe {
            if ShowWindow(hwnd, SW_MAXIMIZE) == 0 {
                return Err("Failed to maximize window".to_string());
            }
        }
        Ok(())
    }

    pub fn bring_to_front(hwnd: HWND) -> Result<(), String> {
        unsafe {
            if SetForegroundWindow(hwnd) == 0 {
                return Err("Failed to bring window to front".to_string());
            }
        }
        Ok(())
    }
}
