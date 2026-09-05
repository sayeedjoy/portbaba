//! Port-level data model (SRS §46).

use serde::{Deserialize, Serialize};

use super::process_info::ProjectInfo;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Protocol {
    Tcp,
    Udp,
}

impl Protocol {
    pub fn as_str(&self) -> &'static str {
        match self {
            Protocol::Tcp => "TCP",
            Protocol::Udp => "UDP",
        }
    }
}

/// One socket bound on this machine, enriched with whatever we could learn
/// about the process behind it (FR-001).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    /// Stable identity for React keys and multi-select: protocol/address/port/pid.
    pub id: String,
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub protocol: Protocol,
    pub address: String,
    /// LISTEN, ESTABLISHED, UDP, … — normalised upper case.
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    /// FR-008 — true when killing this would be dangerous.
    pub protected: bool,
    /// True when we could not resolve the owning process (permissions).
    pub owner_unknown: bool,
    /// FR-018 / §59 — best-effort project + framework detection.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<ProjectInfo>,
}

impl PortInfo {
    pub fn make_id(protocol: Protocol, address: &str, port: u16, pid: u32) -> String {
        format!("{}:{}:{}:{}", protocol.as_str(), address, port, pid)
    }
}

/// FR-013 / FR-014 — the answer to "is this port free?".
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortStatus {
    pub port: u16,
    pub available: bool,
    /// Every socket currently bound to this port (may be several).
    pub entries: Vec<PortInfo>,
}

/// FR-047 — result of a termination attempt.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillResult {
    pub success: bool,
    pub pid: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    pub message: String,
    /// Machine-readable outcome so the UI can pick the right tone.
    pub outcome: KillOutcome,
    /// Whether SIGKILL / `taskkill /F` semantics were used.
    pub forced: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum KillOutcome {
    /// The process is gone and the port is free.
    Terminated,
    /// Nothing was listening — the port was already available (§53).
    AlreadyFree,
    /// The process vanished on its own before we signalled it (§53).
    Vanished,
    /// The OS refused; elevation required (§49).
    PermissionDenied,
    /// Blocked by the protected-process guard (FR-008).
    Blocked,
    /// The signal was delivered but the process is still alive.
    Failed,
}
