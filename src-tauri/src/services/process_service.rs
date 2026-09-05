//! Process discovery and enrichment (FR-016, FR-017, FR-018).
//!
//! Everything here is best-effort by design: §51 requires that a process
//! disappearing mid-scan, or metadata we are not allowed to read, degrades to a
//! missing field rather than an error.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind, Users};

use crate::models::ProjectInfo;
use crate::platform::{PortProvider, provider};

/// A flattened, owned view of one `sysinfo::Process`.
#[derive(Debug, Clone)]
pub struct ProcessSnapshot {
    pub pid: u32,
    pub name: String,
    pub parent_pid: Option<u32>,
    pub executable: Option<String>,
    pub command: Option<String>,
    pub user: Option<String>,
    pub cwd: Option<String>,
    pub started_at: Option<u64>,
    pub run_time: Option<u64>,
    pub memory_bytes: u64,
    pub protected: bool,
    pub project: Option<ProjectInfo>,
}

fn refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing()
        .with_memory()
        .with_exe(UpdateKind::Always)
        .with_cmd(UpdateKind::Always)
        .with_cwd(UpdateKind::Always)
        .with_user(UpdateKind::Always)
}

/// Look up a specific set of PIDs. Cheaper than a full scan, which matters for
/// the 500 ms discovery budget in §50 — we only ever need the processes that
/// actually own a socket.
pub fn snapshot_pids(pids: &[u32]) -> HashMap<u32, ProcessSnapshot> {
    if pids.is_empty() {
        return HashMap::new();
    }
    let unique: HashSet<u32> = pids.iter().copied().collect();
    let wanted: Vec<Pid> = unique.iter().map(|p| Pid::from_u32(*p)).collect();

    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&wanted), true, refresh_kind());
    let users = Users::new_with_refreshed_list();

    unique
        .into_iter()
        .filter_map(|pid| {
            let process = system.process(Pid::from_u32(pid))?;
            Some((pid, build(pid, process, &users)))
        })
        .collect()
}

/// One process, or `None` if it has already exited.
pub fn snapshot_pid(pid: u32) -> Option<ProcessSnapshot> {
    snapshot_pids(&[pid]).remove(&pid)
}

fn build(pid: u32, process: &sysinfo::Process, users: &Users) -> ProcessSnapshot {
    let name = process.name().to_string_lossy().to_string();
    let executable = process
        .exe()
        .map(|p| p.to_string_lossy().to_string())
        .filter(|s| !s.is_empty());

    let command = {
        let parts: Vec<String> = process
            .cmd()
            .iter()
            .map(|s| s.to_string_lossy().to_string())
            .collect();
        if parts.is_empty() {
            None
        } else {
            Some(parts.join(" "))
        }
    };

    let user = process
        .user_id()
        .and_then(|uid| users.get_user_by_id(uid))
        .map(|u| u.name().to_string());

    let cwd = process
        .cwd()
        .map(|p| p.to_string_lossy().to_string())
        .filter(|s| !s.is_empty());

    let start_time = process.start_time();
    let run_time = process.run_time();

    let project = detect_project(cwd.as_deref(), command.as_deref(), &name);

    ProcessSnapshot {
        pid,
        protected: provider().is_protected(&name, pid, executable.as_deref()),
        name,
        parent_pid: process.parent().map(|p| p.as_u32()),
        executable,
        command,
        user,
        cwd,
        started_at: (start_time > 0).then_some(start_time),
        run_time: (start_time > 0).then_some(run_time),
        memory_bytes: process.memory(),
        project,
    }
}

