fn main() {
    // Test binaries do not get the application manifest that `tauri_build`
    // embeds into `[[bin]]` targets, so they load comctl32 v5.82 and fail at
    // load time on `TaskDialogIndirect`. Ask for Common-Controls v6 explicitly.
    #[cfg(windows)]
    println!(
        "cargo:rustc-link-arg-tests=/MANIFESTDEPENDENCY:type='win32' \
         name='Microsoft.Windows.Common-Controls' version='6.0.0.0' \
         processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'"
    );
    tauri_build::build()
}
