//! Local, server-free persistence for settings, favourites, presets and history
//! (§27, FR-012, FR-015, FR-022, §38).
//!
//! Everything lives in one JSON file inside the platform config directory and is
//! written atomically, so a crash mid-save cannot leave a truncated file behind.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::Result;

const HISTORY_LIMIT: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    // General
    pub launch_at_startup: bool,
    pub start_minimized: bool,
    pub close_to_tray: bool,

    // Port scanner
    pub auto_refresh: bool,
    /// Seconds between automatic refreshes (FR-010). Default 5.
    pub refresh_interval: u32,
    pub show_udp: bool,
    pub show_established: bool,

    // Safety
    pub confirm_before_kill: bool,
    pub allow_force_kill: bool,
    pub protect_system_processes: bool,

    // Appearance
    /// "system" | "light" | "dark"
    pub theme: String,

    // Notifications (§54) and shortcuts (FR-025)
    pub notifications: bool,
    pub global_shortcut_enabled: bool,
    pub global_shortcut: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            launch_at_startup: false,
            start_minimized: false,
            close_to_tray: false,

            auto_refresh: true,
            refresh_interval: 5,
            show_udp: false,
            show_established: false,

            confirm_before_kill: true,
            allow_force_kill: true,
            protect_system_processes: true,

            theme: "system".to_string(),

            notifications: true,
            global_shortcut_enabled: false,
            global_shortcut: default_shortcut().to_string(),
        }
    }
}

pub fn default_shortcut() -> &'static str {
    if cfg!(target_os = "macos") {
        "Cmd+Shift+K"
    } else {
        "Ctrl+Shift+K"
    }
}

/// FR-012 — a port the user cares about, with a human label.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoritePort {
    pub id: String,
    pub port: u16,
    pub label: String,
    #[serde(default)]
    pub description: String,
}

/// FR-015 — a well-known development port. Seeded, but fully editable.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortPreset {
    pub id: String,
    pub port: u16,
    pub name: String,
    #[serde(default)]
    pub category: String,
}

/// FR-022 — one line in the local activity log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    /// Unix epoch milliseconds.
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    pub pid: u32,
    pub process_name: String,
    /// "Kill" | "Force Kill"
    pub action: String,
    /// "Success" | "Failed" | "Blocked" | "Permission denied" | …
    pub result: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppState {
    pub settings: Settings,
    pub favorites: Vec<FavoritePort>,
    pub presets: Vec<PortPreset>,
    pub history: Vec<HistoryEntry>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            settings: Settings::default(),
            favorites: default_favorites(),
            presets: default_presets(),
            history: Vec::new(),
        }
    }
}

/// The starter set from FR-012.
fn default_favorites() -> Vec<FavoritePort> {
    [
        (3000u16, "Frontend", "Next.js / React development server"),
        (5173, "Vite", "Vite development server"),
        (5000, "ASP.NET", "ASP.NET Core (HTTP)"),
        (8000, "Django", "Django development server"),
        (5432, "PostgreSQL", "Local PostgreSQL instance"),
    ]
    .into_iter()
    .map(|(port, label, description)| FavoritePort {
        id: new_id(port as u64),
        port,
        label: label.to_string(),
        description: description.to_string(),
    })
    .collect()
}

/// The catalogue from FR-015.
fn default_presets() -> Vec<PortPreset> {
    [
        (3000u16, "React / Next.js", "Web"),
        (3001, "React (alternate)", "Web"),
        (4200, "Angular", "Web"),
        (5173, "Vite", "Web"),
        (8080, "HTTP alternate", "Web"),
        (5000, "ASP.NET Core (HTTP)", "Backend"),
        (5001, "ASP.NET Core (HTTPS)", "Backend"),
        (8000, "Django / FastAPI", "Backend"),
        (9000, "PHP-FPM / SonarQube", "Backend"),
        (5432, "PostgreSQL", "Database"),
        (3306, "MySQL / MariaDB", "Database"),
        (6379, "Redis", "Database"),
        (27017, "MongoDB", "Database"),
        (1433, "SQL Server", "Database"),
        (2375, "Docker", "Infrastructure"),
        (9200, "Elasticsearch", "Infrastructure"),
        (3100, "Grafana Loki", "Infrastructure"),
        (5672, "RabbitMQ", "Infrastructure"),
        (9092, "Kafka", "Infrastructure"),
    ]
    .into_iter()
    .map(|(port, name, category)| PortPreset {
        id: new_id(port as u64),
        port,
        name: name.to_string(),
        category: category.to_string(),
    })
    .collect()
}

