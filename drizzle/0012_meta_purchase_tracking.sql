CREATE TABLE IF NOT EXISTS meta_contexts (
 id TEXT PRIMARY KEY,
 session_id TEXT,
 consented_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 fbp TEXT,
 fbc TEXT,
 utm_json TEXT NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS meta_checkouts (
 id TEXT PRIMARY KEY,
 context_id TEXT NOT NULL,
 book_id TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS meta_checkouts_context ON meta_checkouts(context_id,book_id,started_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS meta_purchase_outbox (
 event_id TEXT PRIMARY KEY,
 context_id TEXT NOT NULL,
 book_id TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('live','test')),
 payload_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','dropped')),
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 sent_at INTEGER,
 last_error_code TEXT
);
