# Exclude owner-identified sessions from dashboard statistics

A session detail now has an **Exclude from stats** button. It removes that session’s historical and subsequent activity from Visits totals and Sessions summary metrics. The activity history remains available under **Show sessions → Excluded sessions**, with a **Restore to stats** action. Session list filters and pagination work independently of summary metrics, which always count included sessions only.

Migration 0010 adds a persistent inclusion flag and replaces the event aggregation trigger. Atomic exclusion/restoration triggers reconcile each retained event’s original day, site, page, action, source and country. Retrying the same state is idempotent. Future excluded events remain in the session timeline without increasing aggregates. Restoration adds retained events back exactly once. Existing aggregate-only history stays intact; no session is automatically changed on deployment. Google Analytics is separate.

The mutation requires owner authentication (including password admin), a same-origin POST and a bounded explicit boolean. Testing and live sessions remain independent. Unknown sessions return 404, and GET/HEAD cannot mutate state. No visitor session was selected or excluded during deployment.

Validation covers the actual dashboard script through API requests into SQLite and back: exclude, updated metrics, excluded-list retrieval and restore. Additional checks cover cross-day attribution, duplicate events, repeated state changes, future events, legacy aggregates, live/Testing isolation, password-only admin, unauthorized/CSRF requests and migration preservation of pre-existing data. All 87 existing and new Node tests pass. Worker build, syntax and whitespace checks pass. Browser automation is unavailable; DOM execution and hosted HTTP checks supplement the database tests.

Before-update tag: `before-session-stats-exclusions-2026-11-03` (saved version 170). Once sessions are excluded, retain the new exclusion-aware server queries when rolling back presentation changes: database flags and adjusted totals persist across deployments. Do not revert applied migrations or discard session history.
