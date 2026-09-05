//! Port discovery commands (FR-001, FR-002, FR-013, FR-014, FR-021).

use crate::error::{validate_port, Result};
use crate::models::{PortInfo, PortStatus};
use crate::services::port_service::{self, ScanOptions};

/// FR-001 — the full table of ports in use.
#[tauri::command(async)]
pub fn get_active_ports(options: Option<ScanOptions>) -> Result<Vec<PortInfo>> {
    port_service::scan(options.unwrap_or_default())
}

/// FR-002 — everything bound to a single port.
#[tauri::command(async)]
pub fn get_port_info(port: u32) -> Result<Vec<PortInfo>> {
    let port = validate_port(port)?;
    port_service::ports_on(
        port,
        ScanOptions {
            include_udp: true,
            include_established: true,
        },
    )
}

/// FR-014 — "is 8080 free?" without loading the whole table into the UI.
#[tauri::command(async)]
pub fn check_port(port: u32) -> Result<PortStatus> {
    let port = validate_port(port)?;
    port_service::check(port)
}

/// FR-021 — inclusive range scan, e.g. 3000-3100.
#[tauri::command(async)]
pub fn check_port_range(start: u32, end: u32) -> Result<Vec<PortStatus>> {
    let start = validate_port(start)?;
    let end = validate_port(end)?;
    let span = start.abs_diff(end) as u32;
    if span > 1024 {
        return Err(crate::error::Error::InvalidInput(format!(
            "That range covers {} ports. Please scan at most 1025 ports at a time.",
            span + 1
        )));
    }
    port_service::check_range(start, end)
}
