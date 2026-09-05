//! Process commands (FR-003, FR-016, FR-017, FR-018, §35).

use crate::error::{Error, Result, validate_pid};
use crate::models::{ProcessGroup, ProcessInfo};
use crate::services::port_service::{self, ScanOptions};
use crate::services::process_service;

/// FR-016 — the detail panel behind a table row.
#[tauri::command(async)]
pub fn get_process_details(pid: u32) -> Result<ProcessInfo> {
    let pid = validate_pid(pid)?;
    let snapshot = process_service::snapshot_pid(pid)
        .ok_or_else(|| Error::NotFound(format!("Process {pid} is no longer running.")))?;

    // Which ports does it hold right now? Best-effort: a failed socket scan must
    // not hide the process information we already have (§51).
    let ports = port_service::scan(ScanOptions {
        include_udp: true,
        include_established: true,
    })
    .map(|all| {
        let mut ports: Vec<u16> = all
            .into_iter()
            .filter(|p| p.pid == pid)
            .map(|p| p.port)
            .collect();
        ports.sort_unstable();
        ports.dedup();
        ports
    })
    .unwrap_or_default();

    Ok(ProcessInfo {
        pid: snapshot.pid,
        name: snapshot.name,
        parent_pid: snapshot.parent_pid,
        executable: snapshot.executable,
        command: snapshot.command,
        user: snapshot.user,
        cwd: snapshot.cwd,
        started_at: snapshot.started_at,
        run_time: snapshot.run_time,
        memory_bytes: snapshot.memory_bytes,
        protected: snapshot.protected,
        project: snapshot.project,
        ports,
    })
}

/// §35 — ports grouped under the process that owns them.
#[tauri::command(async)]
pub fn get_process_groups(options: Option<ScanOptions>) -> Result<Vec<ProcessGroup>> {
    port_service::grouped(options.unwrap_or_default())
}

/// FR-020 — preview which processes "Kill all Node processes" would hit,
/// so the warning can name the ports before anything is terminated.
#[tauri::command(async)]
pub fn find_processes_by_name(name: String) -> Result<Vec<ProcessGroup>> {
    let needle = name.trim().to_ascii_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }
    Ok(port_service::grouped(ScanOptions {
        include_udp: true,
        include_established: false,
    })?
    .into_iter()
    .filter(|g| g.name.to_ascii_lowercase().contains(&needle))
    .collect())
}
