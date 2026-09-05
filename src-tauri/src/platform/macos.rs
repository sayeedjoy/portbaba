//! macOS backend (SRS §40).
//!
//! Socket discovery goes through `libproc` (via `netstat2`) rather than parsing
//! `lsof -nP -iTCP -sTCP:LISTEN`, and termination uses POSIX signals directly.

use super::unix;
use super::{PortProvider, RawSocket, SignalOutcome, Termination, enumerate_sockets};
use crate::error::Result;

/// Processes macOS relies on. Killing any of these destabilises the session.
const PROTECTED: &[&str] = &[
    "launchd",
    "kernel_task",
    "WindowServer",
    "loginwindow",
    "coreaudiod",
    "opendirectoryd",
    "securityd",
    "syslogd",
    "notifyd",
    "distnoted",
    "cfprefsd",
    "mds",
    "mds_stores",
    "mDNSResponder",
    "diskarbitrationd",
    "configd",
    "powerd",
    "hidd",
    "logd",
    "UserEventAgent",
    "SystemUIServer",
    "Finder",
    "Dock",
];

#[derive(Debug, Default, Clone, Copy)]
pub struct MacOsPortProvider;

impl PortProvider for MacOsPortProvider {
    fn get_ports(&self, include_udp: bool) -> Result<Vec<RawSocket>> {
        enumerate_sockets(include_udp)
    }

    fn terminate(&self, pid: u32, mode: Termination) -> SignalOutcome {
        unix::terminate(pid, mode)
    }

    fn is_alive(&self, pid: u32) -> bool {
        unix::is_alive(pid)
    }

    fn is_protected(&self, name: &str, pid: u32, executable: Option<&str>) -> bool {
        if pid <= 1 {
            return true;
        }
        if PROTECTED.iter().any(|p| p.eq_ignore_ascii_case(name)) {
            return true;
        }
        executable.is_some_and(|exe| {
            unix::PROTECTED_PREFIXES.iter().any(|p| exe.starts_with(p))
                || exe.starts_with("/usr/bin/")
        })
    }

    fn is_elevated(&self) -> bool {
        unix::is_elevated()
    }
}
