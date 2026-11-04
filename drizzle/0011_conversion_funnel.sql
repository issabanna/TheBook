CREATE TABLE IF NOT EXISTS conversion_events (
 site TEXT NOT NULL CHECK(site IN ('live','testing')),
 event_id TEXT NOT NULL,
 session_id TEXT NOT NULL,
 day TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 event_name TEXT NOT NULL CHECK(event_name IN ('page_view','view_item','select_item','preview_opened','begin_checkout')),
 page TEXT NOT NULL,
 book_id TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL,
 PRIMARY KEY(site,event_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversion_events_range ON conversion_events(site,day,event_name,book_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversion_purchases (
 transaction_hash TEXT PRIMARY KEY,
 order_reference TEXT NOT NULL UNIQUE,
 book_id TEXT NOT NULL,
 value_cents INTEGER NOT NULL CHECK(value_cents>0),
 currency TEXT NOT NULL CHECK(currency='USD'),
 paid_at TEXT NOT NULL,
 paid_day TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 session_id TEXT,
 source TEXT NOT NULL DEFAULT 'unknown'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversion_purchases_range ON conversion_purchases(paid_day,book_id,source);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversion_refunds (
 refund_hash TEXT PRIMARY KEY,
 transaction_hash TEXT NOT NULL,
 value_cents INTEGER NOT NULL CHECK(value_cents>0),
 state TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 day TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversion_refunds_parent ON conversion_refunds(transaction_hash);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversion_checkout_attribution (
 order_id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL,
 source TEXT NOT NULL,
 started_at TEXT NOT NULL
);
