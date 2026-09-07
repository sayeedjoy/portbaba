//! portbaba — find it, kill it, free the port.
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
    pub use crate::services::port_service::{check, check_range, scan, ScanOptions};
    pub use crate::services::process_service::detect_project;
    pub use crate::services::settings_service::Store;

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
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
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
                app.manage(TrayMenuState::default());
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
        .expect("error while running portbaba")
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
    use tauri_plugin_global_shortcut::{
        GlobalShortcut, GlobalShortcutExt, Shortcut, ShortcutState,
    };

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
            "portbaba could not change the launch-at-startup setting.",
        );
    }
}

// ---------------------------------------------------------------------------
// System tray (FR-023, FR-024)
// ---------------------------------------------------------------------------

/// How many live ports the menu lists before it stops. Long enough for a busy
/// machine, short enough that the menu never runs off the bottom of the screen.
#[cfg(desktop)]
const TRAY_PORT_LIMIT: usize = 12;

/// Floor for the live-list refresh.
///
/// Deliberately slower than the dashboard's own refresh: this one runs for as
/// long as the app does, whether or not anyone is looking, so on a laptop it is
/// paid for in battery. The dashboard can afford to poll every five seconds
/// because the user is watching it; the menu only has to be right by the time
/// somebody opens it. A kill from anywhere in the app rebuilds the menu
/// immediately, so this interval only covers ports that appear or vanish on
/// their own.
#[cfg(desktop)]
const TRAY_MIN_REFRESH: u32 = 15;

/// Cadence used when the user has auto-refresh switched off. The tray still has
/// to know what is listening, but there is no hurry about it.
#[cfg(desktop)]
const TRAY_IDLE_REFRESH: u32 = 60;

/// What the tray menu is showing right now.
///
/// Tauri has no "menu is about to open" hook, so the live list cannot be built
/// on demand — it has to be prepared in advance and kept current in the
/// background. The signature lets a refresh that finds nothing new leave the
/// existing menu in place; swapping it out under the cursor is visible on macOS.
#[cfg(desktop)]
#[derive(Default)]
struct TrayMenuState {
    signature: std::sync::Mutex<Option<String>>,
    /// The ports listed at this moment, which is exactly what "Kill All
    /// Processes" acts on — the user chose what they could see.
    listed: std::sync::Mutex<Vec<u16>>,
}

#[cfg(desktop)]
impl TrayMenuState {
    /// A poisoned lock here costs a redundant menu rebuild, nothing more, so
    /// both writes are best-effort.
    fn remember(&self, signature: String, listed: Vec<u16>) {
        if let Ok(mut slot) = self.signature.lock() {
            *slot = Some(signature);
        }
        if let Ok(mut slot) = self.listed.lock() {
            *slot = listed;
        }
    }
}

#[cfg(desktop)]
fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let (menu, signature, listed) = tray_menu(app)?;
    remember(app, signature, listed);

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("portbaba")
        .menu(&menu)
        // A macOS menu-bar item is expected to drop its menu on a plain left
        // click. On Windows and Linux the same click is expected to open the
        // app, so there the menu stays on the right button.
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(handle_tray_menu)
        .on_tray_icon_event(|tray, event| {
            // On macOS that click already belongs to the menu; opening the
            // window as well would fight the menu it just opened.
            if cfg!(target_os = "macos") {
                return;
            }
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
    spawn_tray_refresh(app);
    Ok(())
}

/// Rebuild the menu off the caller's thread.
///
/// Everything the menu shows now comes from a socket scan, so this must never
/// run inline on a command or UI thread.
#[cfg(desktop)]
pub fn rebuild_tray_menu<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    std::thread::spawn(move || refresh_tray_menu(&app));
}

#[cfg(not(desktop))]
pub fn rebuild_tray_menu<R: Runtime>(_app: &AppHandle<R>) {}

