//! Port Killer — find it, kill it, free the port.
//!
//! Wires the command surface (SRS §45) to the window, the system tray (FR-023,
//! FR-024) and the optional global shortcut (FR-025).

mod commands;
mod error;
mod models;
mod platform;
mod services;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime, WindowEvent};

use services::settings_service::{Settings, Store};

/// Re-exported for the integration tests, which drive the discovery layer
/// against real sockets without going through the Tauri runtime.
#[doc(hidden)]
pub mod testing {
    pub use crate::services::port_service::{ScanOptions, check, check_range, scan};
    pub use crate::services::settings_service::Store;
    pub use crate::services::process_service::detect_project;

    pub use check as check_port;
}

const TRAY_ID: &str = "port-killer-tray";
const MAIN_WINDOW: &str = "main";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_notification::init())
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ));
    }

    builder
        .setup(|app| {
            // Local state first — the tray and shortcut both read from it.
            let config_dir = app.path().app_config_dir()?;
            let store = Store::load(&config_dir);
            let settings = store.settings();
            app.manage(store);

            #[cfg(desktop)]
            {
                build_tray(app.handle())?;
                apply_settings(app.handle(), &settings);
            }

            // §38 — "Start Minimized".
            if settings.start_minimized {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // FR-023 — closing the window keeps the app alive in the tray
                // when the user asked for that.
                let close_to_tray = window
                    .app_handle()
                    .try_state::<Store>()
                    .map(|s| s.settings().close_to_tray)
                    .unwrap_or(false);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(command_handler())
        .build(tauri::generate_context!())
        .expect("error while running Port Killer")
        .run(|app, event| {
            // Hiding the last window must not quit the app while it is meant to
            // stay in the tray — but with that turned off, closing the window
            // should end the process rather than leave it running invisibly.
            if let RunEvent::ExitRequested { api, .. } = event {
                let stay_resident = app
                    .try_state::<Store>()
                    .map(|s| s.settings().close_to_tray)
                    .unwrap_or(false);
                if stay_resident {
                    api.prevent_exit();
                }
            }
        });
}

/// The command surface, in one place so both `run` and the integration tests
/// mount exactly the same handlers.
fn command_handler<R: Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
            commands::ports::get_active_ports,
            commands::ports::get_port_info,
            commands::ports::check_port,
            commands::ports::check_port_range,
            commands::process::get_process_details,
            commands::process::get_process_groups,
            commands::process::find_processes_by_name,
            commands::kill::kill_port,
            commands::kill::kill_process,
            commands::kill::force_kill_process,
            commands::kill::kill_processes,
            commands::kill::kill_processes_by_name,
            commands::system::get_system_info,
            commands::system::get_settings,
            commands::system::save_settings,
            commands::system::get_favorites,
            commands::system::add_favorite,
            commands::system::remove_favorite,
            commands::system::get_presets,
            commands::system::save_presets,
            commands::system::reset_presets,
            commands::system::get_history,
            commands::system::clear_history,
            commands::system::reveal_directory,
        ]
}

/// Registers the command surface and the local state store on a builder.
/// Tests build on this so they exercise the real wiring rather than a copy.
pub fn configure<R: Runtime>(builder: tauri::Builder<R>, store: Store) -> tauri::Builder<R> {
    builder.manage(store).invoke_handler(command_handler())
}

/// Bring the dashboard to the front (tray, shortcut, second-instance).
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// §54 — optional desktop notification.
pub fn notify<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str) {
    #[cfg(desktop)]
    {
        use tauri_plugin_notification::{Notification, NotificationExt};
        // `notification()` panics when the plugin is not mounted, which is the
        // case in tests and on any build that leaves notifications out.
        if app.try_state::<Notification<R>>().is_none() {
            return;
        }
        let _ = app.notification().builder().title(title).body(body).show();
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, title, body);
    }
}

/// Re-apply everything that depends on settings after the user saves (§38).
pub fn apply_settings<R: Runtime>(app: &AppHandle<R>, settings: &Settings) {
    #[cfg(desktop)]
    {
        apply_global_shortcut(app, settings);
        apply_autostart(app, settings);
        rebuild_tray_menu(app);
        let _ = app.emit("settings:changed", settings.clone());
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, settings);
    }
}

// ---------------------------------------------------------------------------
// Global shortcut (FR-025)
// ---------------------------------------------------------------------------

