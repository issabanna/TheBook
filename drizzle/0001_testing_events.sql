CREATE TABLE IF NOT EXISTS testing_events (
 event_name TEXT NOT NULL,
 book_id TEXT NOT NULL,
 country TEXT NOT NULL,
 event_count INTEGER NOT NULL DEFAULT 0 CHECK(event_count >= 0),
 updated_at TEXT NOT NULL,
 PRIMARY KEY (event_name, book_id, country)
);
