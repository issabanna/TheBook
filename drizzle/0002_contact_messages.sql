CREATE TABLE IF NOT EXISTS contact_messages (
 id TEXT PRIMARY KEY,
 reply_email TEXT NOT NULL,
 topic TEXT NOT NULL,
 message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent')),
 created_at TEXT NOT NULL,
 provider_id TEXT,
 last_attempt_at TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contact_messages_status_created ON contact_messages(status, created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS contact_limits (
 limit_key TEXT NOT NULL,
 window_start INTEGER NOT NULL,
 request_count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(limit_key, window_start)
);
