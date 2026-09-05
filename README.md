# Port Killer

> Find it. Kill it. Free the port.

A cross-platform desktop app that shows which process is holding a local
development port and frees it in one click — no `lsof`, no `netstat`, no PIDs to
copy between terminal windows.

Built with **Tauri 2**, **React 19**, **TypeScript** and **Tailwind CSS 4**.

## What it does

Type a port number and Port Killer tells you what is holding it *while you
type* — process, PID, and where possible the framework and project directory:

```
5432
Held by postgres at PID 794 — PostgreSQL in postgresql@18
```

Then one click frees it.

- **Live port check** — the dashboard checks the port as you type, before you commit to anything.
- **Project detection** — a `node` process becomes "Vite in my-dashboard", so you can tell two dev servers apart.
- **Favourites** — ports you use often, shown as occupancy tiles here and in the tray menu.
- **System-process protection** — `launchd`, `systemd`, `svchost.exe` and friends are refused, not silently killed.
- **Graceful and forced termination** — SIGTERM/`taskkill` first, SIGKILL/`TerminateProcess` when you ask for it.
- **Command palette** — `Ctrl/Cmd+K`; type a bare port number and it becomes "Kill port 3000".
- **Range scanning** — type `3000-3100` in the Ports search.
- **Local history** — every termination is recorded on this machine. Nothing leaves it.

## Requirements

- [Rust](https://rustup.rs) (stable) and the platform's Tauri prerequisites — see
  [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)
- Node 20+ and [pnpm](https://pnpm.io)

## Running it

```bash
pnpm install
pnpm tauri dev
```

The dev server needs port 1420. (Yes, we know.)

## Building it

```bash
pnpm tauri build
```

Bundles land in `src-tauri/target/release/bundle/`.

## Tests

```bash
cd src-tauri && cargo test
```

The suite binds real sockets and asserts the app finds them, drives every Tauri
command over the real IPC path with a mock runtime, and holds port discovery to
the 500 ms budget from the spec.

```bash
pnpm build   # typecheck + production frontend bundle
```

## How it works

```
React frontend  ──invoke──▶  Tauri commands  ──▶  platform layer  ──▶  OS
```

The frontend never runs a shell command. Every privileged operation goes through
a typed Rust command that validates its input first: ports are checked against
1–65535, PIDs against 0, and paths must resolve to a real directory before they
reach the platform opener.

Socket enumeration uses native APIs on every target rather than parsing command
output — `GetExtendedTcpTable`/`GetExtendedUdpTable` on Windows, netlink and
`/proc` on Linux, `libproc` on macOS — via [`netstat2`](https://crates.io/crates/netstat2).
Process metadata comes from [`sysinfo`](https://crates.io/crates/sysinfo).
Termination goes through `kill(2)` directly on Unix so the app can tell
"permission denied" apart from "it already exited", which is the difference
between a useful error message and a confusing one.

### Layout

```
src/                      React frontend
├── components/           Table, dialogs, quick-kill, command palette
├── pages/                Dashboard, Ports, Processes, Favourites, History, Settings
├── hooks/                Port sync, kill flow, process details, hotkeys
├── stores/               Zustand: settings, scan data, UI state
├── services/tauri.ts     The only place that talks to Rust
└── styles.css            Design tokens, light and dark

src-tauri/src/            Rust backend
├── commands/             The Tauri command surface
├── services/             Port, process and local-state services
├── platform/             Per-OS socket, signal and protection behaviour
└── models/               Shared data model
```

## Permissions

Some processes belong to other users or to the system. Port Killer reports that
plainly and never escalates privileges on your behalf — if a process needs root
or Administrator to stop, you are told, and it stays running until you decide.

## Specification

The full requirements this implements are in [docs/srs.md](docs/srs.md).
