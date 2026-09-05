//! Termination commands (FR-004, FR-005, FR-006, FR-008, FR-019, FR-020).
//!
//! Every path through this module goes: validate → identify → check the
//! protected list → signal → verify → record. The verification step is what
//! lets the UI say "port 3000 is now available" honestly instead of assuming
//! the signal worked (§53).

use std::thread::sleep;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::error::{Error, Result, validate_pid, validate_port};
use crate::models::{KillOutcome, KillResult};
use crate::platform::{PortProvider, SignalOutcome, Termination, provider};
use crate::services::port_service;
use crate::services::process_service::{self, ProcessSnapshot};
use crate::services::settings_service::{HistoryEntry, Store, new_id, now_millis};

/// How long we wait for a process to actually go away before reporting back.
const GRACEFUL_WAIT: Duration = Duration::from_millis(1500);
const FORCED_WAIT: Duration = Duration::from_millis(700);
const POLL: Duration = Duration::from_millis(50);

/// FR-004 — terminate by PID, gracefully.
#[tauri::command(async)]
pub fn kill_process<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    pid: u32,
) -> Result<KillResult> {
    let result = terminate(&store, pid, None, false)?;
    finish(&app, std::slice::from_ref(&result));
    Ok(result)
}

/// FR-006 — terminate by PID, forcefully.
#[tauri::command(async)]
pub fn force_kill_process<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    pid: u32,
) -> Result<KillResult> {
    let result = terminate(&store, pid, None, true)?;
    finish(&app, std::slice::from_ref(&result));
    Ok(result)
}

/// FR-005 — free a port without the user ever seeing a PID.
///
/// A port can legitimately be held by more than one process (IPv4 + IPv6
/// listeners, pre-forked workers), so this returns one result per process.
#[tauri::command(async)]
pub fn kill_port<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    port: u32,
    force: Option<bool>,
) -> Result<Vec<KillResult>> {
    let port = validate_port(port)?;
    free_port(&app, &store, port, force.unwrap_or(false))
}

/// The body of [`kill_port`], reachable from the tray and the global shortcut
/// as well as from the frontend (FR-024, FR-025).
pub fn free_port<R: Runtime>(
    app: &AppHandle<R>,
    store: &Store,
    port: u16,
    force: bool,
) -> Result<Vec<KillResult>> {
    let owners = port_service::owners_of(port)?;
    if owners.is_empty() {
        // §53 — "Port 3000 is already available."
        let result = KillResult {
            success: true,
            pid: 0,
            port: Some(port),
            process_name: None,
            message: format!("Port {port} is already available."),
            outcome: KillOutcome::AlreadyFree,
            forced: force,
        };
        // The user asked for something; the log should say what happened.
        record(store, &result);
        return Ok(vec![result]);
    }

    let mut pids: Vec<u32> = owners.into_iter().map(|(pid, _)| pid).collect();
    pids.sort_unstable();
    pids.dedup();

    let results: Vec<KillResult> = pids
        .into_iter()
        .map(|pid| {
            terminate(store, pid, Some(port), force).unwrap_or_else(|e| KillResult {
                success: false,
                pid,
                port: Some(port),
                process_name: None,
                message: e.to_string(),
                outcome: match e {
                    Error::PermissionDenied(_) => KillOutcome::PermissionDenied,
                    _ => KillOutcome::Failed,
                },
                forced: force,
            })
        })
        .collect();

    finish(app, &results);
    Ok(results)
}

/// FR-019 — bulk termination of an explicit selection.
#[tauri::command(async)]
pub fn kill_processes<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    pids: Vec<u32>,
    force: Option<bool>,
) -> Result<Vec<KillResult>> {
    let force = force.unwrap_or(false);
    let mut unique = pids;
    unique.sort_unstable();
    unique.dedup();

    let results: Vec<KillResult> = unique
        .into_iter()
        .map(|pid| {
            terminate(&store, pid, None, force).unwrap_or_else(|e| failure(pid, None, force, e))
        })
        .collect();

    finish(&app, &results);
    Ok(results)
}

