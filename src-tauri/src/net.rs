//! The only way Monto talks to the internet: an HTTPS-only client. A plain `http://` URL (or a redirect to one) fails
//! before any byte is sent, so update downloads and bank-email requests can't be downgraded.

use std::time::Duration;

pub fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .https_only(true)
        .timeout_connect(Duration::from_secs(15))
        .timeout_read(Duration::from_secs(60))
        .build()
}

#[cfg(test)]
mod tests {
    #[test]
    fn refuses_plain_http_before_connecting() {
        let err = super::agent().get("http://example.com/").call().unwrap_err();
        assert!(matches!(err.kind(), ureq::ErrorKind::InsecureRequestHttpsOnly), "{err}");
    }
}
