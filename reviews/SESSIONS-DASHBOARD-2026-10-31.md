# Owner-only Sessions report and click timelines

User requested sessions with location, time, page counts and clickable per-session
activity. Added /Sessions, linked from /Visits, with the same report identity and
owner authorization. /Testing/Sessions provides the Testing default.

## Behavior

- Today, Yesterday, Last 7/30 days and custom inclusive Amman start-date ranges;
  separate Live, Testing and combined scope. Fifty sessions per page.
- Session start/last-action times, approximate city/country where supplied by
  hosting, browser time zone as a separately labeled fallback, source, observed
  duration, total page views, distinct pages and tracked click count.
- Clicking a session opens its timeline. Clicks only is the default; All activity
  includes page views. Book previews, Buy Now, Social Mirror and navigation
  actions have readable labels. Escape and Close dismiss the accessible dialog.

Observed duration is the span between first and last server-recorded actions,
not continuous attention or screen time. One-event sessions show 0s. Location may
be missing or affected by VPNs; browser time zone does not establish location.
Earlier aggregate traffic is not reconstructed into sessions.

## Collection and integrity

- Random anonymous IDs live in browser sessionStorage, renewing after 30 minutes
  without a tracked action. No cross-device or named visitor profile is created.
- Fixed page/action labels exclude query strings, fragments, form values, names,
  friend answers, emails, IP addresses, payment IDs and private management keys.
- Existing opt-outs disable collection and clear the tab session ID. Signed-in
  owner activity is excluded. Google Analytics remains unchanged.
- Event IDs make retries idempotent while preserving distinct events when tabs
  copy a sequence counter. The additive SQLite trigger atomically updates both
  the session summary and existing daily aggregate counts.
- Legacy aggregate-only clients continue to work. No existing records are
  backfilled, reidentified or deleted.
- Existing measurement preferences and privacy copy now describe anonymous
  sessions. No new popup, registration flow or public dashboard link is added.

## Verification

- 60 tests pass. Six new tests cover owner authorization on list/detail endpoints,
  idempotence/out-of-order events/copied counters, bounded input and location,
  scope/date/duration/page aggregation, cross-navigation expiry/opt-out, and the
  actual session modal with click/all-activity switching.
- Compiled Worker tested with real in-memory SQLite and migration triggers.
- Existing paid-book/catalogue UI checks pass; PDFs, payment handler, Social
  Mirror API, logo and previously applied migration entry values are unchanged.
- No real PayPal transaction or automated browser/physical-device visual test.

## Migration, routes and rollback

One appended schema-only migration, 0008_site_sessions, creates two tables, an
index and a counter trigger. No seed or historical data migration is included.

- Owner page: https://oportals.com/Sessions
- List: /Sessions/data
- Detail: /Sessions/session/:id?site=live (owner-only)
- Immediate rollback: version 158, recorded in
  `design-versions/before-sessions-dashboard.json`.
- Tag: `before-sessions-dashboard-2026-10-31`.

Application rollback does not delete the additive tables or collected history.
