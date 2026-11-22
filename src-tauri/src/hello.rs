//! Unlock with Windows Hello (fingerprint, face or the Windows PIN). When the user turns it on, Monto keeps the
//! profile's password in the Windows Credential Manager and hands it back only after Windows Hello confirms that the
//! person at the keyboard is the account owner.

use keyring::Entry;

const SERVICE: &str = "Monto · Windows Hello";

fn entry(profile: &str) -> Result<Entry, String> {
    if profile.is_empty() || profile.len() > 64 || !profile.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
        return Err("Perfil no válido".into());
    }
    Entry::new(SERVICE, profile).map_err(|e| format!("Administrador de credenciales: {e}"))
}

#[cfg(windows)]
fn available() -> bool {
    use windows::Security::Credentials::UI::{UserConsentVerifier, UserConsentVerifierAvailability};
    UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.join())
        .map(|a| a == UserConsentVerifierAvailability::Available)
        .unwrap_or(false)
}

/// Shows the Windows Hello prompt over Monto's window; true when the user passed it.
#[cfg(windows)]
fn verify(hwnd: isize, message: &str) -> Result<bool, String> {
    use windows::core::{factory, HSTRING};
    use windows_future::IAsyncOperation;
    use windows::Security::Credentials::UI::{UserConsentVerificationResult, UserConsentVerifier};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::IUserConsentVerifierInterop;
    let interop = factory::<UserConsentVerifier, IUserConsentVerifierInterop>().map_err(|e| e.message())?;
    let op: IAsyncOperation<UserConsentVerificationResult> =
        unsafe { interop.RequestVerificationForWindowAsync(HWND(hwnd as *mut _), &HSTRING::from(message)) }.map_err(|e| e.message())?;
    Ok(op.join().map_err(|e| e.message())? == UserConsentVerificationResult::Verified)
}

#[cfg(windows)]
fn window_handle(window: &tauri::WebviewWindow) -> Result<isize, String> {
    window.hwnd().map(|h| h.0 as isize).map_err(|e| e.to_string())
}

#[cfg(windows)]
async fn verify_on(window: &tauri::WebviewWindow, message: &'static str) -> Result<bool, String> {
    let hwnd = window_handle(window)?;
    tauri::async_runtime::spawn_blocking(move || verify(hwnd, message)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn hello_available() -> bool {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(available).await.unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Whether this profile has Windows Hello turned on (does not reveal anything).
#[tauri::command]
pub fn hello_enabled(profile: String) -> Result<bool, String> {
    match entry(&profile)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Turn it on: asks Windows Hello once, then keeps the password. The caller has already checked the password.
#[tauri::command]
pub async fn hello_enable(window: tauri::WebviewWindow, profile: String, secret: String) -> Result<bool, String> {
    let e = entry(&profile)?;
    if secret.is_empty() || secret.len() > 1024 {
        return Err("Contraseña no válida".into());
    }
    #[cfg(windows)]
    {
        if !verify_on(&window, "Confirma que eres tú para desbloquear Monto con Windows Hello").await? {
            return Ok(false);
        }
        e.set_password(&secret).map_err(|x| format!("No se pudo guardar: {x}"))?;
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        let _ = (window, e);
        Err("Windows Hello solo está disponible en Windows.".into())
    }
}

/// The profile's password after a successful Windows Hello check; None if the user cancelled or it isn't set up.
#[tauri::command]
pub async fn hello_unlock(window: tauri::WebviewWindow, profile: String) -> Result<Option<String>, String> {
    let e = entry(&profile)?;
    let secret = match e.get_password() {
        Ok(s) => s,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(x) => return Err(x.to_string()),
    };
    #[cfg(windows)]
    {
        Ok(if verify_on(&window, "Desbloquear Monto").await? { Some(secret) } else { None })
    }
    #[cfg(not(windows))]
    {
        let _ = (window, secret);
        Ok(None)
    }
}

#[tauri::command]
pub fn hello_disable(profile: String) -> Result<(), String> {
    match entry(&profile)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_simple_profile_ids() {
        assert!(super::entry("default").is_ok());
        assert!(super::entry("perfil-2_b").is_ok());
        assert!(super::entry("").is_err());
        assert!(super::entry("../x").is_err());
    }
}
