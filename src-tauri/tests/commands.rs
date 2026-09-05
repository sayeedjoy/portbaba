//! Drives the Tauri command surface over the real IPC path.
//!
//! `tauri::test`'s mock runtime mounts the same `invoke_handler` the shipping
//! app mounts, so these exercise argument decoding, the `Result<T, String>`
//! contract the frontend depends on (§45), and the local state store — without
//! opening a window.

use std::net::TcpListener;

use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{INVOKE_KEY, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::WebviewWindowBuilder;

use portbaba_lib::testing::Store;

struct Harness {
    _dir: std::path::PathBuf,
    webview: tauri::WebviewWindow<tauri::test::MockRuntime>,
}

fn harness() -> Harness {
    // A per-test config directory keeps the developer's real settings untouched.
    let dir = std::env::temp_dir().join(format!(
        "port-killer-test-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("temp config dir");

    let app = portbaba_lib::configure(mock_builder(), Store::load(&dir))
        .build(mock_context(noop_assets()))
        .expect("mock app");

    let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock webview");

    Harness { _dir: dir, webview }
}

impl Harness {
    fn call(&self, cmd: &str, args: Value) -> Result<Value, Value> {
        let response = tauri::test::get_ipc_response(
            &self.webview,
            InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: InvokeBody::Json(args),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        );
        response.map(|body| body.deserialize::<Value>().expect("json response"))
    }

    fn ok(&self, cmd: &str, args: Value) -> Value {
        self.call(cmd, args)
            .unwrap_or_else(|e| panic!("{cmd} failed: {e}"))
    }

    fn err(&self, cmd: &str, args: Value) -> String {
        match self.call(cmd, args) {
            Ok(value) => panic!("{cmd} unexpectedly succeeded: {value}"),
            // SRS §45 — errors reach the frontend as plain strings.
            Err(Value::String(message)) => message,
            Err(other) => panic!("{cmd} returned a non-string error: {other}"),
        }
    }
}

#[test]
fn active_ports_come_back_in_the_documented_shape() {
    let app = harness();
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();

    let ports = app.ok(
        "get_active_ports",
        json!({ "options": { "includeUdp": false, "includeEstablished": false } }),
    );
    let entry = ports
        .as_array()
        .expect("array")
        .iter()
        .find(|p| p["port"] == port)
        .unwrap_or_else(|| panic!("port {port} missing from get_active_ports"));

    // FR-001 — every field the table binds to must be present and camelCased.
    for field in ["id", "port", "pid", "processName", "protocol", "address", "state"] {
        assert!(!entry[field].is_null(), "{field} should be populated");
    }
    assert_eq!(entry["protocol"], "TCP");
    assert_eq!(entry["state"], "LISTEN");
    assert_eq!(entry["protected"], false);
    assert_eq!(entry["ownerUnknown"], false);
}

#[test]
fn check_port_answers_the_availability_question() {
    let app = harness();
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();

    let busy = app.ok("check_port", json!({ "port": port }));
    assert_eq!(busy["available"], false);
    assert_eq!(busy["port"], port);

    drop(listener);

    let free = app.ok("check_port", json!({ "port": port }));
    assert_eq!(free["available"], true);
    assert_eq!(free["entries"].as_array().unwrap().len(), 0);
}

#[test]
fn killing_a_free_port_reports_it_as_already_available() {
    let app = harness();
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    drop(listener);

    // §53 — "Port 3000 is already available." No error, no scary wording.
    let results = app.ok("kill_port", json!({ "port": port, "force": false }));
    let first = &results.as_array().expect("array")[0];
    assert_eq!(first["outcome"], "alreadyFree");
    assert_eq!(first["success"], true);
    assert!(
        first["message"]
            .as_str()
            .unwrap()
            .contains("already available"),
        "unexpected message: {}",
        first["message"]
    );
}

#[test]
fn port_numbers_are_validated_before_anything_happens() {
    let app = harness();

    // SR-002 — 1–65535, enforced in Rust and not only in the input field.
    for port in [0u32, 65_536, 999_999] {
        let message = app.err("check_port", json!({ "port": port }));
        assert!(
            message.contains("1–65535"),
            "expected a range explanation, got: {message}"
        );
    }

    let message = app.err("kill_port", json!({ "port": 0, "force": false }));
    assert!(message.contains("1–65535"), "got: {message}");
}

#[test]
fn pids_are_validated_before_anything_happens() {
    let app = harness();
    // SR-003 — PID 0 is never a legitimate target.
    let message = app.err("kill_process", json!({ "pid": 0 }));
    assert!(message.contains("valid process id"), "got: {message}");
}

#[test]
fn range_scans_are_capped() {
    let app = harness();
    let message = app.err("check_port_range", json!({ "start": 1, "end": 65535 }));
    assert!(
        message.contains("at most"),
        "an unbounded range should be refused: {message}"
    );

    let results = app.ok("check_port_range", json!({ "start": 3000, "end": 3004 }));
    assert_eq!(results.as_array().unwrap().len(), 5);
}

#[test]
fn process_details_describe_this_test_binary() {
    let app = harness();
    let me = std::process::id();

    // FR-016 / FR-017 — name, executable and command line for a real process.
    let info = app.ok("get_process_details", json!({ "pid": me }));
    assert_eq!(info["pid"], me);
    assert!(info["name"].as_str().is_some_and(|n| !n.is_empty()));
    assert!(info["executable"].as_str().is_some_and(|e| e.contains("commands")));
    assert!(info["command"].as_str().is_some_and(|c| !c.is_empty()));

    // §51 — a PID that is not running is a clean error, not a panic.
    let message = app.err("get_process_details", json!({ "pid": 4_294_967_294u32 }));
    assert!(message.contains("no longer running"), "got: {message}");
}

#[test]
fn settings_round_trip_through_disk() {
    let app = harness();

    let defaults = app.ok("get_settings", json!({}));
    assert_eq!(defaults["refreshInterval"], 5); // FR-010's stated default
    assert_eq!(defaults["confirmBeforeKill"], true);
    assert_eq!(defaults["protectSystemProcesses"], true);

    let mut next = defaults.clone();
    next["refreshInterval"] = json!(10);
    next["theme"] = json!("dark");
    next["showUdp"] = json!(true);

    let saved = app.ok("save_settings", json!({ "settings": next }));
    assert_eq!(saved["refreshInterval"], 10);
    assert_eq!(saved["theme"], "dark");

    let reloaded = app.ok("get_settings", json!({}));
    assert_eq!(reloaded["showUdp"], true);
    assert_eq!(reloaded["theme"], "dark");
}

#[test]
fn out_of_range_settings_are_brought_back_in_range() {
    let app = harness();
    let mut settings = app.ok("get_settings", json!({}));
    settings["refreshInterval"] = json!(7); // not one of the offered intervals
    settings["theme"] = json!("neon");

    let saved = app.ok("save_settings", json!({ "settings": settings }));
    assert_eq!(saved["refreshInterval"], 5);
    assert_eq!(saved["theme"], "system");
}

#[test]
fn favorites_are_seeded_editable_and_persisted() {
    let app = harness();

    // FR-012 — the starter set the SRS lists.
    let seeded = app.ok("get_favorites", json!({}));
    let ports: Vec<u64> = seeded
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["port"].as_u64().unwrap())
        .collect();
    assert!(ports.contains(&3000) && ports.contains(&5173));

    let added = app.ok(
        "add_favorite",
        json!({ "port": 4200, "label": "Angular", "description": "ng serve" }),
    );
    let angular = added
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["port"] == 4200)
        .expect("added favourite");
    assert_eq!(angular["label"], "Angular");

    let id = angular["id"].as_str().unwrap().to_string();
    let removed = app.ok("remove_favorite", json!({ "id": id }));
    assert!(removed.as_array().unwrap().iter().all(|f| f["port"] != 4200));

    // SR-002 applies here too.
    let message = app.err("add_favorite", json!({ "port": 70000, "label": "nope" }));
    assert!(message.contains("1–65535"), "got: {message}");
}

#[test]
fn presets_ship_with_the_catalogue_and_can_be_reset() {
    let app = harness();

    // FR-015 — the well-known development ports.
    let presets = app.ok("get_presets", json!({}));
    let ports: Vec<u64> = presets
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["port"].as_u64().unwrap())
        .collect();
    for expected in [3000, 5173, 5432, 3306, 6379, 27017, 9200] {
        assert!(ports.contains(&expected), "preset {expected} missing");
    }

    let trimmed = app.ok(
        "save_presets",
        json!({ "presets": [{ "id": "x", "port": 1234, "name": "Mine", "category": "Custom" }] }),
    );
    assert_eq!(trimmed.as_array().unwrap().len(), 1);

    let restored = app.ok("reset_presets", json!({}));
    assert!(restored.as_array().unwrap().len() > 1);
}