/// Scan, then swap the menu in only if what it would show has actually changed.
#[cfg(desktop)]
fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let Ok((menu, signature, listed)) = tray_menu(app) else {
        return;
    };

    if let Some(state) = app.try_state::<TrayMenuState>() {
        let unchanged = state
            .signature
            .lock()
            .is_ok_and(|current| current.as_deref() == Some(signature.as_str()));
        if unchanged {
            return;
        }
    }

    remember(app, signature, listed);
    let _ = tray.set_menu(Some(menu));
}

#[cfg(desktop)]
fn remember<R: Runtime>(app: &AppHandle<R>, signature: String, listed: Vec<u16>) {
    if let Some(state) = app.try_state::<TrayMenuState>() {
        state.remember(signature, listed);
    }
}

/// Keeps the live list current while the window is closed — the point of the
/// menu is that it is right without opening the dashboard first.
#[cfg(desktop)]
fn spawn_tray_refresh<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        let seconds = match app.try_state::<Store>() {
            Some(store) => {
                let settings = store.settings();
                if settings.auto_refresh {
                    settings.refresh_interval.max(TRAY_MIN_REFRESH)
                } else {
                    TRAY_IDLE_REFRESH
                }
            }
            // The store outlives the tray, so losing it means we are shutting
            // down and this thread has nothing left to do.
            None => return,
        };
        std::thread::sleep(std::time::Duration::from_secs(seconds as u64));
        refresh_tray_menu(&app);
    });
}

