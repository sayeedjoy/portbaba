//! System information and local-state commands (§38, §49, FR-012, FR-015, FR-022).

use tauri::{AppHandle, Runtime, State};

use crate::error::{validate_port, Error, Result};
use crate::models::SystemInfo;
use crate::services::settings_service::{FavoritePort, HistoryEntry, PortPreset, Settings, Store};

/// §49 — lets the UI explain up front whether elevation is available.
#[tauri::command(async)]
pub fn get_system_info<R: Runtime>(app: AppHandle<R>) -> Result<SystemInfo> {
    use crate::platform::{provider, PortProvider};

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: sysinfo::System::host_name(),
        os_version: sysinfo::System::long_os_version(),
        elevated: provider().is_elevated(),
        app_version: app.package_info().version.to_string(),
    })
}

// ---- settings (§38) -------------------------------------------------------

#[tauri::command(async)]
pub fn get_settings(store: State<'_, Store>) -> Result<Settings> {
    Ok(store.settings())
}

#[tauri::command(async)]
pub fn save_settings<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    settings: Settings,
) -> Result<Settings> {
    let saved = store.save_settings(settings)?;
    // The global shortcut and tray both read from settings, so re-apply them.
    crate::apply_settings(&app, &saved);
    Ok(saved)
}

// ---- favourites (FR-012) --------------------------------------------------

#[tauri::command(async)]
pub fn get_favorites(store: State<'_, Store>) -> Result<Vec<FavoritePort>> {
    Ok(store.favorites())
}

#[tauri::command(async)]
pub fn add_favorite<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    port: u32,
    label: String,
    description: Option<String>,
) -> Result<Vec<FavoritePort>> {
    let port = validate_port(port)?;
    let label = {
        let trimmed = label.trim();
        if trimmed.is_empty() {
            format!("Port {port}")
        } else {
            trimmed.to_string()
        }
    };
    let favorites = store.add_favorite(
        port,
        label,
        description.unwrap_or_default().trim().to_string(),
    )?;
    crate::rebuild_tray_menu(&app);
    Ok(favorites)
}

#[tauri::command(async)]
pub fn remove_favorite<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, Store>,
    id: String,
) -> Result<Vec<FavoritePort>> {
    let favorites = store.remove_favorite(&id)?;
    crate::rebuild_tray_menu(&app);
    Ok(favorites)
}

// ---- presets (FR-015) -----------------------------------------------------

#[tauri::command(async)]
pub fn get_presets(store: State<'_, Store>) -> Result<Vec<PortPreset>> {
    Ok(store.presets())
}

#[tauri::command(async)]
pub fn save_presets(store: State<'_, Store>, presets: Vec<PortPreset>) -> Result<Vec<PortPreset>> {
    for preset in &presets {
        validate_port(preset.port as u32)?;
    }
    store.save_presets(presets)
}

#[tauri::command(async)]
pub fn reset_presets(store: State<'_, Store>) -> Result<Vec<PortPreset>> {
    store.reset_presets()
}

// ---- history (FR-022) -----------------------------------------------------

#[tauri::command(async)]
pub fn get_history(store: State<'_, Store>) -> Result<Vec<HistoryEntry>> {
    Ok(store.history())
}

#[tauri::command(async)]
pub fn clear_history(store: State<'_, Store>) -> Result<()> {
    store.clear_history()
}

// ---- misc -----------------------------------------------------------------

/// §59 — "Open Folder" next to a detected project.
///
/// SR-004: the path is checked to be an existing directory before it is handed
/// to the platform opener, and it is never passed through a shell.
#[tauri::command(async)]
pub fn reveal_directory<R: Runtime>(app: AppHandle<R>, path: String) -> Result<()> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err(Error::NotFound(format!("{path} is not a directory.")));
    }
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| Error::Platform(e.to_string()))
}
