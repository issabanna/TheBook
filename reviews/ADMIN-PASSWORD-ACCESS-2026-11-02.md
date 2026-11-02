# Password access to owner tools

The owner can sign in at `/admin/login` with username `admin`, then open `/Visits`, `/Sessions` and `/Testing` without a ChatGPT session. Protected report pages show the same password form when signed out. Native Sites owner identity remains an alternative.

Credentials are configured only through secret runtime variables `ADMIN_PASSWORD_HASH` (salted PBKDF2-SHA256, 100,000 iterations) and `ADMIN_SESSION_KEY`. No credential values are included in source, HTML or the deployment artifact. The signed admin cookie is host-only, Secure, HttpOnly, SameSite=Strict, and expires after eight hours. A POST sign-out clears the browser cookie. Login and sign-out require a same-origin request. The return destination is restricted to local owner-tool paths.

Sign-in is limited to ten attempts per platform-provided IP per fifteen-minute window. Existing D1 `contact_limits` stores only an HMAC of that address with an admin namespace. No schema migration, data backfill or customer-record changes are needed. The same owner guard protects all existing owner reports and full-book review routes. Password-admin activity is excluded from first-party measurements, as native-owner activity already was. Social Mirror personal-result ownership remains independent.

Verification: all 67 Node tests pass, including the complete password → cookie → report/API/Testing flow, wrong credentials, rate limits, tampering, expiry, sign-out, cross-origin rejection, return-path restrictions and owner measurement exclusion. The production bundle builds and passes `node --check`; `git diff --check` passes. Hosted sign-in, private data requests and sign-out are checked after deployment without printing credentials or report contents. No real payment or outbound message is sent.

Rollback: saved Sites version 160 and Git tag `before-admin-password-access-2026-11-02`; details in `design-versions/before-admin-password-access.json`. Keep existing book and payment secrets unchanged. Reverting code does not delete any visit/session records.
