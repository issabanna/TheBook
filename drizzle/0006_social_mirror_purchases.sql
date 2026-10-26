CREATE TABLE IF NOT EXISTS social_mirror_purchases (
 transaction_id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL,
 purchased_at TEXT NOT NULL
);
