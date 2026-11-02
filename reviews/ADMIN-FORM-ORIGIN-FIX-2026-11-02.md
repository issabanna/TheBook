# Browser password-form correction

A real browser submitting a form from a document with `Referrer-Policy: no-referrer` can send the literal `Origin: null`. The admin endpoint correctly rejected that origin, so normal users could not sign in even though manual HTTP tests with an explicit Origin passed.

Use `Referrer-Policy: same-origin` on the dedicated sign-in page, the login forms embedded in blocked owner routes, Visits/Sessions, and password-admin storefront pages containing the sign-out form. Cross-site requests still receive no referrer under this policy. Exact same-origin validation remains mandatory for login/logout; null, missing and foreign origins remain rejected. Failed origin checks render the sign-in page with a reload instruction instead of a bare technical error.

Regression checks cover standalone and embedded form headers, authenticated dashboard and Testing sign-out headers, valid form submission, and null/foreign-origin rejection. All 68 Node tests pass, the bundle builds, and its syntax is checked. Hosted headers and the password → dashboard/API → sign-out flow are verified after deployment. An automated physical browser is unavailable in this environment; HTTP tests do not constitute an actual browser UI test.

Rollback: Sites version 161, source commit df2aa4a78fde24c57d0bbf3d2fab79d04460b097, tag before-admin-form-origin-fix-2026-11-02. No secrets, payment integrations or database schema are changed.
