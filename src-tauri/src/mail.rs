//! Read-only access to the user's bank notification emails (Gmail or Outlook), opt-in.
//!
//! The WebView cannot reach the network (its CSP only allows its own origin), so these commands do the
//! HTTP work. They only ever talk to Google's and Microsoft's fixed OAuth and mail endpoints; the UI
//! sends a provider name, never a URL. Sign-in uses the OAuth 2.0 loopback flow with PKCE: the browser
//! returns to http://127.0.0.1:<port>/ on this machine, so no server of ours is involved.
//!
//! Nothing is kept: no refresh token is requested, the access token lives only inside one `mail_read`
//! call (Google's is revoked right after), and only subject, sender, date and text body are requested.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

struct Provider {
    auth: &'static str,
    token: &'static str,
    scope: &'static str,
}

fn provider(name: &str) -> Result<Provider, String> {
    match name {
        "google" => Ok(Provider {
            auth: "https://accounts.google.com/o/oauth2/v2/auth",
            token: "https://oauth2.googleapis.com/token",
            scope: "https://www.googleapis.com/auth/gmail.readonly",
        }),
        "microsoft" => Ok(Provider {
            auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scope: "https://graph.microsoft.com/Mail.Read",
        }),
        _ => Err("Proveedor de correo desconocido".into()),
    }
}

