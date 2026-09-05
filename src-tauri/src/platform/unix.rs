//! Signal handling shared by the macOS and Linux backends (§40, §41).
//!
//! We call `kill(2)` directly rather than shelling out so we can read `errno`
//! and tell "you are not allowed to do that" (§49) apart from "it already
//! exited" (§53) — a distinction the UI leans on heavily.

use super::{SignalOutcome, Termination};

pub fn terminate(pid: u32, mode: Termination) -> SignalOutcome {
    let signal = match mode {
        Termination::Graceful => libc::SIGTERM,
        Termination::Forced => libc::SIGKILL,
    };
    send(pid, signal)
}

pub fn is_alive(pid: u32) -> bool {
    // Signal 0 performs the permission/existence checks without delivering
    // anything, so EPERM still means "alive, just not ours".
    match send(pid, 0) {
        SignalOutcome::Delivered | SignalOutcome::PermissionDenied => true,
        SignalOutcome::NoSuchProcess | SignalOutcome::Failed => false,
    }
}

pub fn is_elevated() -> bool {
    // SAFETY: `geteuid` takes no arguments and cannot fail.
    unsafe { libc::geteuid() == 0 }
}

fn send(pid: u32, signal: i32) -> SignalOutcome {
    if pid > i32::MAX as u32 {
        return SignalOutcome::Failed;
    }
    // SAFETY: `pid` is a validated, positive process id and `signal` is one of
    // the constants above; a positive pid can never address a process group.
    let rc = unsafe { libc::kill(pid as libc::pid_t, signal) };
    if rc == 0 {
        return SignalOutcome::Delivered;
    }
    match std::io::Error::last_os_error().raw_os_error() {
        Some(libc::EPERM) => SignalOutcome::PermissionDenied,
        Some(libc::ESRCH) => SignalOutcome::NoSuchProcess,
        _ => SignalOutcome::Failed,
    }
}

/// Names that should never be terminated from a port utility (FR-008).
pub const PROTECTED_PREFIXES: &[&str] = &["/System/", "/usr/libexec/", "/sbin/", "/usr/sbin/"];
