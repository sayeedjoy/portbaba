# Software Requirements Specification (SRS)

## 1. Project Overview

### 1.1 Project Name

**Port Killer**

### 1.2 Purpose

Port Killer is a cross-platform desktop application designed for developers, system administrators, QA engineers, and technical users who frequently encounter local port conflicts.

The application allows users to:

* View ports currently being used
* Identify which process is using a port
* Search for specific ports or processes
* Terminate processes occupying ports
* Monitor commonly used development ports
* Quickly free ports before starting local applications

The application will support:

* Windows
* macOS
* Linux

The desktop application will be built using **Tauri**.

---

# 2. Objectives

The primary objective of Port Killer is to eliminate the need for developers to manually run commands such as:

```bash
lsof -i :3000
kill -9 PID
```

or:

```powershell
netstat -ano | findstr :3000
taskkill /PID 1234 /F
```

Instead, users will be able to identify and terminate port-consuming processes from a graphical desktop interface.

The application should be:

* Fast
* Lightweight
* Cross-platform
* Developer-friendly
* Safe
* Easy to use
* Minimal in memory and CPU usage

---

# 3. Target Users

### 3.1 Software Developers

Developers frequently running:

* React
* Next.js
* Vite
* Node.js
* ASP.NET Core
* Spring Boot
* Django
* Laravel
* Docker
* Local databases

### 3.2 DevOps Engineers

Users running multiple development services or containers locally.

### 3.3 QA Engineers

Users starting and stopping multiple local applications during testing.

### 3.4 System Administrators

Users who need visibility into local listening ports and running services.

---

# 4. Proposed Technology Stack

## 4.1 Desktop Framework

**Tauri**

Advantages:

* Small binary size
* Native desktop integration
* Rust backend
* Lower memory consumption compared with Electron
* Cross-platform support
* Secure command interface

---

## 4.2 Frontend

Recommended stack:

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Lucide Icons
```

Optional:

```text
TanStack Query
Zustand
```

TanStack Query may be used for refresh/polling operations.

Zustand may be used for global UI state.

---

## 4.3 Backend

Tauri Rust backend.

Rust will handle:

* Process discovery
* Port discovery
* Process termination
* OS-specific commands
* Permission management
* System information

---

# 5. System Architecture

The proposed architecture is:

```text
┌──────────────────────────────┐
│        React Frontend        │
│                              │
│ Port Table                   │
│ Search                       │
│ Filters                      │
│ Process Details              │
│ Settings                     │
└───────────────┬──────────────┘
                │
                │ Tauri Commands
                ▼
┌──────────────────────────────┐
│        Tauri / Rust          │
│                              │
│ Port Service                 │
│ Process Service              │
│ Kill Service                 │
│ System Service               │
│ Permission Service           │
└───────────────┬──────────────┘
                │
                ▼
┌──────────────────────────────┐
│      Operating System        │
│                              │
│ Windows                      │
│ macOS                        │
│ Linux                        │
└──────────────────────────────┘
```

---

# 6. Functional Requirements

## FR-001 — Display Active Ports

The application shall display currently active/listening ports.

Each record should contain:

| Field      | Description              |
| ---------- | ------------------------ |
| Port       | Port number              |
| PID        | Process ID               |
| Process    | Process/application name |
| Protocol   | TCP / UDP                |
| Address    | Bound IP address         |
| State      | Listening / Established  |
| User       | Process owner            |
| Executable | Executable path          |

Example:

```text
3000    15423    node        TCP    127.0.0.1    LISTEN
5173    18221    node        TCP    0.0.0.0      LISTEN
5432    7721     postgres    TCP    localhost    LISTEN
```

---

# 7. Port Search

## FR-002 — Search by Port

Users shall be able to search by port number.

Example:

```text
3000
```

The application should immediately display:

```text
Port: 3000
Process: node
PID: 18423
Protocol: TCP
Status: Listening
```

---

# 8. Search by Process

## FR-003

Users shall be able to search processes by name.

Example:

```text
node
```

Results:

```text
Node.exe
PID: 10322
Port: 3000

Node.exe
PID: 20322
Port: 5173
```

---

# 9. Kill Process

## FR-004

The user shall be able to terminate a process occupying a port.

Example:

```text
Port 3000

node
PID 18423

