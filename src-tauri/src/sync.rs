//! Sync between the user's computers through a folder they already sync themselves (OneDrive, Google Drive, Dropbox…).
//! Monto only reads and writes two files of its own inside a "Monto" subfolder there: the profile's data, encrypted
//! with the sync password before it reaches this side, and a small JSON with the revision id. The sync password is
//! kept in the Windows Credential Manager so syncing needs no typing after the first time.

use keyring::Entry;
use std::fs;
use std::path::{Path, PathBuf};

const SERVICE: &str = "Monto · sincronización";

fn valid_profile(p: &str) -> bool {
    !p.is_empty() && p.len() <= 64 && p.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// `<folder>/Monto/<profile>.<ext>`, refusing anything but an existing absolute folder and a plain profile id.
fn file(folder: &str, profile: &str, ext: &str) -> Result<PathBuf, String> {
    let base = Path::new(folder);
    if !base.is_absolute() || !base.is_dir() {
        return Err("La carpeta de sincronización no existe.".into());
    }
    if !valid_profile(profile) {
        return Err("Perfil no válido".into());
    }
    let dir = base.join("Monto");
    fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear la carpeta Monto: {e}"))?;
    Ok(dir.join(format!("{profile}.{ext}")))
}

/// Write through a temporary file and rename, so a sync client never uploads half a file.
fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data).map_err(|e| format!("No se pudo escribir en la carpeta de sincronización: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("No se pudo escribir en la carpeta de sincronización: {e}"))
}

/// Data first, then the revision: another computer that sees the new revision always finds the matching data.
#[tauri::command]
pub fn sync_write(folder: String, profile: String, data: Vec<u8>, meta: String) -> Result<(), String> {
    if data.len() > 200 * 1024 * 1024 || meta.len() > 4096 {
        return Err("Archivo demasiado grande".into());
    }
    write_atomic(&file(&folder, &profile, "monto")?, &data)?;
    write_atomic(&file(&folder, &profile, "json")?, meta.as_bytes())
}

/// The revision JSON, or None when this folder has no data for the profile yet.
#[tauri::command]
pub fn sync_meta(folder: String, profile: String) -> Result<Option<String>, String> {
    match fs::read_to_string(file(&folder, &profile, "json")?) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn sync_read(folder: String, profile: String) -> Result<Option<Vec<u8>>, String> {
    match fs::read(file(&folder, &profile, "monto")?) {
        Ok(b) => Ok(Some(b)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn entry(profile: &str) -> Result<Entry, String> {
    if !valid_profile(profile) {
        return Err("Perfil no válido".into());
    }
    Entry::new(SERVICE, profile).map_err(|e| format!("Administrador de credenciales: {e}"))
}

#[tauri::command]
pub fn sync_secret_get(profile: String) -> Result<Option<String>, String> {
    match entry(&profile)?.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn sync_secret_set(profile: String, secret: String) -> Result<(), String> {
    if secret.is_empty() || secret.len() > 1024 {
        return Err("Contraseña no válida".into());
    }
    entry(&profile)?.set_password(&secret).map_err(|e| format!("No se pudo guardar: {e}"))
}

#[tauri::command]
pub fn sync_secret_clear(profile: String) -> Result<(), String> {
    match entry(&profile)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_reads_only_inside_the_monto_subfolder() {
        let dir = std::env::temp_dir().join(format!("monto-sync-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().to_string();
        assert_eq!(sync_meta(folder.clone(), "default".into()).unwrap(), None);
        sync_write(folder.clone(), "default".into(), vec![1, 2, 3], "{\"rev\":\"a\"}".into()).unwrap();
        assert_eq!(sync_read(folder.clone(), "default".into()).unwrap(), Some(vec![1, 2, 3]));
        assert!(dir.join("Monto").join("default.json").exists());
        assert!(sync_read(folder.clone(), "../x".into()).is_err());
        assert!(sync_read("relativo".into(), "default".into()).is_err());
        fs::remove_dir_all(&dir).unwrap();
    }
}
