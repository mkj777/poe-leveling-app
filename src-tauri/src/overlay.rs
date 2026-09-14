//! Attaches the overlay to the game window: finds the PoE window, reads its
//! bounds and reports changes as a `poe-bounds` event. See ADR-0005.

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
                return 0; // found, stop enumerating
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

            // A window without title bar and without frame is the suspected
            // case of exclusive fullscreen. Windows cannot draw over that, the
            // frontend reports it to the user.
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

    // The hook delivers its events to exactly the thread that installed it,
    // and the callback runs there. Thread-local state is therefore enough and
    // saves synchronisation.
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

    /// Looks the window up again. Expensive, because it enumerates all
    /// windows, so it only runs on focus changes and not on every move.
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
            // Focus changes also cover game start and exit: on start PoE takes
            // the foreground, on exit it goes elsewhere.
            resolve_target();
            emit_if_changed();
            return;
        }

        // EVENT_OBJECT_LOCATIONCHANGE fires system-wide, including for the
        // mouse cursor. Without these two filters the emit path would run on
        // every mouse movement.
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

            // Two narrow hooks instead of one range. The range from
            // EVENT_SYSTEM_FOREGROUND to EVENT_OBJECT_LOCATIONCHANGE would
            // otherwise cover dozens of events that are none of our business.
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

            // Once initially, so the frontend does not have to wait for the
            // first movement.
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
    // Idempotent: React calls effects twice under StrictMode, and nobody
    // needs two sets of hooks plus two message loops.
    if TRACKING.swap(true, Ordering::SeqCst) {
        return;
    }

    // Own thread, because the hook needs a message loop and the events only
    // arrive where it was installed.
    std::thread::spawn(move || tracking::run(handle));
}

/// Bounds on demand. The frontend asks once as soon as its listener is up,
/// because the first event from the hook thread may have fired before that.
/// Also covers the case where PoE starts later than the app.
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
