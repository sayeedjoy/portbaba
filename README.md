<p align="center">
  <img src="public/portbaba.png" width="112" alt="Port Baba logo" />
</p>

<h1 align="center">Port Baba</h1>

<p align="center"><strong>Find it. Kill it. Free the port.</strong></p>

<p align="center">
  A fast, local-first desktop app for finding and stopping the process that is blocking a development port.
</p>

<p align="center">
  <img alt="Windows, macOS, and Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-2563eb" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <a href="https://github.com/sayeedjoy/portbaba/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/sayeedjoy/portbaba/actions/workflows/ci.yml/badge.svg" /></a>
</p>

<p align="center">
  <a href="https://github.com/sayeedjoy/portbaba/releases"><strong>Releases</strong></a>
  ·
  <a href="https://github.com/sayeedjoy/portbaba/issues">Report an issue</a>
</p>

---

Port Baba replaces the usual `lsof` / `netstat` / PID-copying loop with one focused workflow: enter a port, see exactly what owns it, and free it safely.

```text
Port 5173
Held by node at PID 18420 — Vite in my-dashboard
```

Everything runs on your machine. Port Baba does not need an account, does not send process data to a server, and does not silently elevate its privileges.

## Why Port Baba?

| Capability | What it gives you |
| --- | --- |
| Instant port lookup | Check a port while you type and see its process, PID, protocol, and state. |
| Project detection | Turn a generic `node` process into useful context such as “Vite in my-dashboard.” |
| One-click cleanup | Ask for a graceful shutdown first, with force kill available when enabled. |
| Complete port view | Browse TCP and optional UDP sockets, filter by process or port, and scan ranges such as `3000-3100`. |
| Process view | Group every open port by the process that owns it and stop related ports together. |
| Favourites and presets | Keep common development ports visible and act on them from the app or tray. |
| Tray and global shortcut | Inspect or free ports without keeping the main window open. |
| Local history | Review up to 500 recent termination attempts stored only on this device. |

### Safety by default

- Confirmation is enabled before termination.
- Known operating-system processes are protected.
- Graceful termination is attempted before force kill.
- Invalid ports and PIDs are rejected by the Rust backend.
- Permission errors are reported clearly; the app never escalates privileges for you.

Some processes owned by another user or by the operating system may require Administrator or root access. Port Baba reports that limitation and leaves the process running.

## Install

