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

fn clear_files(
    base: &Path,
    forget: impl Fn(&str, &str) -> Result<(), String>,
) -> Result<(), String> {
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
    clear_files(
        &app.path().app_data_dir().map_err(|e| e.to_string())?,
        forget,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_managed_databases_and_backups_and_can_be_retried() {
        let base = std::env::temp_dir().join(format!(
            "monto-reset-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&base).unwrap();
        fs::create_dir_all(base.join("backups/profile2")).unwrap();
        for name in [
            "monto.db",
            "monto-profile2.db.tmp",
            "profiles.json",
            "backups/profile2/example.monto",
            "unrelated.db",
        ] {
            fs::write(base.join(name), b"fixture").unwrap();
        }
        for _ in 0..2 {
            clear_files(&base, |_, _| Ok(())).unwrap();
        }
        assert_eq!(fs::read_dir(&base).unwrap().count(), 1);
        assert!(base.join("unrelated.db").is_file());
        fs::remove_dir_all(base).unwrap();
    }
}
