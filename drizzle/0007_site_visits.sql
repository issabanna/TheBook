CREATE TABLE IF NOT EXISTS site_visits_daily (
  day TEXT NOT NULL,
  site TEXT NOT NULL CHECK (site IN ('live', 'testing')),
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view', 'click')),
  page TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZZ',
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, site, event_name, page, target, source, country)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS site_visits_daily_range ON site_visits_daily (day, site);
