-- Preserve existing lifetime counts. They have no per-download dates and must
-- never be backfilled into an arbitrary day using the last updated timestamp.
CREATE TABLE IF NOT EXISTS download_daily_counts (
  day TEXT NOT NULL,
  book_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sample', 'full')),
  download_count INTEGER NOT NULL CHECK (download_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, book_id, kind)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS download_date_tracking (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO download_date_tracking (id, started_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
--> statement-breakpoint
-- Amman has used UTC+3 year-round since October 2022. These triggers keep
-- daily counts atomic with the existing counter and compatible with rollback.
CREATE TRIGGER IF NOT EXISTS download_daily_insert AFTER INSERT ON download_counts
WHEN NEW.download_count > 0
BEGIN
  INSERT INTO download_daily_counts (day, book_id, kind, download_count, updated_at)
  VALUES (date(NEW.updated_at, '+3 hours'), NEW.book_id, NEW.kind, NEW.download_count, NEW.updated_at)
  ON CONFLICT (day, book_id, kind) DO UPDATE SET
    download_count = download_daily_counts.download_count + excluded.download_count,
    updated_at = MAX(download_daily_counts.updated_at, excluded.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS download_daily_update AFTER UPDATE OF download_count ON download_counts
WHEN NEW.download_count > OLD.download_count
BEGIN
  INSERT INTO download_daily_counts (day, book_id, kind, download_count, updated_at)
  VALUES (date(NEW.updated_at, '+3 hours'), NEW.book_id, NEW.kind, NEW.download_count - OLD.download_count, NEW.updated_at)
  ON CONFLICT (day, book_id, kind) DO UPDATE SET
    download_count = download_daily_counts.download_count + excluded.download_count,
    updated_at = MAX(download_daily_counts.updated_at, excluded.updated_at);
END;
