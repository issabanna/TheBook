CREATE TABLE IF NOT EXISTS site_sessions (
  site TEXT NOT NULL CHECK (site IN ('live', 'testing')),
  session_id TEXT NOT NULL,
  started_day TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZZ',
  city TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  first_page TEXT NOT NULL,
  last_page TEXT NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0,
  distinct_pages INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, session_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS site_sessions_range ON site_sessions (started_day, site, started_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS site_session_events (
  site TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 10000),
  day TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view', 'click')),
  page TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZZ',
  PRIMARY KEY (site, session_id, event_id),
  FOREIGN KEY (site, session_id) REFERENCES site_sessions (site, session_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS site_session_event_totals AFTER INSERT ON site_session_events
BEGIN
  UPDATE site_sessions SET
    started_at = MIN(started_at, NEW.occurred_at),
    last_seen_at = MAX(last_seen_at, NEW.occurred_at),
    page_views = page_views + CASE WHEN NEW.event_name = 'page_view' THEN 1 ELSE 0 END,
    clicks = clicks + CASE WHEN NEW.event_name = 'click' THEN 1 ELSE 0 END,
    distinct_pages = (SELECT COUNT(DISTINCT page) FROM site_session_events WHERE site = NEW.site AND session_id = NEW.session_id AND event_name = 'page_view'),
    first_page = (SELECT page FROM site_session_events WHERE site = NEW.site AND session_id = NEW.session_id ORDER BY sequence ASC, occurred_at ASC, event_id ASC LIMIT 1),
    last_page = (SELECT page FROM site_session_events WHERE site = NEW.site AND session_id = NEW.session_id ORDER BY sequence DESC, occurred_at DESC, event_id DESC LIMIT 1)
  WHERE site = NEW.site AND session_id = NEW.session_id;
  INSERT INTO site_visits_daily (day, site, event_name, page, target, source, country, event_count, updated_at)
  VALUES (NEW.day, NEW.site, NEW.event_name, NEW.page, NEW.target, NEW.source, NEW.country, 1, NEW.occurred_at)
  ON CONFLICT (day, site, event_name, page, target, source, country)
  DO UPDATE SET event_count = site_visits_daily.event_count + 1, updated_at = MAX(site_visits_daily.updated_at, excluded.updated_at);
END;
