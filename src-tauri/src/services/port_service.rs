//! Turns raw sockets into the enriched records the UI shows (FR-001, FR-013).

use std::collections::{HashMap, HashSet};

use crate::error::Result;
use crate::models::{PortInfo, PortStatus, ProcessGroup, ProjectInfo, Protocol};
use crate::platform::{provider, PortProvider};
use crate::services::process_service::{self, ProcessSnapshot};

/// What the caller wants to see — mirrors the Port Scanner settings (§38).
/// Both flags default to false: the useful default view is TCP listening
/// sockets, because a developer chasing a port conflict cares about who is
/// *bound*, not who is merely connected.
#[derive(Debug, Clone, Copy, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ScanOptions {
    pub include_udp: bool,
    pub include_established: bool,
}

/// FR-001 — every port currently in use, newest information available.
pub fn scan(options: ScanOptions) -> Result<Vec<PortInfo>> {
    let platform = provider();
    let sockets = platform.get_ports(options.include_udp)?;

    let mut seen: HashSet<String> = HashSet::new();
    let mut rows: Vec<(crate::platform::RawSocket, u32)> = Vec::new();
    let mut pids: Vec<u32> = Vec::new();

    for socket in sockets {
        if !keep_state(&socket.state, options.include_established) {
            continue;
        }
        // A socket can be reported for several PIDs (forked servers); each pair
        // is its own row so the user can see all of them.
        let owners = if socket.pids.is_empty() {
            vec![0]
        } else {
            socket.pids.clone()
        };
        for pid in owners {
            let id = PortInfo::make_id(socket.protocol, &socket.address, socket.port, pid);
            if !seen.insert(id) {
                continue;
            }
            if pid != 0 {
                pids.push(pid);
            }
            rows.push((socket.clone(), pid));
        }
    }

    let processes = process_service::snapshot_pids(&pids);

    let mut ports: Vec<PortInfo> = rows
        .into_iter()
        .map(|(socket, pid)| enrich(socket, pid, processes.get(&pid)))
        .collect();

    ports.sort_by(|a, b| {
        a.port
            .cmp(&b.port)
            .then_with(|| a.protocol.as_str().cmp(b.protocol.as_str()))
            .then_with(|| a.address.cmp(&b.address))
    });
    Ok(ports)
}

fn keep_state(state: &str, include_established: bool) -> bool {
    if include_established {
        return true;
    }
    matches!(state, "LISTEN" | "UDP")
}

fn enrich(
    socket: crate::platform::RawSocket,
    pid: u32,
    process: Option<&ProcessSnapshot>,
) -> PortInfo {
    let id = PortInfo::make_id(socket.protocol, &socket.address, socket.port, pid);
    match process {
        Some(p) => PortInfo {
            id,
            port: socket.port,
            pid,
            process_name: p.name.clone(),
            protocol: socket.protocol,
            address: socket.address,
            state: socket.state,
            executable: p.executable.clone(),
            command: p.command.clone(),
            user: p.user.clone(),
            protected: p.protected,
            owner_unknown: false,
            project: p.project.clone(),
        },
        // §51 — the socket is real even when the owner is not visible to us.
        None => PortInfo {
            id,
            port: socket.port,
            pid,
            process_name: if pid == 0 {
                "Unknown".to_string()
            } else {
                format!("PID {pid}")
            },
            protocol: socket.protocol,
            address: socket.address,
            state: socket.state,
            executable: None,
            command: None,
            user: None,
            protected: false,
            owner_unknown: true,
            project: None,
        },
    }
}

/// FR-002 — everything bound to one port.
pub fn ports_on(port: u16, options: ScanOptions) -> Result<Vec<PortInfo>> {
    Ok(scan(options)?
        .into_iter()
        .filter(|p| p.port == port)
        .collect())
}