#[test]
fn history_records_every_attempt() {
    let app = harness();
    assert_eq!(app.ok("get_history", json!({})).as_array().unwrap().len(), 0);

    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    app.ok("kill_port", json!({ "port": port, "force": false }));

    // FR-022 — even a no-op is worth a line, so the log tells the whole story.
    let history = app.ok("get_history", json!({}));
    let entry = &history.as_array().unwrap()[0];
    assert_eq!(entry["port"], port);
    assert_eq!(entry["result"], "Already free");
    assert_eq!(entry["action"], "Kill");

    app.ok("clear_history", json!({}));
    assert_eq!(app.ok("get_history", json!({})).as_array().unwrap().len(), 0);
}

#[test]
fn force_kill_respects_the_safety_switch() {
    let app = harness();
    let mut settings = app.ok("get_settings", json!({}));
    settings["allowForceKill"] = json!(false);
    app.ok("save_settings", json!({ "settings": settings }));

    // §38 Safety — the backend enforces the switch, not just the UI.
    let message = app.err("force_kill_process", json!({ "pid": std::process::id() }));
    assert!(message.contains("Force kill is turned off"), "got: {message}");
}

#[test]
fn a_protected_process_is_refused_rather_than_signalled() {
    let app = harness();

    // FR-008 — PID 1 is launchd/systemd/System on every supported platform.
    let result = app.ok("kill_process", json!({ "pid": 1 }));
    assert_eq!(result["outcome"], "blocked");
    assert_eq!(result["success"], false);
    assert!(
        result["message"]
            .as_str()
            .unwrap()
            .contains("system instability"),
        "expected the FR-008 warning, got: {}",
        result["message"]
    );

    // And the refusal is recorded (FR-022).
    let history = app.ok("get_history", json!({}));
    assert_eq!(history.as_array().unwrap()[0]["result"], "Blocked");
}

