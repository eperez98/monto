use std::{fs, path::Path};
use tauri::Manager;

fn profile_id(stem: &str) -> Option<&str> {
    if stem == "monto" {
        return Some("default");
    }
    stem.strip_prefix("monto-").filter(|id| {
        !id.is_empty()
            && id.len() <= 64
            && id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    })
}

fn forget(service: &str, user: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, user).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn clear_files(base: &Path) -> Result<(), String> {
    let mut profiles = std::collections::BTreeSet::from([String::from("default")]);
    let mut files = Vec::new();
    for entry in fs::read_dir(base).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if let Some(id) = name
            .strip_suffix(".db.tmp")
            .or_else(|| name.strip_suffix(".db"))
            .and_then(profile_id)
        {
            profiles.insert(id.to_string());
            files.push(path);
        } else if name == "profiles.json" {
            files.push(path);
        }
    }
    for id in profiles {
        forget("Monto · Windows Hello", &id)?;
        forget("Monto · sincronización", &id)?;
    }
    for provider in ["google", "microsoft"] {
        forget("Monto · correo del banco", provider)?;
    }
    for path in files {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    match fs::remove_dir_all(base.join("backups")) {
        Ok(()) => (),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
        Err(e) => return Err(e.to_string()),
    }
    forget("Monto · llave del equipo", "base-de-datos")
}

#[tauri::command]
pub fn reset_local_data(app: tauri::AppHandle) -> Result<(), String> {
    clear_files(&app.path().app_data_dir().map_err(|e| e.to_string())?)
}