[ Kill Process ]
```

After confirmation:

```text
Process terminated successfully.
Port 3000 is now available.
```

---

# 10. Kill Port

## FR-005

The application shall provide a direct action:

```text
Kill Port
```

Example:

```text
Kill Port 3000
```

The backend will:

1. Find PID using the port.
2. Identify the process.
3. Request permission when necessary.
4. Terminate the process.
5. Recheck the port.
6. Return the result.

---

# 11. Force Kill

## FR-006

The application may expose two termination options:

```text
Terminate
Force Kill
```

Terminate should attempt a graceful shutdown.

Force Kill should forcibly stop the process.

Examples:

Windows:

```text
taskkill /PID 12345
taskkill /PID 12345 /F
```

Unix:

```text
SIGTERM
SIGKILL
```

---

# 12. Confirmation Protection

## FR-007

Before terminating a process, the application shall show a confirmation dialog.

Example:

```text
Terminate process?

node
PID: 18322
Port: 3000

This process may have unsaved work.

Cancel
Terminate
```

---

# 13. Protected Processes

## FR-008

Port Killer should prevent accidental termination of sensitive operating-system processes.

Examples may include:

```text
systemd
launchd
kernel_task
System
svchost.exe
wininit.exe
```

The application should either:

* Block termination

or

* Show an elevated warning.

Example:

```text
Warning

This appears to be a system process.
Terminating it may cause system instability.
```

---

# 14. Refresh Ports

## FR-009

The user shall be able to manually refresh the port list.

Button:

```text
Refresh
```

Keyboard shortcut:

```text
Ctrl + R
```

macOS:

```text
Cmd + R
```

---

# 15. Auto Refresh

## FR-010

Users should be able to enable automatic refreshing.

Possible intervals:

```text
Off
1 second
2 seconds
5 seconds
10 seconds
30 seconds
```

Default:

```text
5 seconds
```

---

# 16. Quick Port Killer

## FR-011

The application should provide a dedicated quick-kill input.

Example:

```text
Enter port

[ 3000 ]

Kill Port
```

This should be one of the primary workflows of the application.

---

# 17. Favorite Ports

## FR-012

Users shall be able to save frequently used development ports.

Example:

```text
★ 3000 — Next.js
★ 5173 — Vite
★ 5000 — ASP.NET
★ 8000 — Django
★ 5432 — PostgreSQL
```

Favorite ports should appear in a dedicated section.

---

# 18. Port Status

## FR-013

The application should visually identify ports as:

```text
Available
Occupied
Listening
Established
Unknown
```

Example dashboard:

```text
3000    Occupied
5173    Available
5000    Occupied
8080    Available
```

---

# 19. Port Check

## FR-014

The user shall be able to check whether a port is available without searching the complete process table.

Example:

```text
Check Port: 8080

Result:
Port 8080 is available.
```

---

# 20. Development Port Presets

## FR-015

The application may contain common development-port presets.

Examples:

```text
React / Next.js
3000

Vite
5173

ASP.NET Core
5000
5001

PostgreSQL
5432

MySQL
3306

Redis
6379

MongoDB
27017

Docker
2375

Elasticsearch
9200

Grafana
3000
```

Users may modify these presets.

---

# 21. Process Details

## FR-016

Clicking a process should display more details.

Example:

```text
Process

Name:
node

PID:
18321

Port:
3000

Executable:
/usr/local/bin/node

Command:
node server.js

Started:
5 minutes ago

User:
joy
```

---

# 22. Command Line Details

## FR-017

Where supported, Port Killer should display the command used to start the process.

Example:

```text
node ./node_modules/vite/bin/vite.js --port 5173
```

This can help developers understand which project owns the port.

---

# 23. Project Detection

## FR-018

Optional advanced feature.

If possible, Port Killer should identify the working directory of the process.

Example:

```text
Port 3000

Project:
/Users/joy/projects/my-next-app

Process:
node

Command:
next dev
```

This would make it significantly easier to identify abandoned development servers.

---

# 24. Kill Multiple Processes

## FR-019

Users shall be able to select multiple processes.

Example:

```text
☑ node     3000
☑ node     5173
☑ dotnet   5000

Kill Selected
```

The system should request confirmation before bulk termination.

---

# 25. Kill All Processes by Name

## FR-020

Optional feature:

```text
Kill all Node processes
```

Example warning:

```text
4 Node processes will be terminated.

Ports:
3000
3001
5173
8080
```

---

# 26. Port Range Search

## FR-021

Users should be able to search a range.

Example:

```text
3000-3100
```

Result:

```text
3000 occupied
3001 available
3002 occupied
...
```

---

# 27. Port History

## FR-022

The application may maintain a lightweight local activity history.

Example:

```text
18:21

