ALTER TABLE site_sessions ADD COLUMN stats_excluded INTEGER NOT NULL DEFAULT 0 CHECK (stats_excluded IN (0, 1));
--> statement-breakpoint
CREATE INDEX site_sessions_stats_range ON site_sessions (stats_excluded, started_day, site);
--> statement-breakpoint
DROP TRIGGER site_session_event_totals;
--> statement-breakpoint
CREATE TRIGGER site_session_event_totals AFTER INSERT ON site_session_events
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
  SELECT NEW.day, NEW.site, NEW.event_name, NEW.page, NEW.target, NEW.source, NEW.country, 1, NEW.occurred_at
  WHERE NOT EXISTS (SELECT 1 FROM site_sessions WHERE site=NEW.site AND session_id=NEW.session_id AND stats_excluded=1)
  ON CONFLICT (day, site, event_name, page, target, source, country)
  DO UPDATE SET event_count = site_visits_daily.event_count + 1, updated_at = MAX(site_visits_daily.updated_at, excluded.updated_at);
END;

--> statement-breakpoint
CREATE TRIGGER site_session_exclude_stats AFTER UPDATE OF stats_excluded ON site_sessions
WHEN OLD.stats_excluded=0 AND NEW.stats_excluded=1
BEGIN
  UPDATE site_visits_daily SET event_count=MAX(0, event_count-(
    SELECT COUNT(*) FROM site_session_events e
    WHERE e.site=NEW.site AND e.session_id=NEW.session_id
      AND e.day=site_visits_daily.day AND e.site=site_visits_daily.site
      AND e.event_name=site_visits_daily.event_name AND e.page=site_visits_daily.page
      AND e.target=site_visits_daily.target AND e.source=site_visits_daily.source
      AND e.country=site_visits_daily.country
  ))
  WHERE site=NEW.site AND day IN (SELECT day FROM site_session_events WHERE site=NEW.site AND session_id=NEW.session_id) AND EXISTS (
    SELECT 1 FROM site_session_events e
    WHERE e.site=NEW.site AND e.session_id=NEW.session_id
      AND e.day=site_visits_daily.day AND e.site=site_visits_daily.site
      AND e.event_name=site_visits_daily.event_name AND e.page=site_visits_daily.page
      AND e.target=site_visits_daily.target AND e.source=site_visits_daily.source
      AND e.country=site_visits_daily.country
  );
END;
--> statement-breakpoint
CREATE TRIGGER site_session_restore_stats AFTER UPDATE OF stats_excluded ON site_sessions
WHEN OLD.stats_excluded=1 AND NEW.stats_excluded=0
BEGIN
  INSERT INTO site_visits_daily (day,site,event_name,page,target,source,country,event_count,updated_at)
  SELECT day,site,event_name,page,target,source,country,COUNT(*),MAX(occurred_at)
  FROM site_session_events WHERE site=NEW.site AND session_id=NEW.session_id
  GROUP BY day,site,event_name,page,target,source,country
  ON CONFLICT(day,site,event_name,page,target,source,country)
  DO UPDATE SET event_count=site_visits_daily.event_count+excluded.event_count,
    updated_at=MAX(site_visits_daily.updated_at,excluded.updated_at);
END;
