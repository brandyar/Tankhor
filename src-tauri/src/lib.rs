#[tauri::command]
fn print_window(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        webview_window.print().map_err(|e| e.to_string())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = webview_window;
        Err("Printing is only supported on desktop platforms".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![print_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