Port 3000
node
PID 15231

Killed successfully
```

No external server is required.

History should be stored locally.

---

# 28. System Tray

## FR-023

Port Killer should optionally minimize to the system tray.

The tray menu leads with the ports that are in use right now, so the common
case — "something is on 3000 and I want it gone" — is one click from the menu
bar, without opening the window at all:

```text
Kill All Processes
─────────────────────────────────
Kill: Port 3722: node — Vite in my-dashboard
Kill: Port 5000: python3 — Flask in api
─────────────────────────────────
Open Dashboard
Quick Kill Port…
Kill Favourite Port      ▸
Refresh Ports
─────────────────────────────────
Quit portbaba
```

The list holds at most 12 ports, lowest first. Protected system processes and
sockets whose owner cannot be resolved are left out rather than listed and
refused. When nothing is listening the list is replaced by a disabled "No ports
in use", and "Kill All Processes" is disabled.

Because there is no "menu is about to open" hook to build the list on demand, it
is refreshed in the background and after every termination. The background
cadence follows the Port Scanner refresh interval but never runs faster than
every 15 seconds — this loop runs for as long as the app does, so it is paid for
in battery.

On macOS the icon shows this menu on a plain left click, as a menu-bar item is
expected to. On Windows and Linux a left click opens the dashboard, which is
what a tray icon is expected to do there, and the menu is on the right button.

---

# 29. Quick Tray Actions

## FR-024

Frequently used ports may appear directly inside the tray menu.

A favourite is a port the user cares about whether or not anything is bound to
it, so favourites keep a submenu of their own rather than sharing the live list
above — they need somewhere to live on the days they are not in use.

```text
Kill Favourite Port      ▸   3000 — Next.js
                             5173 — Vite
                             5000 — API
                             8080 — Tomcat
```

"Kill All Processes" acts on the live list, not on favourites: it frees exactly
what the menu was showing when the user opened it.

---

# 30. Global Shortcut

## FR-025

Optional feature.

Allow the user to configure a global shortcut.

Example:

```text
Ctrl + Shift + K
```

macOS:

```text
Cmd + Shift + K
```

This opens Quick Kill.

---

# 31. Command Palette

## FR-026

The application should support a command-palette interface.

Shortcut:

```text
Ctrl + K
```

Example commands:

```text
Kill Port 3000

Refresh Ports

Show Node Processes

Check Port 5173

Open Settings
```

---

# 32. User Interface Requirements

Main navigation:

```text
Dashboard
Ports
Processes
Favorites
History
Settings
```

---

# 33. Dashboard

The dashboard should prioritize immediate developer actions.

Example:

```text
Port Killer

Kill any occupied development port instantly.

┌─────────────────────────────┐
│ Enter a port                │
│                             │
│ 3000                        │
│                             │
│       Kill Port             │
└─────────────────────────────┘

Active Ports

3000    node        PID 18321
5173    node        PID 18222
5000    dotnet      PID 9212

Favorites

3000
5173
5000
8080
```

---

# 34. Ports Page

Table columns:

```text
Port
Process
PID
Protocol
Address
Status
Actions
```

Actions:

```text
Details
Terminate
Force Kill
```

---

# 35. Processes Page

The Processes page should group ports by process.

Example:

```text
node
PID 15342

Ports:
3000
3001

----------------

postgres
PID 8212

Ports:
5432
```

---

# 36. Favorites Page

Users may manage frequently used ports.

Fields:

```text
Port
Label
Description
```

Example:

```text
3000
Frontend
Next.js Development Server
```

---

# 37. History Page

Example:

```text
Time      Port    Process    Action       Result

