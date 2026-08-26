//! Fernsteuerung fuer Entwicklungsbauten.
//!
//! Das Overlay laesst sich sonst nur mit einem Klick im Fenster oeffnen, was
//! jeden automatisierten Durchlauf an einem Menschen haengen laesst. Hier
//! horcht ein winziger Server auf der Loopback-Adresse und schickt Befehle als
//! Ereignis an das Hauptfenster.
//!
//! Ausdruecklich nur in Debug-Bauten: `#[cfg(debug_assertions)]` schliesst das
//! Ganze aus dem Release aus, und gebunden wird allein an 127.0.0.1.

#[cfg(debug_assertions)]
use std::io::{BufRead, BufReader, Write};
#[cfg(debug_assertions)]
use std::net::{TcpListener, TcpStream};

#[cfg(debug_assertions)]
pub const PORT: u16 = 17651;

/// Wird als `dev-control`-Ereignis an alle Fenster geschickt.
#[cfg(debug_assertions)]
const COMMANDS: [&str; 4] = ["start", "stop", "toggle", "edit"];

#[cfg(debug_assertions)]
pub fn serve(handle: tauri::AppHandle) {
    let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("[dev-control] Port {} nicht verfuegbar: {}", PORT, error);
            return;
        }
    };

    println!(
        "[dev-control] bereit: curl http://127.0.0.1:{}/{}",
        PORT,
        COMMANDS.join(" | /")
    );

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => handle_connection(stream, &handle),
                Err(error) => eprintln!("[dev-control] Verbindung: {}", error),
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
            format!("bekannt sind: {}\n", COMMANDS.join(", ")),
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