/// Small, dependency-free unique id: millisecond clock plus a discriminator.
pub fn new_id(seed: u64) -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    format!("{millis:x}-{seed:x}")
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Owns the on-disk state. Registered as Tauri managed state.
pub struct Store {
    path: PathBuf,
    inner: Mutex<AppState>,
}

impl Store {
    /// Loads existing state, falling back to defaults if the file is missing or
    /// unreadable — a corrupt config must never stop the app from starting.
    pub fn load(dir: &Path) -> Self {
        let path = dir.join("state.json");
        let inner = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<AppState>(&raw).ok())
            .unwrap_or_default();
        Self {
            path,
            inner: Mutex::new(inner),
        }
    }

    fn with<T>(&self, f: impl FnOnce(&AppState) -> T) -> T {
        let guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        f(&guard)
    }

    fn mutate<T>(&self, f: impl FnOnce(&mut AppState) -> T) -> Result<T> {
        let (value, snapshot) = {
            let mut guard = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            let value = f(&mut guard);
            (value, guard.clone())
        };
        self.persist(&snapshot)?;
        Ok(value)
    }

    fn persist(&self, state: &AppState) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(state)?;
        // Write-then-rename so a partial write can never replace good state.
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json)?;
        fs::rename(&tmp, &self.path)?;
        Ok(())
    }

    // ---- settings -------------------------------------------------------

    pub fn settings(&self) -> Settings {
        self.with(|s| s.settings.clone())
    }

    pub fn save_settings(&self, settings: Settings) -> Result<Settings> {
        let settings = sanitise(settings);
        self.mutate(|s| {
            s.settings = settings.clone();
            settings
        })
    }

    // ---- favourites (FR-012) --------------------------------------------

    pub fn favorites(&self) -> Vec<FavoritePort> {
        self.with(|s| s.favorites.clone())
    }

    pub fn add_favorite(&self, port: u16, label: String, description: String) -> Result<Vec<FavoritePort>> {
        self.mutate(|s| {
            if let Some(existing) = s.favorites.iter_mut().find(|f| f.port == port) {
                existing.label = label;
                existing.description = description;
            } else {
                s.favorites.push(FavoritePort {
                    id: new_id(port as u64),
                    port,
                    label,
                    description,
                });
                s.favorites.sort_by_key(|f| f.port);
            }
            s.favorites.clone()
        })
    }

    pub fn remove_favorite(&self, id: &str) -> Result<Vec<FavoritePort>> {
        self.mutate(|s| {
            s.favorites.retain(|f| f.id != id);
            s.favorites.clone()
        })
    }

    // ---- presets (FR-015) -----------------------------------------------

    pub fn presets(&self) -> Vec<PortPreset> {
        self.with(|s| s.presets.clone())
    }

    pub fn save_presets(&self, presets: Vec<PortPreset>) -> Result<Vec<PortPreset>> {
        self.mutate(|s| {
            s.presets = presets;
            s.presets.clone()
        })
    }

    pub fn reset_presets(&self) -> Result<Vec<PortPreset>> {
        self.mutate(|s| {
            s.presets = default_presets();
            s.presets.clone()
        })
    }

    // ---- history (FR-022) -----------------------------------------------

    pub fn history(&self) -> Vec<HistoryEntry> {
        self.with(|s| s.history.clone())
    }

    pub fn record(&self, entry: HistoryEntry) -> Result<()> {
        self.mutate(|s| {
            s.history.insert(0, entry);
            s.history.truncate(HISTORY_LIMIT);
        })
    }

    pub fn clear_history(&self) -> Result<()> {
        self.mutate(|s| s.history.clear())
    }
}

/// Keep persisted settings inside the ranges the UI offers (§15).
fn sanitise(mut settings: Settings) -> Settings {
    const ALLOWED_INTERVALS: [u32; 5] = [1, 2, 5, 10, 30];
    if !ALLOWED_INTERVALS.contains(&settings.refresh_interval) {
        settings.refresh_interval = 5;
    }
    if !matches!(settings.theme.as_str(), "system" | "light" | "dark") {
        settings.theme = "system".to_string();
    }
    if settings.global_shortcut.trim().is_empty() {
        settings.global_shortcut = default_shortcut().to_string();
    }
    settings
}

impl std::fmt::Debug for Store {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Store").field("path", &self.path).finish()
    }
}