18:32     3000    node       Kill         Success
17:43     5173    node       Force Kill   Success
16:22     5000    dotnet     Kill         Failed
```

---

# 38. Settings

Settings may contain:

### General

```text
Launch at Startup
Minimize to Tray
Start Minimized
```

### Port Scanner

```text
Auto Refresh
Refresh Interval
Show UDP
Show Established Connections
```

### Safety

```text
Confirm Before Kill
Allow Force Kill
Protect System Processes
```

### Appearance

```text
System
Light
Dark
```

---

# 39. Cross-Platform Process Detection

The backend should hide platform-specific implementation details behind a common Rust interface.

Example:

```rust
trait PortProvider {
    fn get_ports(&self) -> Result<Vec<PortInfo>>;
}
```

Implementations:

```text
WindowsPortProvider
MacOSPortProvider
LinuxPortProvider
```

---

# 40. macOS Implementation

Potential mechanisms include:

```text
lsof
netstat
sysctl
libproc
```

Example lookup:

```bash
lsof -nP -iTCP -sTCP:LISTEN
```

Example kill:

```bash
kill PID
```

Force kill:

```bash
kill -9 PID
```

Where possible, native APIs should eventually replace shell command parsing.

---

# 41. Linux Implementation

Potential mechanisms:

```text
/proc
ss
lsof
netstat
```

Preferred methods:

```bash
ss -lptn
```

or direct `/proc` inspection.

Process termination can use Rust/system signals.

---

# 42. Windows Implementation

Potential mechanisms:

```text
Windows IP Helper API
GetExtendedTcpTable
GetExtendedUdpTable
CreateToolhelp32Snapshot
OpenProcess
TerminateProcess
```

Native Windows APIs are preferred instead of parsing:

```text
netstat
tasklist
```

This will improve reliability and performance.

---

# 43. Suggested Rust Modules

```text
src-tauri/
│
├── src/
│   ├── main.rs
│   ├── lib.rs
│   │
│   ├── commands/
│   │   ├── ports.rs
│   │   ├── process.rs
│   │   ├── kill.rs
│   │   └── system.rs
│   │
│   ├── services/
│   │   ├── port_service.rs
│   │   ├── process_service.rs
│   │   └── settings_service.rs
│   │
│   ├── platform/
│   │   ├── mod.rs
│   │   ├── windows.rs
│   │   ├── macos.rs
│   │   └── linux.rs
│   │
│   ├── models/
│   │   ├── port_info.rs
│   │   └── process_info.rs
│   │
│   └── error.rs
│
└── Cargo.toml
```

---

# 44. Frontend Structure

```text
src/
│
├── components/
│   ├── PortTable.tsx
│   ├── PortRow.tsx
│   ├── KillDialog.tsx
│   ├── QuickKill.tsx
│   ├── ProcessDetails.tsx
│   └── SearchBar.tsx
│
├── pages/
│   ├── Dashboard.tsx
│   ├── Ports.tsx
│   ├── Processes.tsx
│   ├── Favorites.tsx
│   ├── History.tsx
│   └── Settings.tsx
│
├── hooks/
│   ├── usePorts.ts
│   └── useProcesses.ts
│
├── stores/
│   └── settingsStore.ts
│
├── services/
│   └── tauri.ts
│
├── types/
│   └── system.ts
│
└── App.tsx
```

---

# 45. Tauri Commands

Potential commands:

```rust
#[tauri::command]
async fn get_active_ports() -> Result<Vec<PortInfo>, String>

#[tauri::command]
async fn get_port_info(port: u16) -> Result<Option<PortInfo>, String>

#[tauri::command]
async fn kill_port(port: u16) -> Result<KillResult, String>

#[tauri::command]
async fn kill_process(pid: u32) -> Result<KillResult, String>

#[tauri::command]
async fn force_kill_process(pid: u32) -> Result<KillResult, String>

#[tauri::command]
async fn get_process_details(pid: u32) -> Result<ProcessInfo, String>
```

---

# 46. Example Data Model

## PortInfo

```typescript
interface PortInfo {
    port: number;
    pid: number;
    processName: string;
    protocol: "TCP" | "UDP";
    address: string;
    state: string;
    executable?: string;
    command?: string;
    user?: string;
}
```

---

# 47. Kill Result

```typescript
interface KillResult {
    success: boolean;
    pid: number;
    port?: number;
    processName?: string;
    message: string;
}
```

---

# 48. Security Requirements

## SR-001

All privileged operations must execute through Rust/Tauri commands.

Frontend JavaScript must not directly execute arbitrary shell commands.

## SR-002

Port numbers shall be validated.

Valid range:

```text
1–65535
```

## SR-003

PIDs must be validated before termination.

## SR-004

Shell arguments must never be constructed from unvalidated user input.

## SR-005

System processes should receive additional protection.

## SR-006

The app should follow the minimum-permission principle.

---

# 49. Permission Handling

Some processes may require administrative/root privileges.

Port Killer should clearly report:

```text
Permission denied.