/// FR-020 — "kill all Node processes". Only processes that currently hold a
/// port are considered: this is a port utility, not a task manager.
#[tauri::command(async)]
pub fn kill_processes_by_name<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    name: String,
    force: Option<bool>,
) -> Result<Vec<KillResult>> {
    let needle = name.trim().to_ascii_lowercase();
    if needle.is_empty() {
        return Err(Error::InvalidInput("No process name was given.".to_string()));
    }
    let force = force.unwrap_or(false);

    let groups = port_service::grouped(crate::services::port_service::ScanOptions {
        include_udp: true,
        include_established: false,
    })?;

    let targets: Vec<(u32, Option<u16>)> = groups
        .into_iter()
        .filter(|g| g.name.to_ascii_lowercase().contains(&needle))
        .map(|g| (g.pid, g.ports.first().map(|p| p.port)))
        .collect();

    if targets.is_empty() {
        return Err(Error::NotFound(format!(
            "No process matching \"{name}\" is holding a port."
        )));
    }

    let results: Vec<KillResult> = targets
        .into_iter()
        .map(|(pid, port)| {
            terminate(&store, pid, port, force).unwrap_or_else(|e| failure(pid, port, force, e))
        })
        .collect();

    finish(&app, &results);
    Ok(results)
}

// ---------------------------------------------------------------------------

/// The single place where a process is actually signalled.
fn terminate(
    store: &Store,
    pid: u32,
    port: Option<u16>,
    force: bool,
) -> Result<KillResult> {
    let pid = validate_pid(pid)?; // SR-003
    let settings = store.settings();

    if force && !settings.allow_force_kill {
        return Err(Error::InvalidInput(
            "Force kill is turned off in Settings → Safety.".to_string(),
        ));
    }

    let snapshot: Option<ProcessSnapshot> = process_service::snapshot_pid(pid);
    let Some(process) = snapshot else {
        // §53 — "The process has already stopped."
        let result = KillResult {
            success: true,
            pid,
            port,
            process_name: None,
            message: port
                .map(|p| format!("The process had already stopped. Port {p} is now available."))
                .unwrap_or_else(|| "The process had already stopped.".to_string()),
            outcome: KillOutcome::Vanished,
            forced: force,
        };
        record(store, &result);
        return Ok(result);
    };

    // FR-008 — refuse to touch the operating system's own machinery.
    if process.protected && settings.protect_system_processes {
        let result = KillResult {
            success: false,
            pid,
            port,
            process_name: Some(process.name.clone()),
            message: format!(
                "{} (PID {pid}) is a system process. Terminating it may cause system instability, \
                 so Port Killer left it alone. You can allow this in Settings → Safety.",
                process.name
            ),
            outcome: KillOutcome::Blocked,
            forced: force,
        };
        record(store, &result);
        return Ok(result);
    }

    let platform = provider();
    let mode = if force {
        Termination::Forced
    } else {
        Termination::Graceful
    };

    let outcome = platform.terminate(pid, mode);
    let result = match outcome {
        SignalOutcome::PermissionDenied => KillResult {
            success: false,
            pid,
            port,
            process_name: Some(process.name.clone()),
            message: permission_message(&process, port),
            outcome: KillOutcome::PermissionDenied,
            forced: force,
        },
        SignalOutcome::NoSuchProcess => KillResult {
            success: true,
            pid,
            port,
            process_name: Some(process.name.clone()),
            message: port
                .map(|p| format!("The process had already stopped. Port {p} is now available."))
                .unwrap_or_else(|| "The process had already stopped.".to_string()),
            outcome: KillOutcome::Vanished,
            forced: force,
        },
        SignalOutcome::Failed => KillResult {
            success: false,
            pid,
            port,
            process_name: Some(process.name.clone()),
            message: format!("Unable to terminate {} (PID {pid}).", process.name),
            outcome: KillOutcome::Failed,
            forced: force,
        },
        SignalOutcome::Delivered => {
            let deadline = if force { FORCED_WAIT } else { GRACEFUL_WAIT };
            if wait_for_exit(pid, deadline) {
                KillResult {
                    success: true,
                    pid,
                    port,
                    process_name: Some(process.name.clone()),
                    message: match port {
                        Some(p) => format!(
                            "{} (PID {pid}) terminated. Port {p} is now available.",
                            process.name
                        ),
                        None => format!("{} (PID {pid}) terminated successfully.", process.name),
                    },
                    outcome: KillOutcome::Terminated,
                    forced: force,
                }
            } else {
                // The signal landed but the process is ignoring it — say so
                // plainly and point at the escalation the user has (§11).
                KillResult {
                    success: false,
                    pid,
                    port,
                    process_name: Some(process.name.clone()),
                    message: if force {
                        format!(
                            "{} (PID {pid}) did not stop. It may be stuck in an uninterruptible state.",
                            process.name
                        )
                    } else {
                        format!(
                            "{} (PID {pid}) ignored the shutdown request. Try Force Kill.",
                            process.name
                        )
                    },
                    outcome: KillOutcome::Failed,
                    forced: force,
                }
            }
        }
    };

    record(store, &result);
    Ok(result)
}

