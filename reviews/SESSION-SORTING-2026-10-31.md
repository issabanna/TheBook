# Sortable Sessions table

Every table heading is a keyboard-accessible sorting button: Session, Approximate
location, Started, Last action, Time observed, Page views and Clicks. A second
click reverses direction. Active arrows and aria-sort communicate current order.

Sorting runs server-side before pagination, covers the entire date/site-filtered
result set, and resets to the first page when the column changes. Direction and
column persist in the URL, refreshes and paging. The default remains newest-first.
Numeric fields sort numerically; duration uses the measured seconds. Locations
sort by displayed English city/country labels, not ISO country-code order.
Sort expressions and directions are allowlisted and tie ordering is stable.

## Verification

- 62 tests pass, including >50-session pagination/global sorting, numeric/time
  ordering, invalid sort rejection, displayed-location ordering and real header
  toggle/aria-sort checks alongside the existing session detail UI test.
- Build and diff checks pass. No schema migration or measurement change.
- Owner-only authorization, date filters and click details remain intact.
- No automated browser or physical-device visual test was available.

Review: https://oportals.com/Sessions
Rollback: version 159, recorded in design-versions/before-session-sorting.json.
Tag: before-session-sorting-2026-10-31.
