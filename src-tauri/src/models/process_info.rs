//! Process-level data model (FR-016, FR-017, FR-018).

use serde::{Deserialize, Serialize};

use super::port_info::PortInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    /// Working directory of the process.
    pub directory: String,
    /// Last path segment — usually the project folder name.
    pub name: String,
    /// Next.js, Vite, Django, … when we can tell (§59).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub framework: Option<String>,
}

/// Everything we managed to learn about a single process.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    /// FR-017 — full command line used to start the process.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    /// Unix epoch seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<u64>,
    /// Seconds since start.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_time: Option<u64>,
    pub memory_bytes: u64,
    pub protected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<ProjectInfo>,
    /// Ports this process currently holds.
    pub ports: Vec<u16>,
}

/// FR-003 / §35 — ports grouped under the process that owns them.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessGroup {
    pub pid: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    pub protected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<ProjectInfo>,
    pub ports: Vec<PortInfo>,
}

/// §49 — what the app knows about its own privileges.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_version: Option<String>,
    /// Running as root / Administrator.
    pub elevated: bool,
    pub app_version: String,
}
