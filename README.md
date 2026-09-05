# Port Killer

> Find it. Kill it. Free the port.

A cross-platform desktop app that shows which process is holding a local
development port and frees it in one click — no `lsof`, no `netstat`, no PIDs to
copy between terminal windows.

Built with **Tauri 2**, **React 19**, **TypeScript**, **Tailwind CSS 4** and
**shadcn/ui** (Radix primitives).

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

## Building releases

```bash
pnpm tauri build
```

That builds the frontend, compiles the Rust binary in release mode and produces
every installer the host platform supports. Everything lands under
`src-tauri/target/release/bundle/`.

| Platform | Command | Output |
| --- | --- | --- |
| macOS | `pnpm tauri build` | `dmg/Port Killer_0.1.0_aarch64.dmg`, `macos/Port Killer.app` |
| Windows | `pnpm tauri build` | `nsis/Port Killer_0.1.0_x64-setup.exe`, `msi/Port Killer_0.1.0_x64_en-US.msi` |
| Linux | `pnpm tauri build` | `deb/`, `rpm/`, `appimage/` |

Use `--bundles` to produce just one format. The accepted values depend on the
host — `app` and `dmg` on macOS, `nsis` and `msi` on Windows:

```bash
pnpm tauri build --bundles dmg     # macOS disk image only
pnpm tauri build --bundles nsis    # Windows .exe installer only
```

`--no-bundle` skips packaging entirely and leaves you a bare executable at
`src-tauri/target/release/portbaba` (`portbaba.exe` on Windows) — the quickest
way to check that a release build compiles.

### macOS

A plain build targets the machine you are on. For a binary that runs natively on
both Apple Silicon and Intel, install the second target once and ask for a
universal build:

```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
pnpm tauri build --target universal-apple-darwin
```

The universal `.dmg` is roughly twice the size, since it carries both slices.

**Gatekeeper.** Builds are ad-hoc signed, which is enough to run locally but not
to distribute: anyone else who opens the `.dmg` gets "Port Killer is damaged and
can't be opened". To ship it you need an Apple Developer ID certificate, set
before building:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # not your Apple ID password
export APPLE_TEAM_ID="TEAMID"
pnpm tauri build
```

With those set, Tauri signs the app and submits it to Apple for notarization as
part of the build.

Without them, the usual right-click → Open trick will not help on Apple Silicon —
a quarantined ad-hoc-signed app is reported as damaged rather than merely
unidentified. Testers have to clear the quarantine flag explicitly:

```bash
xattr -dr com.apple.quarantine "/Applications/Port Killer.app"
```

### Windows

Building on Windows needs, in addition to Rust and Node:

- **Microsoft C++ Build Tools** with the "Desktop development with C++" workload
- **WebView2 runtime** — preinstalled on Windows 11 and current Windows 10; the
  NSIS installer bootstraps it for anyone who lacks it

```powershell
pnpm install
pnpm tauri build
```

This produces two installers: an NSIS `.exe` (the one to hand people — it
bootstraps WebView2 and installs per-user without administrator rights) and a
WiX `.msi` (better suited to Group Policy deployment, but it will not install
WebView2 for you).

Signing is optional but stops SmartScreen warning about an unknown publisher. It
needs an Authenticode certificate installed in the Windows certificate store,
referenced from `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "windows": {
    "certificateThumbprint": "A1B2C3…",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

(Not to be confused with `TAURI_SIGNING_PRIVATE_KEY`, which signs *update
manifests* for the updater plugin and has nothing to do with Authenticode.)

### Building for the other platform

**You cannot build a Windows `.exe` on macOS, or a macOS `.dmg` on Windows.**
Each installer needs its platform's own toolchain and SDK — WiX and the MSVC
linker on Windows, `hdiutil` and `codesign` on macOS. There is no cross-compile
shortcut worth using here.

The practical answer is CI. [`.github/workflows/release.yml`](.github/workflows/release.yml)
builds all three platforms on their own runners and collects the installers into
a single draft GitHub release. Push a tag:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

macOS is built as a universal binary, Linux on Ubuntu 22.04 so the AppImage and
`.deb` still run on older distributions. You can also trigger it by hand from the
Actions tab without tagging, which produces a `v<run number>-dev` draft.

To sign, add the certificate values as repository secrets — the workflow already
passes them through, and skips signing when they are absent:

| Secret | Platform |
| --- | --- |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` | macOS — the exported Developer ID `.p12`, base64-encoded |
| `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID` | macOS |
| `APPLE_ID`, `APPLE_PASSWORD` | macOS — notarization, using an app-specific password |

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and
pull request: `tsc` and the frontend bundle once, then `cargo fmt --check`,
`cargo clippy -D warnings` and `cargo test` on all three platforms — the tests
touch real sockets, so they have to run per platform rather than on one host.

### Version numbers

The version in the installer filenames comes from `version` in
`src-tauri/tauri.conf.json`. Bump it there (and in `package.json` to match)
before tagging a release.

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
│   ├── ui/               shadcn/ui primitives (Radix, cmdk, sonner)
│   └── app/              Port Killer's own presentational pieces
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

### Components and theming

UI primitives come from [shadcn/ui](https://ui.shadcn.com) and live in
`src/components/ui/` — they are part of this repo, so edit them freely. Add more
with `pnpm dlx shadcn@latest add <name>`.

They are not themed with shadcn's default palette. `src/styles.css` maps each
shadcn token onto the Port Killer token that already means that thing
(`--primary` → `--ink`, `--destructive` → `--danger`, `--card` → `--panel`, and
so on), so components inherit this app's design rather than arriving with their
own. Because those definitions reference custom properties, they re-resolve per
theme automatically and only the base palette has to be maintained.

Two adjustments worth knowing about:

- The `dark:` variant is redefined in `styles.css`. Tailwind's default keys off
  `prefers-color-scheme`, which would ignore an explicit theme choice; ours
  matches the same three states the palette uses.
- Components import the class merger as a bare `cn` specifier. That is aliased
  in `vite.config.ts` and `tsconfig.json` to `src/lib/utils.ts`, so the project
  keeps one implementation (clsx + tailwind-merge).

## Permissions

Some processes belong to other users or to the system. Port Killer reports that
plainly and never escalates privileges on your behalf — if a process needs root
or Administrator to stop, you are told, and it stays running until you decide.

## Specification

The full requirements this implements are in [docs/srs.md](docs/srs.md).