/// FR-014 — is this port free? Always looks at TCP *and* UDP, listening and
/// established alike: a port is only "available" if nothing at all holds it.
pub fn check(port: u16) -> Result<PortStatus> {
    let entries = ports_on(
        port,
        ScanOptions {
            include_udp: true,
            include_established: true,
        },
    )?;
    Ok(PortStatus {
        port,
        available: entries.is_empty(),
        entries,
    })
}

/// FR-021 — scan an inclusive range in a single socket-table pass.
pub fn check_range(start: u16, end: u16) -> Result<Vec<PortStatus>> {
    let (low, high) = if start <= end {
        (start, end)
    } else {
        (end, start)
    };

    let all = scan(ScanOptions {
        include_udp: true,
        include_established: true,
    })?;

    let mut by_port: HashMap<u16, Vec<PortInfo>> = HashMap::new();
    for entry in all {
        if entry.port >= low && entry.port <= high {
            by_port.entry(entry.port).or_default().push(entry);
        }
    }

    Ok((low..=high)
        .map(|port| {
            let entries = by_port.remove(&port).unwrap_or_default();
            PortStatus {
                port,
                available: entries.is_empty(),
                entries,
            }
        })
        .collect())
}

/// §35 — the same data, grouped by owning process.
pub fn grouped(options: ScanOptions) -> Result<Vec<ProcessGroup>> {
    let ports = scan(options)?;
    let mut groups: HashMap<u32, ProcessGroup> = HashMap::new();

    for port in ports {
        let entry = groups.entry(port.pid).or_insert_with(|| ProcessGroup {
            pid: port.pid,
            name: port.process_name.clone(),
            executable: port.executable.clone(),
            command: port.command.clone(),
            user: port.user.clone(),
            protected: port.protected,
            project: port.project.clone(),
            ports: Vec::new(),
        });
        entry.ports.push(port);
    }

    let mut list: Vec<ProcessGroup> = groups.into_values().collect();
    for group in &mut list {
        group.ports.sort_by_key(|p| p.port);
    }
    list.sort_by(|a, b| {
        a.name
            .to_ascii_lowercase()
            .cmp(&b.name.to_ascii_lowercase())
            .then_with(|| a.pid.cmp(&b.pid))
    });
    Ok(list)
}

/// Helper for the kill path: which PIDs currently hold `port`?
pub fn owners_of(port: u16) -> Result<Vec<(u32, Protocol)>> {
    Ok(check(port)?
        .entries
        .into_iter()
        .filter(|e| e.pid != 0)
        .map(|e| (e.pid, e.protocol))
        .collect())
}

/// One line in the tray's live list: a port the user could plausibly want back,
/// with enough about the holder to tell two dev servers apart (FR-024).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LivePort {
    pub port: u16,
    pub process_name: String,
    /// "Vite in my-dashboard" when we could work it out (§59).
    pub description: Option<String>,
}

/// The tray's live list — TCP ports currently *listening* that portbaba could
/// actually free.
///
/// Protected processes and sockets whose owner we cannot see are left out
/// rather than shown and refused: a menu entry that always fails is worse than
/// no entry at all (FR-008, §51). One line per port, so a dev server bound on
/// both IPv4 and IPv6, or pre-forked across several PIDs, does not fill the
/// menu with duplicates.
pub fn live_ports(limit: usize) -> Result<Vec<LivePort>> {
    let mut seen: HashSet<u16> = HashSet::new();
    let mut live: Vec<LivePort> = Vec::new();

    // `scan` returns ports in ascending order, so truncating at the limit keeps
    // the low-numbered dev ports a developer is most likely to be after.
    for entry in scan(ScanOptions::default())? {
        if entry.protected || entry.owner_unknown || entry.pid == 0 {
            continue;
        }
        if !seen.insert(entry.port) {
            continue;
        }
        live.push(LivePort {
            port: entry.port,
            process_name: entry.process_name,
            description: entry.project.map(describe),
        });
        if live.len() >= limit {
            break;
        }
    }

    Ok(live)
}

fn describe(project: ProjectInfo) -> String {
    match project.framework {
        Some(framework) => format!("{framework} in {}", project.name),
        None => project.name,
    }
}
