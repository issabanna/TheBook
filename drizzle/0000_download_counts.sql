CREATE TABLE IF NOT EXISTS download_counts (
  book_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sample', 'full')),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, kind)
);
