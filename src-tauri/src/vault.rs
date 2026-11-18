//! The key that encrypts Monto's database and backups on this computer. It lives in the Windows Credential Manager
//! (protected by the user's Windows sign-in), never next to the files, so another program reading the folder — a
//! notes app, a sync client — only sees ciphertext.

use keyring::Entry;

const SERVICE: &str = "Monto · llave del equipo";
const USER: &str = "base-de-datos";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(|e| format!("Administrador de credenciales: {e}"))
}

/// The stored key (base64 of 32 bytes), or None the first time.
#[tauri::command]
pub fn vault_device_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("No se pudo leer la llave del equipo: {e}")),
    }
}

/// Store a new key. Refuses to replace an existing one: files encrypted with it would become unreadable.
#[tauri::command]
pub fn vault_create_device_key(key: String) -> Result<(), String> {
    if !valid_key(&key) {
        return Err("Llave no válida".into());
    }
    if vault_device_key()?.is_some() {
        return Err("Ya existe una llave para este equipo".into());
    }
    entry()?.set_password(&key).map_err(|e| format!("No se pudo guardar la llave del equipo: {e}"))
}

/// 32 bytes in standard base64: 44 characters ending in one '='.
fn valid_key(k: &str) -> bool {
    k.len() == 44 && k.ends_with('=') && !k.ends_with("==") && k[..43].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
}

#[cfg(test)]
mod tests {
    #[test]
    fn accepts_only_a_32_byte_base64_key() {
        assert!(super::valid_key("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="));
        assert!(!super::valid_key("short"));
        assert!(!super::valid_key("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHg=="));
        assert!(!super::valid_key("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwd!h8="));
    }
}