/// RFC 3986 percent-encoding for query values.
pub fn enc(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Decode a query value from the redirect (Google codes look like `4%2F0Ab…`); `+` means a space.
pub fn dec(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'%' if i + 2 < b.len() => {
                match u8::from_str_radix(std::str::from_utf8(&b[i + 1..i + 3]).unwrap_or("zz"), 16) {
                    Ok(v) => { out.push(v); i += 3; continue; }
                    Err(_) => out.push(b'%'),
                }
            }
            b'+' => out.push(b' '),
            c => out.push(c),
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn auth_url(p: &str, client_id: &str, redirect: &str, challenge: &str, state: &str) -> Result<String, String> {
    let pr = provider(p)?;
    // Online access only: no refresh token is issued, so there is nothing long-lived to keep.
    let extra = if p == "google" { "&access_type=online&prompt=consent" } else { "&prompt=select_account" };
    Ok(format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256&state={}{extra}",
        pr.auth, enc(client_id), enc(redirect), enc(pr.scope), enc(challenge), enc(state)
    ))
}

/// Body as JSON (ureq is built without its `json` feature).
fn json(r: ureq::Response) -> Result<serde_json::Value, String> {
    serde_json::from_str(&r.into_string().map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(15)).timeout_read(Duration::from_secs(60)).build()
}

fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    let opener = "explorer";
    #[cfg(not(windows))]
    let opener = "xdg-open";
    std::process::Command::new(opener).arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Read `code` from the browser's redirect, checking `state`; waits up to 3 minutes for one request.
fn wait_for_code(listener: &TcpListener, state: &str) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(180);
    loop {
        match listener.accept() {
            Ok((mut s, _)) => {
                s.set_nonblocking(false).ok();
                s.set_read_timeout(Some(Duration::from_secs(10))).ok();
                let mut buf = [0u8; 8192];
                let n = s.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);
                let path = req.lines().next().unwrap_or("").split_whitespace().nth(1).unwrap_or("");
                let q = path.split_once('?').map(|x| x.1).unwrap_or("");
                let get = |k: &str| q.split('&').find_map(|kv| kv.split_once('=').filter(|(a, _)| *a == k).map(|(_, v)| dec(v)));
                if get("state").as_deref() != Some(state) {
                    // A stray request (favicon, another tab): ignore it and keep waiting.
                    let _ = s.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                    continue;
                }
                let body = "<!doctype html><meta charset=utf-8><title>Monto</title><body style=\"font-family:system-ui;padding:40px\"><h2>Listo. Ya puedes volver a Monto.</h2><p>Puedes cerrar esta pesta\u{f1}a.</p></body>";
                let _ = s.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes());
                if let Some(err) = get("error") { return Err(format!("El inicio de sesi\u{f3}n se cancel\u{f3} ({err})")); }
                return get("code").ok_or_else(|| "No se recibi\u{f3} el c\u{f3}digo de autorizaci\u{f3}n".to_string());
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline { return Err("Se agot\u{f3} el tiempo para iniciar sesi\u{f3}n".into()); }
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

fn token_request(p: &str, form: &[(&str, &str)]) -> Result<serde_json::Value, String> {
    let pr = provider(p)?;
    match agent().post(pr.token).send_form(form) {
        Ok(r) => json(r),
        Err(ureq::Error::Status(_, r)) => {
            let v = json(r).unwrap_or_default();
            Err(format!("El proveedor rechaz\u{f3} la solicitud: {}", v["error_description"].as_str().or(v["error"].as_str()).unwrap_or("error desconocido")))
        }
        Err(e) => Err(format!("Sin conexi\u{f3}n con el proveedor: {e}")),
    }
}

fn get_json(url: &str, token: &str) -> Result<serde_json::Value, String> {
    match agent().get(url).set("Authorization", &format!("Bearer {token}")).call() {
        Ok(r) => json(r),
        Err(ureq::Error::Status(code, _)) => Err(format!("El servicio de correo respondi\u{f3} {code}")),
        Err(e) => Err(format!("Sin conexi\u{f3}n con el servicio de correo: {e}")),
    }
}

/// Sign in, read recent emails whose subject contains `subject` (at most 50) and forget the access.
/// Nothing is returned but the trimmed messages: no token ever leaves this function.
#[tauri::command]
pub async fn mail_read(provider: String, client_id: String, client_secret: Option<String>, challenge: String, verifier: String, state: String, subject: String, days: u32) -> Result<Vec<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        let redirect = format!("http://127.0.0.1:{}/", listener.local_addr().map_err(|e| e.to_string())?.port());
        open_browser(&auth_url(&provider, &client_id, &redirect, &challenge, &state)?)?;
        let code = wait_for_code(&listener, &state)?;
        drop(listener);
        let secret = client_secret.unwrap_or_default();
        let mut form = vec![("grant_type", "authorization_code"), ("code", code.as_str()), ("client_id", client_id.as_str()), ("redirect_uri", redirect.as_str()), ("code_verifier", verifier.as_str())];
        if !secret.is_empty() { form.push(("client_secret", secret.as_str())); }
        let t = token_request(&provider, &form)?;
        let access = t["access_token"].as_str().ok_or("Sin token de acceso")?.to_string();
        let days = days.clamp(1, 365);
        let subject = subject.replace(['"', '\''], "");
        let result = if provider == "google" { read_gmail(&access, &subject, days) } else { read_outlook(&access, &subject, days) };
        if provider == "google" {
            // Best effort: invalidate the access token now instead of letting it live its hour.
            let _ = agent().post("https://oauth2.googleapis.com/revoke").send_form(&[("token", access.as_str())]);
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

fn read_gmail(access: &str, subject: &str, days: u32) -> Result<Vec<serde_json::Value>, String> {
    let q = format!("subject:\"{subject}\" newer_than:{days}d");
    let list = get_json(&format!("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&fields=messages(id)&q={}", enc(&q)), access)?;
    // Only the date, the headers and the text parts; attachments are never requested.
    let fields = enc("id,internalDate,payload(headers,mimeType,body/data,parts(mimeType,body/data,parts(mimeType,body/data)))");
    let mut out = vec![];
    for m in list["messages"].as_array().cloned().unwrap_or_default() {
        let Some(id) = m["id"].as_str() else { continue };
        // Gmail ids are hex; anything else is not put in a URL.
        if !id.chars().all(|c| c.is_ascii_alphanumeric()) { continue; }
        let mut msg = get_json(&format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=full&fields={fields}"), access)?;
        // Keep just Subject, From and Date out of all the headers.
        if let Some(h) = msg["payload"]["headers"].as_array_mut() {
            h.retain(|x| matches!(x["name"].as_str().map(str::to_ascii_lowercase).as_deref(), Some("subject" | "from" | "date")));
        }
        out.push(msg);
    }
    Ok(out)
}

fn read_outlook(access: &str, subject: &str, days: u32) -> Result<Vec<serde_json::Value>, String> {
    let filter = format!("receivedDateTime ge {} and contains(subject,'{}')", chrono_like_days_ago(days), subject);
    let v = get_json(&format!("https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,body&$filter={}", enc(&filter)), access)?;
    Ok(v["value"].as_array().cloned().unwrap_or_default())
}

/// UTC timestamp `days` ago as ISO 8601 (YYYY-MM-DDT00:00:00Z), without pulling in a date crate.
pub fn chrono_like_days_ago(days: u32) -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0).saturating_sub(days as u64 * 86_400);
    let (y, m, d) = civil_from_days((secs / 86_400) as i64);
    format!("{y:04}-{m:02}-{d:02}T00:00:00Z")
}

/// Days since 1970-01-01 to (year, month, day) — Howard Hinnant's algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + if m <= 2 { 1 } else { 0 }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_pkce_auth_urls_for_known_providers_only() {
        let g = auth_url("google", "abc.apps.googleusercontent.com", "http://127.0.0.1:5555/", "CH", "ST").unwrap();
        assert!(g.starts_with("https://accounts.google.com/o/oauth2/v2/auth?"));
        assert!(g.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2F") && g.contains("code_challenge_method=S256") && g.contains("access_type=online"));
        assert!(g.contains("gmail.readonly"));
        let m = auth_url("microsoft", "id", "http://127.0.0.1:1/", "CH", "ST").unwrap();
        assert!(m.contains("Mail.Read") && !m.contains("offline_access"));
        assert!(auth_url("https://evil.example", "id", "r", "c", "s").is_err());
    }

    #[test]
    fn encodes_and_dates() {
        assert_eq!(enc("a b\"c'&"), "a%20b%22c%27%26");
        assert_eq!(dec("4%2F0AbCd%3D"), "4/0AbCd=");
        assert_eq!(dec("a+b%"), "a b%");
        assert_eq!(dec(&enc("4/0Ab é")), "4/0Ab é");
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_772), (2026, 11, 15));
    }
}
