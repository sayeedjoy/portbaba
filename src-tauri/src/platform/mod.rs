//! Platform abstraction (SRS §39).
//!
//! Socket enumeration itself is uniform across the three desktop targets: we go
//! through `netstat2`, which sits on `GetExtendedTcpTable`/`GetExtendedUdpTable`
//! on Windows (§42), netlink/`/proc` on Linux (§41) and `libproc` on macOS (§40)
//! — native APIs rather than parsing `netstat`/`lsof` output.
//!
//! What genuinely differs per platform is *termination semantics* and a few
//! enrichment lookups, so those live behind [`PortProvider`] implementations
//! selected at compile time.

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};

use crate::error::{Error, Result};
use crate::models::Protocol;

#[cfg(unix)]
mod unix;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
pub use linux::LinuxPortProvider as Platform;
#[cfg(target_os = "macos")]
pub use macos::MacOsPortProvider as Platform;
#[cfg(target_os = "windows")]
pub use windows::WindowsPortProvider as Platform;

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
compile_error!("Port Killer supports Windows, macOS and Linux only.");

/// A socket as the OS reports it, before we attach any process metadata.
#[derive(Debug, Clone)]
pub struct RawSocket {
    pub port: u16,
    pub address: String,
    pub protocol: Protocol,
    pub state: String,
    pub pids: Vec<u32>,
}

/// How a termination request should be delivered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Termination {
    /// Ask the process to shut down cleanly (SIGTERM / `taskkill`).
    Graceful,
    /// Stop it immediately (SIGKILL / `taskkill /F`).
    Forced,
}

/// Outcome of handing a signal to the OS — deliberately narrower than a bool so
/// the caller can distinguish "denied" from "it was already gone" (§53).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignalOutcome {
    Delivered,
    PermissionDenied,
    NoSuchProcess,
    Failed,
}

/// SRS §39 — the common interface every platform backend implements.
pub trait PortProvider {
    /// Enumerate bound sockets.
    fn get_ports(&self, include_udp: bool) -> Result<Vec<RawSocket>>;

    /// Deliver a termination request to `pid`.
    fn terminate(&self, pid: u32, mode: Termination) -> SignalOutcome;

    /// Whether `pid` is still around.
    fn is_alive(&self, pid: u32) -> bool;

    /// Whether this process is one the OS depends on (FR-008).
    fn is_protected(&self, name: &str, pid: u32, executable: Option<&str>) -> bool;

    /// True when the app itself is running with root/Administrator rights.
    fn is_elevated(&self) -> bool;
}

pub fn provider() -> Platform {
    Platform
}

/// Shared socket enumeration used by every backend.
///
/// Reliability (§51): a socket whose owner disappears mid-scan simply comes back
/// with an empty pid list rather than aborting the whole scan.
pub(crate) fn enumerate_sockets(include_udp: bool) -> Result<Vec<RawSocket>> {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let mut proto_flags = ProtocolFlags::TCP;
    if include_udp {
        proto_flags |= ProtocolFlags::UDP;
    }

    let sockets = get_sockets_info(af_flags, proto_flags).map_err(|e| match e {
        netstat2::error::Error::OsError(io)
            if io.kind() == std::io::ErrorKind::PermissionDenied =>
        {
            Error::PermissionDenied(
                "The operating system refused to list network sockets.".to_string(),
            )
        }
        other => Error::Platform(format!("Could not read the socket table: {other}")),
    })?;

    Ok(sockets
        .into_iter()
        .map(|s| {
            let pids = s.associated_pids.clone();
            match s.protocol_socket_info {
                ProtocolSocketInfo::Tcp(tcp) => RawSocket {
                    port: tcp.local_port,
                    address: format_address(&tcp.local_addr.to_string()),
                    protocol: Protocol::Tcp,
                    state: tcp_state_label(tcp.state).to_string(),
                    pids,
                },
                ProtocolSocketInfo::Udp(udp) => RawSocket {
                    port: udp.local_port,
                    address: format_address(&udp.local_addr.to_string()),
                    protocol: Protocol::Udp,
                    state: "UDP".to_string(),
                    pids,
                },
            }
        })
        .collect())
}

/// Render the wildcard/loopback addresses the way developers expect to read them.
fn format_address(addr: &str) -> String {
    match addr {
        "0.0.0.0" => "0.0.0.0".to_string(),
        "::" => "[::]".to_string(),
        "127.0.0.1" => "127.0.0.1".to_string(),
        "::1" => "[::1]".to_string(),
        other if other.contains(':') => format!("[{other}]"),
        other => other.to_string(),
    }
}

fn tcp_state_label(state: TcpState) -> &'static str {
    match state {
        TcpState::Closed => "CLOSED",
        TcpState::Listen => "LISTEN",
        TcpState::SynSent => "SYN_SENT",
        TcpState::SynReceived => "SYN_RECV",
        TcpState::Established => "ESTABLISHED",
        TcpState::FinWait1 => "FIN_WAIT1",
        TcpState::FinWait2 => "FIN_WAIT2",
        TcpState::CloseWait => "CLOSE_WAIT",
        TcpState::Closing => "CLOSING",
        TcpState::LastAck => "LAST_ACK",
        TcpState::TimeWait => "TIME_WAIT",
        TcpState::DeleteTcb => "DELETE_TCB",
        TcpState::Unknown => "UNKNOWN",
    }
}
