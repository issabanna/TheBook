CREATE TABLE IF NOT EXISTS free_book_leads (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 book_id TEXT NOT NULL DEFAULT 'sneakpeak-ideas',
 updates_requested INTEGER NOT NULL DEFAULT 0,
 email_verified INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 download_count INTEGER NOT NULL DEFAULT 0,
 last_download_at TEXT
);