#[cfg(desktop)]
fn apply_global_shortcut<R: Runtime>(app: &AppHandle<R>, settings: &Settings) {
    use tauri_plugin_global_shortcut::{GlobalShortcut, GlobalShortcutExt, Shortcut, ShortcutState};

    if app.try_state::<GlobalShortcut<R>>().is_none() {
        return;
    }
    let manager = app.global_shortcut();
    // Simplest correct approach: drop everything we own, then re-register.
    let _ = manager.unregister_all();

    if !settings.global_shortcut_enabled {
        return;
    }

    let Ok(shortcut) = settings.global_shortcut.parse::<Shortcut>() else {
        let _ = app.emit(
            "shortcut:error",
            format!("\"{}\" is not a valid shortcut.", settings.global_shortcut),
        );
        return;
    };

    let registered = manager.on_shortcut(shortcut, move |app, _shortcut, event| {
        // Fire once per press, not again on release.
        if event.state == ShortcutState::Pressed {
            show_main_window(app);
            let _ = app.emit("shortcut:quick-kill", ());
        }
    });

    if registered.is_err() {
        let _ = app.emit(
            "shortcut:error",
            format!(
                "{} is already taken by another application.",
                settings.global_shortcut
            ),
        );
    }
}

/// §38 General — register or remove the login item to match the setting.
#[cfg(desktop)]
fn apply_autostart<R: Runtime>(app: &AppHandle<R>, settings: &Settings) {
    use tauri_plugin_autostart::ManagerExt;

    if app
        .try_state::<tauri_plugin_autostart::AutoLaunchManager>()
        .is_none()
    {
        return;
    }
    let manager = app.autolaunch();
    let result = if settings.launch_at_startup {
        manager.enable()
    } else {
        manager.disable()
    };
    if result.is_err() {
        let _ = app.emit(
            "settings:error",
            "Port Killer could not change the launch-at-startup setting.",
        );
    }
}

// ---------------------------------------------------------------------------
// System tray (FR-023, FR-024)
// ---------------------------------------------------------------------------

#[cfg(desktop)]
fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = tray_menu(app)?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Port Killer")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(handle_tray_menu)
        .on_tray_icon_event(|tray, event| {
            // A plain left click is the fastest way back to the dashboard.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

/// Rebuilt whenever the favourites change so the tray always offers the ports
/// the user actually uses (FR-024).
#[cfg(desktop)]
pub fn rebuild_tray_menu<R: Runtime>(app: &AppHandle<R>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    if let Ok(menu) = tray_menu(app) {
        let _ = tray.set_menu(Some(menu));
    }
}

#[cfg(not(desktop))]
pub fn rebuild_tray_menu<R: Runtime>(_app: &AppHandle<R>) {}

#[cfg(desktop)]
fn tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let open = MenuItem::with_id(app, "tray:open", "Open Dashboard", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "tray:quick", "Quick Kill Port…", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "tray:refresh", "Refresh Ports", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray:quit", "Quit Port Killer", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let favorites = app
        .try_state::<Store>()
        .map(|store| store.favorites())
        .unwrap_or_default();

    let menu = if favorites.is_empty() {
        Menu::with_items(app, &[&open, &quick, &refresh, &separator, &quit])?
    } else {
        // FR-024 — favourite ports one click away.
        let items: Vec<MenuItem<R>> = favorites
            .iter()
            .map(|f| {
                MenuItem::with_id(
                    app,
                    format!("tray:kill:{}", f.port),
                    format!("{} — {}", f.port, f.label),
                    true,
                    None::<&str>,
                )
            })
            .collect::<tauri::Result<_>>()?;
        let refs: Vec<&dyn tauri::menu::IsMenuItem<R>> =
            items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<_>).collect();
        let kill = Submenu::with_items(app, "Kill Port", true, &refs)?;
        Menu::with_items(
            app,
            &[&open, &quick, &kill, &refresh, &separator, &quit],
        )?
    };

    Ok(menu)
}

#[cfg(desktop)]
fn handle_tray_menu<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "tray:open" => show_main_window(app),
        "tray:quick" => {
            show_main_window(app);
            let _ = app.emit("tray:quick-kill", ());
        }
        "tray:refresh" => {
            show_main_window(app);
            let _ = app.emit("ports:changed", ());
        }
        "tray:quit" => app.exit(0),
        id => {
            if let Some(port) = id.strip_prefix("tray:kill:").and_then(|p| p.parse::<u16>().ok()) {
                tray_kill(app.clone(), port);
            }
        }
    }
}

/// Kill straight from the tray, off the UI thread (FR-024).
#[cfg(desktop)]
fn tray_kill<R: Runtime>(app: AppHandle<R>, port: u16) {
    std::thread::spawn(move || {
        let Some(store) = app.try_state::<Store>() else {
            return;
        };
        let message = match commands::kill::free_port(&app, &store, port, false) {
            Ok(results) => results
                .first()
                .map(|r| r.message.clone())
                .unwrap_or_else(|| format!("Nothing to do for port {port}.")),
            Err(e) => e.to_string(),
        };
        let _ = app.emit("ports:changed", ());
        if store.settings().notifications {
            notify(&app, "Port Killer", &message);
        }
    });
}
