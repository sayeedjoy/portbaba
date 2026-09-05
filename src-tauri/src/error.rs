//! Application-wide error type.
//!
//! Every Tauri command returns `Result<T, Error>`. `Error` serialises to a plain
//! string so the frontend contract stays `Result<T, string>` as described in the
//! SRS (§45), while the Rust side keeps enough structure to react to the cause.

use std::fmt;

#[derive(Debug, Clone)]
pub enum Error {
    /// The OS refused to give us the information or perform the action.
    PermissionDenied(String),
    /// A port, PID or record we were asked about does not exist (any more).
    NotFound(String),
    /// User input failed validation (SR-002, SR-003).
    InvalidInput(String),
    /// Something went wrong while talking to the operating system.
    Platform(String),
    /// Reading/writing the local state files failed.
    Storage(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::PermissionDenied(m)
            | Error::NotFound(m)
            | Error::InvalidInput(m)
            | Error::Platform(m)
            | Error::Storage(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for Error {}

impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::PermissionDenied => Error::PermissionDenied(e.to_string()),
            std::io::ErrorKind::NotFound => Error::NotFound(e.to_string()),
            _ => Error::Storage(e.to_string()),
        }
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Storage(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// SR-002 — port numbers must be inside 1–65535.
pub fn validate_port(port: u32) -> Result<u16> {
    if port == 0 || port > 65535 {
        return Err(Error::InvalidInput(format!(
            "{port} is not a valid port number. Valid ports are 1–65535."
        )));
    }
    Ok(port as u16)
}

/// SR-003 — PIDs must be plausible before we act on them.
pub fn validate_pid(pid: u32) -> Result<u32> {
    if pid == 0 {
        return Err(Error::InvalidInput(
            "0 is not a valid process id.".to_string(),
        ));
    }
    Ok(pid)
}
