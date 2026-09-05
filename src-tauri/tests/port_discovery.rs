//! End-to-end checks against the real operating system.
//!
//! These bind actual sockets and then assert that Port Killer's discovery layer
//! finds them, which is the only way to be confident about §50's 500 ms budget
//! and about the FR-001 field mapping on a given platform.

use std::net::{TcpListener, UdpSocket};
use std::time::Instant;

use portbaba_lib::testing::{ScanOptions, check_port, check_range, detect_project, scan};

#[test]
fn finds_a_socket_we_just_opened() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    let me = std::process::id();

    let ports = scan(ScanOptions::default()).expect("scan");
    let found = ports
        .iter()
        .find(|p| p.port == port && p.pid == me)
        .unwrap_or_else(|| panic!("port {port} was not reported"));

    assert_eq!(found.state, "LISTEN");
    assert_eq!(found.protocol.as_str(), "TCP");
    assert_eq!(found.address, "127.0.0.1");
    assert!(!found.owner_unknown, "we should recognise our own process");
    assert!(!found.protected, "a test binary is not a system process");
    // FR-001 wants the executable path; on every desktop target we can read our own.
    assert!(found.executable.is_some(), "executable path should resolve");
}

#[test]
fn check_port_reports_occupied_then_available() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();

    let occupied = check_port(port).expect("check");
    assert!(!occupied.available, "port {port} is bound, so not available");
    assert!(!occupied.entries.is_empty());

    drop(listener);

    // FR-014 — once the socket is released the same call must say "available".
    // A freshly closed listening socket has no TIME_WAIT, so this is immediate.
    let freed = check_port(port).expect("check");
    assert!(freed.available, "port {port} should be free after close");
    assert!(freed.entries.is_empty());
}

#[test]
fn udp_is_only_reported_when_requested() {
    let socket = UdpSocket::bind("127.0.0.1:0").expect("bind");
    let port = socket.local_addr().unwrap().port();
    let me = std::process::id();

    let tcp_only = scan(ScanOptions::default()).expect("scan");
    assert!(
        !tcp_only.iter().any(|p| p.port == port && p.pid == me),
        "UDP must stay hidden unless Show UDP is on"
    );

    let with_udp = scan(ScanOptions {
        include_udp: true,
        include_established: false,
    })
    .expect("scan");
    let found = with_udp
        .iter()
        .find(|p| p.port == port && p.pid == me)
        .expect("UDP socket should appear when requested");
    assert_eq!(found.protocol.as_str(), "UDP");
    assert_eq!(found.state, "UDP");
}

#[test]
fn range_scan_covers_every_port_in_the_range() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = listener.local_addr().unwrap().port();
    let start = port.saturating_sub(2);
    let end = port.saturating_add(2);

    let results = check_range(start, end).expect("range");
    assert_eq!(results.len() as u32, (end - start) as u32 + 1);
    assert_eq!(results[0].port, start);
    let hit = results.iter().find(|r| r.port == port).expect("our port");
    assert!(!hit.available);
}

#[test]
fn listening_only_is_the_default() {
    // Establish a connection so there is at least one non-LISTEN socket around.
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
    let addr = listener.local_addr().unwrap();
    let _client = std::net::TcpStream::connect(addr).expect("connect");
    let _server = listener.accept().expect("accept");

    let default_scan = scan(ScanOptions::default()).expect("scan");
    assert!(
        default_scan.iter().all(|p| p.state == "LISTEN"),
        "the default view is listening sockets only"
    );

    let everything = scan(ScanOptions {
        include_udp: true,
        include_established: true,
    })
    .expect("scan");
    assert!(
        everything.iter().any(|p| p.state == "ESTABLISHED"),
        "established connections appear once asked for"
    );
}

#[test]
fn discovery_stays_within_the_performance_budget() {
    // Warm any lazy OS state first so we time a steady-state scan (§50).
    let _ = scan(ScanOptions::default());

    let started = Instant::now();
    let _ = scan(ScanOptions::default()).expect("scan");
    let elapsed = started.elapsed();

    assert!(
        elapsed.as_millis() < 500,
        "§50 budgets port discovery at 500 ms, took {elapsed:?}"
    );
}

#[test]
fn framework_detection_reads_the_command_line() {
    let project = detect_project(
        Some("/Users/joy/projects/my-dashboard"),
        Some("node /Users/joy/projects/my-dashboard/node_modules/.bin/next dev"),
        "node",
    )
    .expect("project");

    assert_eq!(project.name, "my-dashboard");
    assert_eq!(project.framework.as_deref(), Some("Next.js"));
    assert_eq!(project.directory, "/Users/joy/projects/my-dashboard");
}

#[test]
fn a_bare_home_directory_is_not_a_project() {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .expect("home directory");
    assert!(
        detect_project(Some(&home), Some("zsh"), "zsh").is_none(),
        "sitting in $HOME tells us nothing about a project"
    );
}

#[test]
fn well_known_services_are_named() {
    let project = detect_project(
        Some("/var/lib/postgresql/data"),
        Some("/usr/local/bin/postgres -D /var/lib/postgresql/data"),
        "postgres",
    )
    .expect("project");
    assert_eq!(project.framework.as_deref(), Some("PostgreSQL"));
}
