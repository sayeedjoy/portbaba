//! Tauri command surface (SRS §45).
//!
//! SR-001: every privileged operation lives here, behind a typed command. The
//! frontend never executes a shell command of its own.
//!
//! All commands are declared `#[tauri::command(async)]` so the blocking OS work
//! runs off the main thread and the window stays responsive during a scan.

pub mod kill;
pub mod ports;
pub mod process;
pub mod system;
