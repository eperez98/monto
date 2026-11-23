//! Monto desktop shell.
//!
//! The whole application (UI + SQLite engine compiled to WebAssembly) runs in
//! the WebView. The Rust side only provides native capabilities: file access
//! restricted to the app data folder and user-chosen files, native dialogs,
//! a single-instance guard so two windows never write the same database, and
//! opt-in updates from GitHub Releases verified with SHA-256 (see `updater`).

mod mail;
mod net;
mod hello;
mod sync;
mod vault;
mod ocr;
mod updater;

use tauri::Manager;

/// Opens one of Monto's GitHub pages in the default browser. Only these fixed addresses, never a URL sent by the UI.
#[tauri::command]
fn open_project_page(page: String) -> Result<(), String> {
    let url = match page.as_str() {
        "repo" => format!("https://github.com/{}", updater::REPO),
        "issues" => format!("https://github.com/{}/issues", updater::REPO),
        "releases" => format!("https://github.com/{}/releases", updater::REPO),
        // The author's other project, shown in About.
        "winnow" => "https://github.com/eperez98/WinNow".to_string(),
        _ => return Err("Página desconocida".into()),
    };
    #[cfg(windows)]
    let opener = "explorer";
    #[cfg(not(windows))]
    let opener = "xdg-open";
    std::process::Command::new(opener).arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![updater::check_update, updater::install_update, open_project_page, mail::mail_connect, mail::mail_sync, mail::mail_disconnect, ocr::read_receipt, vault::vault_device_key, vault::vault_create_device_key, hello::hello_available, hello::hello_enabled, hello::hello_enable, hello::hello_unlock, hello::hello_disable, sync::sync_write, sync::sync_meta, sync::sync_read, sync::sync_secret_get, sync::sync_secret_set, sync::sync_secret_clear])
        .setup(|app| {
            // Make sure the data folder exists before the UI asks for it.
            if let Ok(dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(dir.join("backups"));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Monto");
}