/// FR-018 / §59 — work out which project a dev server belongs to.
///
/// The command line is the cheap, always-available signal; the working
/// directory gives us the human-readable project name. Neither is guaranteed,
/// so any combination of the two can be missing.
pub fn detect_project(
    cwd: Option<&str>,
    command: Option<&str>,
    process_name: &str,
) -> Option<ProjectInfo> {
    let framework = detect_framework(command, process_name, cwd);
    let directory = cwd?;

    // A process sitting in `/` or the user's home has not told us anything
    // useful — claiming "project: joy" would be actively misleading.
    let path = Path::new(directory);
    let uninformative = directory == "/"
        || dirs_home().is_some_and(|home| path == Path::new(&home))
        || directory.is_empty();
    if uninformative && framework.is_none() {
        return None;
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| directory.to_string());

    Some(ProjectInfo {
        directory: directory.to_string(),
        name,
        framework,
    })
}

fn dirs_home() -> Option<String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
}

/// Framework fingerprints, most specific first (§59).
const FRAMEWORK_HINTS: &[(&str, &str)] = &[
    ("next dev", "Next.js"),
    ("next start", "Next.js"),
    ("/next/dist", "Next.js"),
    ("nuxt", "Nuxt"),
    ("vite", "Vite"),
    ("astro", "Astro"),
    ("remix", "Remix"),
    ("react-scripts", "Create React App"),
    ("vue-cli-service", "Vue CLI"),
    ("ng serve", "Angular"),
    ("@angular/cli", "Angular"),
    ("webpack-dev-server", "Webpack Dev Server"),
    ("nodemon", "Node.js"),
    ("ts-node", "Node.js"),
    ("manage.py runserver", "Django"),
    ("gunicorn", "Gunicorn"),
    ("uvicorn", "Uvicorn"),
    ("flask run", "Flask"),
    ("artisan serve", "Laravel"),
    ("rails server", "Ruby on Rails"),
    ("spring-boot", "Spring Boot"),
    ("org.springframework", "Spring Boot"),
    ("dotnet run", "ASP.NET Core"),
    ("dotnet watch", "ASP.NET Core"),
    ("air ", "Go (Air)"),
    ("cargo run", "Rust"),
];

/// Well-known services identified by executable name alone.
const SERVICE_HINTS: &[(&str, &str)] = &[
    ("postgres", "PostgreSQL"),
    ("mysqld", "MySQL"),
    ("mariadbd", "MariaDB"),
    ("redis-server", "Redis"),
    ("mongod", "MongoDB"),
    ("com.docker.backend", "Docker"),
    ("dockerd", "Docker"),
    ("containerd", "Docker"),
    ("elasticsearch", "Elasticsearch"),
    ("grafana", "Grafana"),
    ("nginx", "nginx"),
    ("httpd", "Apache"),
    ("rabbitmq", "RabbitMQ"),
    ("memcached", "Memcached"),
    ("minio", "MinIO"),
];

fn detect_framework(command: Option<&str>, process_name: &str, cwd: Option<&str>) -> Option<String> {
    let haystack = command.unwrap_or_default().to_ascii_lowercase();
    if let Some((_, label)) = FRAMEWORK_HINTS
        .iter()
        .find(|(needle, _)| haystack.contains(needle))
    {
        return Some((*label).to_string());
    }

    let name = process_name.to_ascii_lowercase();
    if let Some((_, label)) = SERVICE_HINTS
        .iter()
        .find(|(needle, _)| name.contains(needle) || haystack.contains(needle))
    {
        return Some((*label).to_string());
    }

    // Last resort: look for a marker file next to the process (cheap, and only
    // reached when the command line was uninformative).
    let dir = Path::new(cwd?);
    for (marker, label) in [
        ("next.config.js", "Next.js"),
        ("next.config.mjs", "Next.js"),
        ("next.config.ts", "Next.js"),
        ("vite.config.ts", "Vite"),
        ("vite.config.js", "Vite"),
        ("nuxt.config.ts", "Nuxt"),
        ("angular.json", "Angular"),
        ("manage.py", "Django"),
        ("artisan", "Laravel"),
        ("Gemfile", "Ruby"),
        ("pom.xml", "Java / Maven"),
        ("build.gradle", "Java / Gradle"),
        ("Cargo.toml", "Rust"),
        ("go.mod", "Go"),
    ] {
        if dir.join(marker).exists() {
            return Some(label.to_string());
        }
    }
    None
}