#[test]
fn reveal_directory_refuses_anything_that_is_not_a_directory() {
    let app = harness();
    // SR-004 — the path is checked before it reaches the platform opener.
    let message = app.err(
        "reveal_directory",
        json!({ "path": "/definitely/not/a/real/directory" }),
    );
    assert!(message.contains("not a directory"), "got: {message}");
}

#[test]
fn system_info_describes_the_host() {
    let app = harness();
    let info = app.ok("get_system_info", json!({}));
    assert_eq!(info["os"], std::env::consts::OS);
    assert_eq!(info["arch"], std::env::consts::ARCH);
    assert!(info["appVersion"].as_str().is_some_and(|v| !v.is_empty()));
    assert!(info["elevated"].is_boolean());
}

#[test]
fn grouped_processes_reuse_the_port_records() {
    let app = harness();
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    let me = std::process::id();

    // §35 — the Processes page reads from the same scan as the Ports page.
    let groups = app.ok(
        "get_process_groups",
        json!({ "options": { "includeUdp": false, "includeEstablished": false } }),
    );
    let mine = groups
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["pid"] == me)
        .expect("this test process should own a port");
    assert!(
        mine["ports"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["port"] == port)
    );
}

#[test]
fn searching_by_name_finds_only_processes_holding_a_port() {
    let app = harness();
    let _listener = TcpListener::bind("127.0.0.1:0").expect("bind");

    // FR-003 / FR-020 — the preview behind "kill every X process".
    let found = app.ok("find_processes_by_name", json!({ "name": "commands" }));
    assert!(
        found
            .as_array()
            .unwrap()
            .iter()
            .any(|g| g["pid"] == std::process::id())
    );

    let none = app.ok("find_processes_by_name", json!({ "name": "" }));
    assert_eq!(none.as_array().unwrap().len(), 0);
}