Administrator privileges are required to terminate this process.
```

The application should not silently escalate privileges.

---

# 50. Performance Requirements

Port discovery target:

```text
< 500 ms
```

for normal development machines.

Application startup target:

```text
< 2 seconds
```

Idle CPU usage:

```text
< 1%
```

Idle memory target:

```text
< 100 MB
```

Actual values will depend on platform and WebView implementation.

---

# 51. Reliability Requirements

The application must not crash if:

* A process disappears during scanning
* A port closes during refresh
* Permission is denied
* An executable path cannot be retrieved
* Process metadata is unavailable

Instead, it should return partial information when possible.

---

# 52. User Experience Requirements

Common actions should require minimal interaction.

Target workflow:

```text
Open Port Killer

Enter:
3000

Click:
Kill Port

Done
```

The entire workflow should ideally require fewer than three interactions.

---

# 53. Error Handling

Examples:

### Port Not Found

```text
Port 3000 is already available.
```

### Permission Error

```text
Port 443 is owned by a protected process.

Administrator permission is required.
```

### Process Disappeared

```text
The process has already stopped.
Port 3000 is now available.
```

### Kill Failed

```text
Unable to terminate node (PID 18322).
```

---

# 54. Notifications

Successful actions may display native desktop notifications.

Example:

```text
Port Killer

Port 3000 freed successfully.

node
PID 18322
```

Notifications should be optional.

---

# 55. Keyboard Shortcuts

Recommended shortcuts:

```text
Ctrl/Cmd + K
Command Palette

Ctrl/Cmd + R
Refresh

Ctrl/Cmd + F
Search

Ctrl/Cmd + Shift + K
Quick Kill

Esc
Close Dialog
```

---

# 56. MVP Scope

Version 1 should remain focused.

## MVP Features

```text
Active port detection

Port search

Process identification

Terminate process

Force kill process

Quick port kill

Manual refresh

Auto refresh

Cross-platform support

Dark/light theme

Basic settings
```

Avoid overloading the first release with secondary features.

---

# 57. Version 1.1

Possible additions:

```text
Favorite ports

Port labels

Process details

Command line details

System tray

Global shortcuts

Kill history
```

---

# 58. Version 1.2

Possible additions:

```text
Project directory detection

Development framework detection

Port groups

Port range scanner

Bulk kill

Startup applications
```

---

# 59. Future Advanced Feature — Dev Server Detection

Port Killer could detect frameworks automatically.

Example:

```text
Port 3000

Next.js
my-dashboard

~/Projects/my-dashboard

PID 18323

[ Open Folder ]
[ Kill Server ]
```

Possible detections:

```text
Next.js
Vite
React
Angular
Vue
ASP.NET Core
Spring Boot
Django
Flask
Laravel
Node.js
```

This could become one of Port Killer's strongest differentiating features.

---

# 60. Future Advanced Feature — Restart Process

Instead of only killing:

```text
Kill
Restart
```

The app could remember the process command and working directory and restart the development server.

Example:

```text
next dev --port 3000
```

However, this should be implemented carefully because process reconstruction may not always be reliable.

---

# 61. Future Advanced Feature — Port Conflict Detection

Port Killer could identify a conflict before another application fails.

Example:

```text
Port Conflict Detected

Port 3000 is currently used by:

node
old-dashboard

Your new project may fail to start.

[ Kill Old Process ]
```

---

# 62. Possible Branding

Suggested positioning:

**Port Killer**

> Find it. Kill it. Free the port.

Alternative tagline:

> Stop hunting PIDs. Free your ports instantly.

Or:

> The developer-friendly port manager for your desktop.

---

# 63. Success Criteria

Port Killer will be considered successful when a developer can resolve a port conflict without opening a terminal.

The key user experience should be:

```text
Port is busy
     ↓
Open Port Killer
     ↓
Search 3000
     ↓
See node / PID / project
     ↓
Kill
     ↓
Port available
```

The process should take only a few seconds.

---

# 64. Recommended Product Direction

The application should initially focus on one exceptionally polished feature:

**Instantly identify and kill whatever is occupying a development port.**

Rather than becoming a generic process manager, Port Killer should remain developer-focused.

The biggest opportunity for differentiation is to show not only:

```text
Port 3000
node
PID 1234
```

but eventually:

```text
Port 3000

Next.js Development Server

Project:
my-dashboard

~/Projects/my-dashboard

Started:
42 minutes ago

PID:
1234

[ Kill Server ]
```

That turns Port Killer from a graphical version of `lsof` into a genuinely useful developer tool.
