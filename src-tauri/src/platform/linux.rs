//! Linux backend (SRS §41).
//!
//! Socket discovery uses netlink with a `/proc` fallback (via `netstat2`) rather
//! than shelling out to `ss -lptn`, and termination uses POSIX signals.

use super::unix;
use super::{enumerate_sockets, PortProvider, RawSocket, SignalOutcome, Termination};
use crate::error::Result;

/// Init systems and core daemons that must not be terminated (FR-008).
const PROTECTED: &[&str] = &[
    "systemd",
    "systemd-journald",
    "systemd-logind",
    "systemd-udevd",
    "systemd-resolved",
    "systemd-networkd",
    "init",
    "kthreadd",
    "dbus-daemon",
    "dbus-broker",
    "NetworkManager",
    "sshd",
    "polkitd",
    "udevd",
    "rsyslogd",
    "cron",
    "crond",
    "Xorg",
    "gdm",
    "gdm3",
    "sddm",
    "lightdm",
    "gnome-shell",
];

#[derive(Debug, Default, Clone, Copy)]
pub struct LinuxPortProvider;

impl PortProvider for LinuxPortProvider {
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
        // Kernel threads have no executable path at all.
        executable.is_none_or(|exe| {
            exe.is_empty() || unix::PROTECTED_PREFIXES.iter().any(|p| exe.starts_with(p))
        })
    }

    fn is_elevated(&self) -> bool {
        unix::is_elevated()
    }
}
