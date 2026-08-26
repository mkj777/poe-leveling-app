//! Koppelt das Overlay an das Spielfenster: sucht das PoE-Fenster, liest
//! dessen Bounds und meldet Aenderungen als `poe-bounds`-Event. Siehe ADR-0005.

use serde::Serialize;

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

    pub fn bounds_of(hwnd: HWND) -> PoeBounds {
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

#[cfg(target_os = "windows")]
pub fn find_poe_window() -> Option<winapi::shared::windef::HWND> {
    win::find_window()
}

#[cfg(target_os = "windows")]
mod tracking {
    use super::{win, PoeBounds};
    use std::cell::RefCell;
    use tauri::Emitter;
    use winapi::shared::minwindef::DWORD;
    use winapi::shared::ntdef::LONG;
    use winapi::shared::windef::{HWINEVENTHOOK, HWND};
    use winapi::um::winuser::{
        DispatchMessageW, GetMessageW, SetWinEventHook, TranslateMessage,
        EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_FOREGROUND, MSG, OBJID_WINDOW,
        WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
    };

    // Der Hook liefert seine Ereignisse an genau den Thread, der ihn gesetzt
    // hat, und der Callback laeuft dort. Thread-lokaler Zustand reicht deshalb
    // und erspart Synchronisation.
    thread_local! {
        static HANDLE: RefCell<Option<tauri::AppHandle>> = RefCell::new(None);
        static LAST: RefCell<Option<PoeBounds>> = RefCell::new(None);
        static TARGET: RefCell<Option<HWND>> = RefCell::new(None);
    }

    fn emit_if_changed() {
        let bounds = TARGET.with(|slot| match *slot.borrow() {
            Some(hwnd) => win::bounds_of(hwnd),
            None => PoeBounds::not_found(),
        });

        LAST.with(|slot| {
            let mut last = slot.borrow_mut();
            if last.as_ref() == Some(&bounds) {
                return;
            }
            *last = Some(bounds.clone());

            HANDLE.with(|handle| {
                if let Some(handle) = handle.borrow().as_ref() {
                    let _ = handle.emit("poe-bounds", bounds);
                }
            });
        });
    }

    /// Sucht das Fenster neu. Teuer, weil es alle Fenster aufzaehlt, laeuft
    /// darum nur bei Fokuswechseln und nicht bei jeder Bewegung.
    fn resolve_target() {
        TARGET.with(|slot| *slot.borrow_mut() = win::find_window());
    }

    unsafe extern "system" fn hook_proc(
        _hook: HWINEVENTHOOK,
        event: DWORD,
        hwnd: HWND,
        id_object: LONG,
        _id_child: LONG,
        _thread: DWORD,
        _time: DWORD,
    ) {
        if event == EVENT_SYSTEM_FOREGROUND {
            // Fokuswechsel deckt Start und Ende des Spiels mit ab: beim Start
            // holt sich PoE den Vordergrund, beim Beenden geht er woanders hin.
            resolve_target();
            emit_if_changed();
            return;
        }

        // EVENT_OBJECT_LOCATIONCHANGE feuert systemweit, auch fuer den
        // Mauszeiger. Ohne diese beiden Filter laeuft der Emit-Pfad bei jeder
        // Mausbewegung.
        if id_object != OBJID_WINDOW {
            return;
        }

        let is_target = TARGET.with(|slot| *slot.borrow() == Some(hwnd));
        if is_target {
            emit_if_changed();
        }
    }

    pub fn run(handle: tauri::AppHandle) {
        unsafe {
            HANDLE.with(|slot| *slot.borrow_mut() = Some(handle));

            let flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;

            // Zwei eng gefasste Hooks statt eines Bereichs. Der Bereich von
            // EVENT_SYSTEM_FOREGROUND bis EVENT_OBJECT_LOCATIONCHANGE laege
            // sonst ueber Dutzenden Ereignissen, die uns nichts angehen.
            SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                std::ptr::null_mut(),
                Some(hook_proc),
                0,
                0,
                flags,
            );

            SetWinEventHook(
                EVENT_OBJECT_LOCATIONCHANGE,
                EVENT_OBJECT_LOCATIONCHANGE,
                std::ptr::null_mut(),
                Some(hook_proc),
                0,
                0,
                flags,
            );

            // Einmal initial, damit das Frontend nicht auf die erste Bewegung
            // warten muss.
            resolve_target();
            emit_if_changed();

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    }
}

use std::sync::atomic::{AtomicBool, Ordering};

static TRACKING: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn start_poe_tracking(handle: tauri::AppHandle) {
    // Idempotent: React ruft Effekte unter StrictMode doppelt auf, und zwei
    // Hook-Saetze plus zwei Nachrichtenschleifen braucht niemand.
    if TRACKING.swap(true, Ordering::SeqCst) {
        return;
    }

    // Eigener Thread, weil der Hook eine Nachrichtenschleife braucht und die
    // Ereignisse nur dort ankommen, wo er gesetzt wurde.
    std::thread::spawn(move || tracking::run(handle));
}

/// Bounds auf Abruf. Das Frontend fragt einmal nach, sobald sein Listener
/// steht, denn das erste Ereignis aus dem Hook-Thread kann davor gefeuert
/// haben. Deckt zugleich den Fall ab, dass PoE spaeter startet als die App.
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn poe_bounds() -> PoeBounds {
    match win::find_window() {
        Some(hwnd) => win::bounds_of(hwnd),
        None => PoeBounds::not_found(),
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn poe_bounds() -> PoeBounds {
    PoeBounds::not_found()
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn start_poe_tracking(handle: tauri::AppHandle) {
    use tauri::Emitter;
    if TRACKING.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = handle.emit("poe-bounds", PoeBounds::not_found());
}