/// Builds the menu, alongside the signature that says whether it differs from
/// the one on screen and the ports "Kill All Processes" would act on.
#[cfg(desktop)]
fn tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<(Menu<R>, String, Vec<u16>)> {
    // A failed scan is not worth an empty menu bar: fall back to no live ports
    // and leave the rest of the menu working.
    let live = services::port_service::live_ports(TRAY_PORT_LIMIT).unwrap_or_default();
    let favorites = app
        .try_state::<Store>()
        .map(|store| store.favorites())
        .unwrap_or_default();

    let signature = signature_of(&live, &favorites);
    let listed: Vec<u16> = live.iter().map(|p| p.port).collect();

    // Every item has to outlive `items` below, so all of them are built first.
    // Separators are built one per slot rather than shared: a menu item belongs
    // to one position in one menu.
    let sep_after_kill_all = PredefinedMenuItem::separator(app)?;
    let sep_after_ports = PredefinedMenuItem::separator(app)?;
    let sep_before_quit = PredefinedMenuItem::separator(app)?;

    let kill_all = MenuItem::with_id(
        app,
        "tray:killall",
        "Kill All Processes",
        !live.is_empty(),
        None::<&str>,
    )?;

    let live_items: Vec<MenuItem<R>> = live
        .iter()
        .map(|p| {
            MenuItem::with_id(
                app,
                format!("tray:kill:{}", p.port),
                live_label(p),
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<_>>()?;

    // Disabled, and there to say the app is working rather than broken.
    let nothing = MenuItem::with_id(app, "tray:none", "No ports in use", false, None::<&str>)?;

    let open = MenuItem::with_id(app, "tray:open", "Open Dashboard", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "tray:quick", "Quick Kill Port…", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "tray:refresh", "Refresh Ports", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray:quit", "Quit portbaba", true, None::<&str>)?;

    // FR-024 — favourites keep a submenu of their own. A favourite is a port the
    // user cares about whether or not anything is on it, so it needs somewhere
    // to live on the many days it is not in the live list. The ids are prefixed
    // separately so a favourite that *is* live does not produce two menu items
    // sharing one id.
    let favorite_items: Vec<MenuItem<R>> = favorites
        .iter()
        .map(|f| {
            MenuItem::with_id(
                app,
                format!("tray:fav:{}", f.port),
                format!("{} — {}", f.port, f.label),
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<_>>()?;

    let favorites_menu = if favorite_items.is_empty() {
        None
    } else {
        let refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = favorite_items
            .iter()
            .map(|i| i as &dyn tauri::menu::IsMenuItem<R>)
            .collect();
        Some(Submenu::with_items(
            app,
            "Kill Favourite Port",
            true,
            &refs,
        )?)
    };

    let mut items: Vec<&dyn tauri::menu::IsMenuItem<R>> = vec![&kill_all, &sep_after_kill_all];
    if live_items.is_empty() {
        items.push(&nothing);
    } else {
        items.extend(
            live_items
                .iter()
                .map(|i| i as &dyn tauri::menu::IsMenuItem<R>),
        );
    }
    items.push(&sep_after_ports);
    items.push(&open);
    items.push(&quick);
    if let Some(submenu) = &favorites_menu {
        items.push(submenu);
    }
    items.push(&refresh);
    items.push(&sep_before_quit);
    items.push(&quit);

    let menu = Menu::with_items(app, &items)?;
    Ok((menu, signature, listed))
}

/// "Kill: Port 3722: node — Vite in my-dashboard"
#[cfg(desktop)]
fn live_label(port: &services::port_service::LivePort) -> String {
    match &port.description {
        Some(description) => format!(
            "Kill: Port {}: {} — {description}",
            port.port, port.process_name
        ),
        None => format!("Kill: Port {}: {}", port.port, port.process_name),
    }
}

/// Everything the menu renders, flattened. Two menus with the same signature
/// look the same, so the one already on screen can be left alone.
#[cfg(desktop)]
fn signature_of(
    live: &[services::port_service::LivePort],
    favorites: &[services::settings_service::FavoritePort],
) -> String {
    use std::fmt::Write;

    let mut signature = String::new();
    for port in live {
        let _ = write!(
            signature,
            "{}/{}/{}|",
            port.port,
            port.process_name,
            port.description.as_deref().unwrap_or_default()
        );
    }
    signature.push('#');
    for favorite in favorites {
        let _ = write!(signature, "{}/{}|", favorite.port, favorite.label);
    }
    signature
}

#[cfg(desktop)]
fn handle_tray_menu<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "tray:open" => show_main_window(app),
        "tray:quick" => {
            show_main_window(app);
            let _ = app.emit("tray:quick-kill", ());
        }
        // The menu carries the port list itself now, so refreshing it in place
        // is what the item says it does — no need to open a window for that.
        "tray:refresh" => {
            rebuild_tray_menu(app);
            let _ = app.emit("ports:changed", ());
        }
        "tray:killall" => tray_kill_all(app.clone()),
        "tray:quit" => app.exit(0),
        id => {
            if let Some(port) = id
                .strip_prefix("tray:kill:")
                .or_else(|| id.strip_prefix("tray:fav:"))
                .and_then(|p| p.parse::<u16>().ok())
            {
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

        // `free_port` announces everything it actually signalled. These two
        // paths return before it gets that far, so the tray reports them itself
        // rather than every kill arriving as two notifications.
        let unreported = match commands::kill::free_port(&app, &store, port, false) {
            Ok(results) => results
                .first()
                .filter(|r| r.outcome == crate::models::KillOutcome::AlreadyFree)
                .map(|r| r.message.clone()),
            Err(e) => Some(e.to_string()),
        };

        let Some(message) = unreported else {
            return;
        };
        let _ = app.emit("ports:changed", ());
        rebuild_tray_menu(&app);
        if store.settings().notifications {
            notify(&app, "portbaba", &message);
        }
    });
}

/// FR-024 — free everything the menu is listing, in one pass and one summary.
#[cfg(desktop)]
fn tray_kill_all<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || {
        let Some(state) = app.try_state::<TrayMenuState>() else {
            return;
        };
        let Ok(ports) = state.listed.lock().map(|listed| listed.clone()) else {
            return;
        };
        if ports.is_empty() {
            return;
        }

        let Some(store) = app.try_state::<Store>() else {
            return;
        };
        // `free_ports` emits, notifies once and rebuilds the menu for us.
        let _ = commands::kill::free_ports(&app, &store, &ports, false);
    });
}
