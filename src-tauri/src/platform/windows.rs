//! Windows backend (SRS §42).
//!
//! Socket discovery uses `GetExtendedTcpTable` / `GetExtendedUdpTable` through
//! `netstat2` instead of parsing `netstat`/`tasklist` output.
//!
//! Windows has no SIGTERM. A graceful stop therefore goes through `taskkill`
//! without `/F` (which posts WM_CLOSE to the process's windows first), while a
//! forced stop calls `TerminateProcess` via `sysinfo`. The only value ever
//! interpolated into that command is a `u32` we parsed ourselves, so SR-004
//! holds.

use std::os::windows::process::CommandExt;
use std::process::Command;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

use super::{PortProvider, RawSocket, SignalOutcome, Termination, enumerate_sockets};
use crate::error::Result;

/// Do not let the user shoot Windows in the foot (FR-008).
const PROTECTED: &[&str] = &[
    "System",
    "System Idle Process",
    "Registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "spoolsv.exe",
    "dwm.exe",
    "fontdrvhost.exe",
    "sihost.exe",
    "ctfmon.exe",
    "explorer.exe",
    "MsMpEng.exe",
    "SearchIndexer.exe",
    "Memory Compression",
];

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Default, Clone, Copy)]
pub struct WindowsPortProvider;

impl PortProvider for WindowsPortProvider {
    fn get_ports(&self, include_udp: bool) -> Result<Vec<RawSocket>> {
        enumerate_sockets(include_udp)
    }

    fn terminate(&self, pid: u32, mode: Termination) -> SignalOutcome {
        match mode {
            Termination::Graceful => match Command::new("taskkill")
                .args(["/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                Ok(out) if out.status.success() => SignalOutcome::Delivered,
                Ok(out) => {
                    let text = String::from_utf8_lossy(&out.stderr).to_lowercase();
                    if text.contains("access is denied") {
                        SignalOutcome::PermissionDenied
                    } else if text.contains("not found") {
                        SignalOutcome::NoSuchProcess
                    } else {
                        SignalOutcome::Failed
                    }
                }
                Err(_) => SignalOutcome::Failed,
            },
            Termination::Forced => {
                // `TerminateProcess` through sysinfo — no shell involved.
                let mut system = System::new();
                system.refresh_processes_specifics(
                    ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
                    true,
                    ProcessRefreshKind::nothing(),
                );
                match system.process(Pid::from_u32(pid)) {
                    None => SignalOutcome::NoSuchProcess,
                    Some(process) if process.kill() => SignalOutcome::Delivered,
                    // `OpenProcess` failing here is almost always an ACL problem.
                    Some(_) => SignalOutcome::PermissionDenied,
                }
            }
        }
    }

    fn is_alive(&self, pid: u32) -> bool {
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
            true,
            ProcessRefreshKind::nothing(),
        );
        system.process(Pid::from_u32(pid)).is_some()
    }

    fn is_protected(&self, name: &str, pid: u32, executable: Option<&str>) -> bool {
        if pid <= 4 {
            return true;
        }
        if PROTECTED.iter().any(|p| p.eq_ignore_ascii_case(name)) {
            return true;
        }
        executable.is_some_and(|exe| {
            let lower = exe.to_ascii_lowercase().replace('/', "\\");
            lower.contains("\\windows\\system32\\") || lower.contains("\\windows\\syswow64\\")
        })
    }

    fn is_elevated(&self) -> bool {
        // A non-elevated process cannot open the SCM database for write.
        Command::new("net")
            .args(["session"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
