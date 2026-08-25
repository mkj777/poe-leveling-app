//! Koppelt das Overlay an das Spielfenster: sucht das PoE-Fenster, liest
//! dessen Bounds und meldet Aenderungen als `poe-bounds`-Event. Siehe ADR-0005.

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PoeBounds {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub focused: bool,
    pub exclusive_fullscreen: bool,
    pub found: bool,
}

impl PoeBounds {
    fn not_found() -> Self {
        PoeBounds {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            focused: false,
            exclusive_fullscreen: false,
            found: false,
        }
    }
}

#[cfg(target_os = "windows")]
mod win {
    use super::PoeBounds;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::shared::minwindef::{BOOL, LPARAM};
    use winapi::shared::windef::{HWND, RECT};
    use winapi::um::winuser::{
        EnumWindows, GetForegroundWindow, GetWindowLongW, GetWindowRect, GetWindowTextW,
        IsWindowVisible, GWL_STYLE, WS_CAPTION, WS_THICKFRAME,
    };

    const TITLE: &str = "Path of Exile";

    struct Search {
        hwnd: Option<HWND>,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len > 0 && IsWindowVisible(hwnd) != 0 {
            let title = OsString::from_wide(&buf[..len as usize])
                .into_string()
                .unwrap_or_default();
            if title == TITLE {
                let search = &mut *(lparam as *mut Search);
                search.hwnd = Some(hwnd);
                return 0; // gefunden, Aufzaehlung beenden
            }
        }
        1
    }

    pub fn find_window() -> Option<HWND> {
        let mut search = Search { hwnd: None };
        unsafe {
            EnumWindows(Some(enum_proc), &mut search as *mut Search as LPARAM);
        }
        search.hwnd
    }

    pub fn read_bounds() -> PoeBounds {
        let hwnd = match find_window() {
            Some(hwnd) => hwnd,
            None => return PoeBounds::not_found(),
        };

        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };

        unsafe {
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return PoeBounds::not_found();
            }

            // Ein Fenster ohne Titelleiste und ohne Rahmen ist der Verdachtsfall
            // Exklusiv-Fullscreen. Darueber laesst sich unter Windows nicht
            // zeichnen, das Frontend meldet es dem Nutzer.
            let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
            let borderless = (style & (WS_CAPTION | WS_THICKFRAME)) == 0;

            PoeBounds {
                x: rect.left,
                y: rect.top,
                w: rect.right - rect.left,
                h: rect.bottom - rect.top,
                focused: GetForegroundWindow() == hwnd,
                exclusive_fullscreen: borderless,
                found: true,
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::PoeBounds;

    pub fn read_bounds() -> PoeBounds {
        PoeBounds::not_found()
    }
}

#[cfg(target_os = "windows")]
pub fn find_poe_window() -> Option<winapi::shared::windef::HWND> {
    win::find_window()
}

#[tauri::command]
pub fn start_poe_tracking(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut last: Option<PoeBounds> = None;
        loop {
            let bounds = win::read_bounds();
            if last.as_ref() != Some(&bounds) {
                let _ = handle.emit_all("poe-bounds", bounds.clone());
                last = Some(bounds);
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
}