/// §49 — never escalate silently; explain what the user needs to do.
fn permission_message(process: &ProcessSnapshot, port: Option<u16>) -> String {
    let owner = process
        .user
        .as_deref()
        .map(|u| format!(" It is owned by {u}."))
        .unwrap_or_default();
    let elevation = if cfg!(target_os = "windows") {
        "Administrator privileges are required to terminate this process."
    } else {
        "Root privileges are required to terminate this process."
    };
    match port {
        Some(p) => format!(
            "Permission denied. Port {p} is owned by {} (PID {}).{owner} {elevation}",
            process.name, process.pid
        ),
        None => format!(
            "Permission denied for {} (PID {}).{owner} {elevation}",
            process.name, process.pid
        ),
    }
}

/// Poll until the process is gone or we run out of patience.
fn wait_for_exit(pid: u32, budget: Duration) -> bool {
    let platform = provider();
    let started = Instant::now();
    loop {
        if !platform.is_alive(pid) {
            return true;
        }
        if started.elapsed() >= budget {
            return false;
        }
        sleep(POLL);
    }
}

fn failure(pid: u32, port: Option<u16>, force: bool, error: Error) -> KillResult {
    KillResult {
        success: false,
        pid,
        port,
        process_name: None,
        message: error.to_string(),
        outcome: match error {
            Error::PermissionDenied(_) => KillOutcome::PermissionDenied,
            _ => KillOutcome::Failed,
        },
        forced: force,
    }
}

/// FR-022 — append to the local activity log.
fn record(store: &Store, result: &KillResult) {
    let entry = HistoryEntry {
        id: new_id(result.pid as u64),
        timestamp: now_millis(),
        port: result.port,
        pid: result.pid,
        process_name: result
            .process_name
            .clone()
            .unwrap_or_else(|| "Unknown".to_string()),
        action: if result.forced {
            "Force Kill".to_string()
        } else {
            "Kill".to_string()
        },
        result: match result.outcome {
            KillOutcome::Terminated => "Success",
            KillOutcome::AlreadyFree => "Already free",
            KillOutcome::Vanished => "Already stopped",
            KillOutcome::PermissionDenied => "Permission denied",
            KillOutcome::Blocked => "Blocked",
            KillOutcome::Failed => "Failed",
        }
        .to_string(),
        message: result.message.clone(),
    };
    // History is a convenience; failing to write it must not fail the kill.
    let _ = store.record(entry);
}

/// Tell the rest of the app something changed, and raise a notification (§54).
fn finish<R: Runtime>(app: &AppHandle<R>, results: &[KillResult]) {
    let _ = app.emit("ports:changed", ());

    let store = app.try_state::<Store>();
    let notify = store.map(|s| s.settings().notifications).unwrap_or(false);
    if !notify {
        return;
    }
    if let Some(summary) = notification_text(results) {
        crate::notify(app, "Port Killer", &summary);
    }
}

fn notification_text(results: &[KillResult]) -> Option<String> {
    match results {
        [] => None,
        [single] => Some(single.message.clone()),
        many => {
            let freed = many.iter().filter(|r| r.success).count();
            Some(format!(
                "{freed} of {} processes terminated.",
                many.len()
            ))
        }
    }
}