Prebuilt installers are published on [GitHub Releases](https://github.com/sayeedjoy/portbaba/releases). If no release is listed yet, use the [source build](#build-from-source).

The release workflow produces:

| Platform | Package |
| --- | --- |
| Windows x64 | NSIS `.exe` installer |
| macOS | Universal `.dmg` for Apple Silicon and Intel |

Linux is supported by the codebase and can be [built from source](#build-from-source). Packaging must run on the target operating system because Tauri uses each platform's native toolchain.

## Everyday shortcuts

Use `Ctrl` on Windows/Linux and `⌘` on macOS.

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ + K` | Open the command palette |
| `Ctrl/⌘ + Shift + K` | Focus Quick Kill |
| `Ctrl/⌘ + F` | Search ports |
| `Ctrl/⌘ + R` | Refresh port data |
| `Ctrl/⌘ + B` | Collapse or expand the sidebar |

The Quick Kill shortcut can also be enabled as a system-wide shortcut in Settings.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [pnpm](https://pnpm.io/) 10
- [Rust](https://rustup.rs/) stable
- The [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system

On Windows, install the Microsoft C++ Build Tools with the **Desktop development with C++** workload. WebView2 is included with current Windows versions and is bootstrapped by the NSIS installer when missing.

### Run locally

```bash
git clone https://github.com/sayeedjoy/portbaba.git
cd portbaba
pnpm install
pnpm tauri dev
```

Tauri starts the Vite development server on port `1420`. The port is intentionally strict, so development stops with a clear error if another process already owns it.

### Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run only the Vite frontend |
| `pnpm build` | Type-check TypeScript and create the production frontend bundle |
| `pnpm preview` | Preview the built frontend |
| `pnpm tauri dev` | Run the complete desktop app in development mode |
| `pnpm tauri build` | Build an optimized app and native installer(s) |
| `pnpm tauri build --no-bundle` | Compile a release binary without packaging an installer |
| `cd src-tauri && cargo test` | Run the Rust unit and integration tests |
| `cd src-tauri && cargo fmt --check` | Check Rust formatting |
| `cd src-tauri && cargo clippy --all-targets -- -D warnings` | Run Rust lint checks used by CI |

No environment file or external service is required for local development.

## Architecture

```text
React UI  ── invoke ──▶  Tauri commands  ──▶  Rust services  ──▶  OS APIs
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Radix UI, and Zustand.
- **Desktop shell:** Tauri 2 provides the window, tray, notifications, updater, autostart, and global shortcut integrations.
- **Backend:** Rust discovers sockets, enriches process metadata, validates privileged requests, and performs termination.
- **Persistence:** Settings, favourites, presets, and history are stored atomically in a local JSON file in the platform app-config directory.

The webview never executes shell commands. [`src/services/tauri.ts`](src/services/tauri.ts) is the frontend's single IPC boundary, and every privileged action passes through a typed Rust command. Socket discovery uses platform APIs through `netstat2`; process metadata comes from `sysinfo`.

### Repository layout

```text
portbaba/
├── src/                         React frontend
│   ├── components/              App components and shadcn/ui primitives
│   ├── hooks/                   Port sync, kill flow, hotkeys, updater
│   ├── pages/                   Dashboard, ports, processes, favourites, history
│   ├── services/tauri.ts        Typed frontend-to-Rust boundary
│   ├── stores/                  Zustand application state
│   └── styles.css               Design tokens and light/dark themes
├── src-tauri/
│   ├── src/commands/            Tauri command handlers
│   ├── src/services/            Port, process, and persistence services
│   ├── src/platform/            Windows, macOS, and Linux behaviour
│   ├── tests/                   Cross-platform integration tests
│   └── tauri.conf.json          App, bundle, and updater configuration
└── .github/workflows/           CI and release automation
```

### Adding or changing a command

Keep the IPC contract synchronized across four places:

1. Implement the command in `src-tauri/src/commands/`.
2. Register it in the command handler in `src-tauri/src/lib.rs`.
3. Add its frontend wrapper to `src/services/tauri.ts`.
4. Mirror changed models in `src/types/system.ts` using camel-case serialized fields.

Commands should return the shared Rust error type, validate untrusted inputs at the backend boundary, and keep blocking operating-system work off the UI thread.

## Testing and quality

Run the same core checks as CI before opening a pull request:

```bash
pnpm build

cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

The Rust suite uses real sockets and the real process table for discovery tests. Command integration tests use Tauri's mock runtime and an isolated temporary config directory, so they do not touch your normal Port Baba settings.

CI runs the frontend build once and runs Rust formatting, Clippy, and tests on Windows, macOS, and Linux.

## Build from source

```bash
pnpm install --frozen-lockfile
pnpm tauri build
```

Bundles are written to `src-tauri/target/release/bundle/`. To create only one supported package format, pass it explicitly:

```bash
pnpm tauri build --bundles nsis   # Windows
pnpm tauri build --bundles dmg    # macOS
```

For a universal macOS build:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri build --target universal-apple-darwin --bundles dmg
```

## Releases and versioning

The release workflow is intentionally automated:

1. A non-documentation push to `main` increments the patch version.
2. The workflow updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.
3. It commits and tags the version, builds Windows and universal macOS packages, creates a GitHub release, and marks it as latest.

Do not bump versions manually for a normal change. For an intentional manual bump, use:

```bash
bash .github/scripts/bump-version.sh <version>
```

The updater checks the `latest.json` artifact attached to the newest GitHub release.

## Contributing

Issues and focused pull requests are welcome. Keep changes scoped, explain user-visible behaviour, update tests when behaviour changes, and make sure the quality checks above pass on your platform.
