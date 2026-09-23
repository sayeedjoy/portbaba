# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

portbaba is a Tauri 2 desktop app (React 19 + TypeScript + Tailwind 4 + shadcn/ui frontend, Rust backend) that shows which process holds a local port and terminates it. Targets Windows, macOS and Linux. Requirements live in [docs/srs.md](docs/srs.md); code comments cite them by ID (`FR-012`, `SR-001`, `§38`), so grep the SRS for an ID to find the intent behind a piece of code.

## Commands

Package manager is **pnpm** (Node 20+). Rust commands run from `src-tauri/`.

```bash
pnpm install
pnpm tauri dev              # full app; Vite dev server must get port 1420 (strictPort)
pnpm build                  # tsc typecheck + vite bundle — the only frontend check (no linter, no JS tests)
pnpm tauri build            # release build + installers → src-tauri/target/release/bundle/
pnpm tauri build --no-bundle  # quickest check that a release build compiles

cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings   # CI treats warnings as errors
cargo test
cargo test --test commands                  # one integration test file
cargo test --test commands settings_round_trip_through_disk   # one test
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `pnpm build` once and fmt/clippy/test on all three OSes. Rust tests bind real sockets and read the real process table, so behaviour can differ per platform.

## Architecture

```
React (src/) ──invoke──▶ commands/ ──▶ services/ ──▶ platform/ ──▶ OS
```

**Trust boundary (SR-001/SR-006).** The frontend never runs shell commands. [src/services/tauri.ts](src/services/tauri.ts) is the only frontend module that calls `invoke`/`listen`, one function per Rust command. [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) gives the webview only core/opener/updater/process permissions. Everything privileged is a typed Rust command that validates its input first (`validate_port`/`validate_pid` in [error.rs](src-tauri/src/error.rs)).

**Adding a command** touches four places:
1. Implement it in `src-tauri/src/commands/<area>.rs` as `#[tauri::command(async)]` so blocking OS work stays off the main thread.
2. Register it in `command_handler()` in [lib.rs](src-tauri/src/lib.rs). Tests mount the same handler through `configure()`.
3. Add a wrapper in `src/services/tauri.ts`.
4. Mirror any new or changed model in [src/types/system.ts](src/types/system.ts). Rust models use `#[serde(rename_all = "camelCase")]`, and the TS types are kept in sync by hand.

Errors: every command returns `Result<T, error::Error>`. `Error` serialises to a plain string, so the frontend contract is `Result<T, string>`. The `call()` wrapper turns that string into a JS `Error`.

**Rust backend layers**
- `commands/`: the IPC surface. `kill.rs` holds the whole termination flow: protected-process refusal, graceful vs forced, waiting for exit, recording history, emitting `ports:changed`, notifying and rebuilding the tray. `free_port`/`free_ports` are shared by commands and the tray.
- `services/`: `port_service` enriches raw sockets into `PortInfo` and includes `live_ports` for the tray. `process_service` uses `sysinfo` metadata and project/framework detection. `settings_service::Store` persists settings, favourites, presets and history to one JSON file in the app config dir, written atomically. History is capped at 500 entries. New `Settings` fields need `#[serde(default)]` so older state files still load.
- `platform/`: socket enumeration is shared across OSes through `netstat2` (native APIs, no parsing of `lsof`/`netstat` output). Per-OS differences sit behind the `PortProvider` trait (`terminate`, `is_alive`, `is_protected`, `is_elevated`), chosen at compile time through `pub use … as Platform`. `unix.rs` is shared by Linux and macOS and calls `kill(2)` directly so it can tell `PermissionDenied` apart from `NoSuchProcess`.
- [lib.rs](src-tauri/src/lib.rs): app wiring, the system tray, the global shortcut and autostart. The tray menu lists live ports. Tauri has no "menu about to open" hook, so a background thread rebuilds the menu. It swaps the menu only when a signature string changes, because replacing it under the cursor flickers on macOS. `apply_settings` reapplies the shortcut, autostart and tray after each save. The window starts hidden (`visible: false`) and is shown only if `start_minimized` is off.
- `lib.rs` exports `pub mod testing` so integration tests can reach the internal services.

**Rust → frontend events**: `ports:changed` (triggers a re-scan and reloads history), `settings:changed`, `shortcut:quick-kill`, `tray:quick-kill`, `shortcut:error`, `settings:error`.

**Frontend**
- No router. `useUi().route` in [uiStore.ts](src/stores/uiStore.ts) chooses the page in [App.tsx](src/App.tsx). Dialogs (Kill, ProcessDetails, About, CommandPalette) are mounted once at the root and opened through store state.
- Zustand stores: `settingsStore` (the backend `Settings`), `dataStore` (ports, process groups, favourites, presets, history; overlapping `refresh()` calls are merged into one in-flight scan), `uiStore`.
- [hooks/usePorts.ts](src/hooks/usePorts.ts) `usePortSync` runs the first scan, the auto-refresh interval and re-scans on `ports:changed`. Search always covers every socket, even when "Dev only" filtering is on.

**Styling**: `src/components/ui/` holds shadcn components that belong to this repo and can be edited freely (`pnpm dlx shadcn@latest add <name>`). [styles.css](src/styles.css) maps shadcn tokens onto portbaba's own tokens (`--primary` → `--ink`, `--destructive` → `--danger`, …). Theme the base palette, not the shadcn tokens. The `dark:` variant is redefined to follow the app's theme setting instead of `prefers-color-scheme`. `cn` is imported as a bare specifier, aliased in `vite.config.ts` and `tsconfig.json` to `src/lib/utils.ts`. Use `@/` for other imports.

## Tests

- [src-tauri/tests/commands.rs](src-tauri/tests/commands.rs) drives real command handlers over the real IPC path using `tauri::test::mock_builder`. Each test gets its own temp config dir, so real settings are never touched. Add command tests here with `harness().call("cmd", json!({...}))`.
- [src-tauri/tests/port_discovery.rs](src-tauri/tests/port_discovery.rs) binds real sockets, checks they are discovered, and enforces the SRS's 500 ms discovery budget.

## Releases and versioning

Every push to `main` that touches more than docs runs [release.yml](.github/workflows/release.yml). It bumps the patch version, commits `chore(release): vX.Y.Z [skip ci]`, tags, and publishes Windows NSIS and macOS universal DMG builds. README still says releases are triggered by pushing a tag; that is out of date. Don't bump versions by hand for normal changes. If you must, use `.github/scripts/bump-version.sh <version>`: `package.json`, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock` all have to agree. The updater plugin reads `latest.json` from the latest GitHub release.
