//! Remote control for development builds.
//!
//! Otherwise the overlay can only be opened with a click in the window, which
//! makes every automated run depend on a human. Here a tiny server listens on
//! the loopback address and sends commands to the main window as an event.
//!
//! Explicitly debug builds only: `#[cfg(debug_assertions)]` excludes all of
//! this from the release, and it binds to 127.0.0.1 alone.

#[cfg(debug_assertions)]
use std::io::{BufRead, BufReader, Write};
#[cfg(debug_assertions)]
use std::net::{TcpListener, TcpStream};

#[cfg(debug_assertions)]
pub const PORT: u16 = 17651;

/// Sent to all windows as a `dev-control` event.
#[cfg(debug_assertions)]
const COMMANDS: [&str; 4] = ["start", "stop", "toggle", "edit"];

#[cfg(debug_assertions)]
pub fn serve(handle: tauri::AppHandle) {
    let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("[dev-control] port {} not available: {}", PORT, error);
            return;
        }
    };

    println!(
        "[dev-control] ready: curl http://127.0.0.1:{}/{}",
        PORT,
        COMMANDS.join(" | /")
    );

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => handle_connection(stream, &handle),
                Err(error) => eprintln!("[dev-control] connection: {}", error),
            }
        }
    });
}

#[cfg(debug_assertions)]
fn handle_connection(mut stream: TcpStream, handle: &tauri::AppHandle) {
    use tauri::Emitter;

    let mut line = String::new();
    if BufReader::new(&stream).read_line(&mut line).is_err() {
        return;
    }

    // "GET /toggle HTTP/1.1" -> "toggle"
    let command = line
        .split_whitespace()
        .nth(1)
        .unwrap_or("")
        .trim_start_matches('/')
        .to_string();

    let (status, body) = if COMMANDS.contains(&command.as_str()) {
        let _ = handle.emit("dev-control", command.clone());
        ("200 OK", format!("{}\n", command))
    } else {
        (
            "404 Not Found",
            format!("known commands: {}\n", COMMANDS.join(", ")),
        )
    };

    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        body.len(),
        body
    );

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[cfg(not(debug_assertions))]
pub fn serve(_handle: tauri::AppHandle) {}
