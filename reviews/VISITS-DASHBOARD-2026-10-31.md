# Private /Visits dashboard

User requested an owner dashboard separate from Google Analytics, corrected the
path to /Visits, and asked for each book preview/Buy Now click and Social Mirror
in the main metric boxes. The existing Sites identity integration protects the
dashboard and its JSON endpoint with the existing owner email configuration.

## Product behavior

- Six main boxes: page views, book views, four-page preview clicks, Buy Now
  clicks, Social Mirror visits and all tracked clicks.
- Today, Yesterday, Last 7 days, Last 30 days and custom inclusive date ranges
  (up to 366 days). All daily boundaries use Asia/Amman.
- Separate Live, Testing and combined reports; live is the default.
- Per-book views, preview clicks and Buy Now clicks, daily trend, page/action
  breakdowns and traffic sources/countries where available.
- Social Mirror start, invitation share/copy, results, card share/save and
  optional paid-offer/payment-link actions. These are actions, not completed
  profiles, verified purchases or revenue.
- A private owner footer link opens the dashboard. Guest pages do not show it.

Daily history begins with this release. The previous aggregate book-measurement
table has no daily breakdown or reliable live/Testing split. Its lifetime values
are shown separately, explicitly outside the date filters. No historical daily
visits are reconstructed or invented.

## Tracking and data

The runtime injects a small first-party script into the existing storefront and
Social Mirror documents. Public layouts, snapshots, PDFs and payments are
unchanged. The script observes links/buttons without delaying or cancelling
them, and follows SPA page navigation. It never sends query strings, fragments,
names, friend answers, email addresses, raw referrers or private management keys.
UTM/referrer sources map only to a short fixed source category.

Existing measurement opt-outs are respected. Signed-in owner traffic is
excluded at the browser and server. Counts are interactions and include repeat
visits; they are not unique visitor counts. Google Analytics remains unchanged.

One additive schema-only migration creates `site_visits_daily` and an index.
Prior SQL and journal entry values are unchanged; no data migrations or seeds
are included. Existing download, email, contact and Social Mirror records remain
untouched. The original logo is retained.

## Verification

- 54 tests pass, including six new meaningful tests covering owner/guest/wrong-
  account authorization; input/PII rejection; Amman midnight boundaries;
  inclusive/custom range and scope aggregation; real tracker → API → SQLite →
  report counts; and interactive dashboard filters/chart/empty states.
- The compiled Worker was tested with real in-memory SQLite, including daily
  persistence, the private data route and script injection into both versions of
  the storefront and Social Mirror.
- Build and diff checks pass. Existing public HTML snapshots, book manifests,
  payment handler and logo remain byte-identical to version 157.
- No real payment or automated browser/physical-device visual test performed.

## Routes and rollback

- Owner dashboard: https://oportals.com/Visits
- Owner JSON data: /Visits/data
- Testing owner dashboard: /Testing/Visits
- Public bounded event endpoints: /api/visits-event and /Testing/api/visits-event
- Immediate rollback: version 157, recorded in
  `design-versions/before-visits-dashboard.json`.
- Git tag: `before-visits-dashboard-2026-10-31`.

Rollback preserves the additive table and its data while reverting application
behavior. It does not require deleting records or reversing applied migrations.
