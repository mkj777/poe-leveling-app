//! Leitet den Client.txt-Pfad aus dem laufenden Spielprozess ab. Das HWND
//! liegt durch das Overlay-Tracking ohnehin vor, also kostet das nur den Weg
//! HWND -> PID -> exe -> logs/Client.txt.

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn detect_client_txt() -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::PathBuf;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winnt::PROCESS_QUERY_LIMITED_INFORMATION;
    use winapi::um::winuser::GetWindowThreadProcessId;

    let hwnd = crate::overlay::find_poe_window()?;

    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return None;
        }

        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len);
        CloseHandle(process);

        if ok == 0 {
            return None;
        }

        let exe = PathBuf::from(OsString::from_wide(&buf[..len as usize]));
        let candidate = exe.parent()?.join("logs").join("Client.txt");

        if candidate.exists() {
            Some(candidate.to_string_lossy().to_string())
        } else {
            None
        }
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn detect_client_txt() -> Option<String> {
    None
}
