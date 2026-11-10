# Book download report date filters

`/downloads` and `/Testing/downloads` retain the existing private Testing download scope and owner authentication. All time remains the default and reads the existing lifetime counters. Today, Last 7 days, Last 30 days and inclusive custom ranges read daily aggregates. The JSON report preserves `scope` and `books` and adds `range` and `dateTrackingStartedAt`.

Migration 0013 adds daily aggregates and atomic insert/update triggers on `download_counts`. The existing successful-download writer is unchanged. The triggers count only new increments and continue to work with the previous deployed writer after rollback. Daily dates use Amman time (UTC+3); report dates and timestamps use Asia/Amman. Invalid calendar dates, reversed ranges, future end dates, unknown shortcuts and custom ranges over 366 days are rejected.

Old counters provide only a lifetime count and last-request timestamp. They cannot be allocated to historical days. No historical counts are backfilled; the report shows the precise daily-tracking start time and keeps older totals under All time. No new personal data is recorded.

Tests cover midnight boundaries, inclusive ranges, matching HTML/JSON filters, owner access, existing historical totals, migration replay, all-time compatibility and atomic rollback on a daily-recording failure. Preview, HEAD and prefetch exclusions remain unchanged.
