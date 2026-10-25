CREATE TABLE IF NOT EXISTS social_mirror_profiles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, self_answers TEXT NOT NULL,
 owner_hash TEXT NOT NULL, creator_device TEXT NOT NULL,
 closed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_mirror_responses (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, device_hash TEXT NOT NULL,
 answers TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(profile_id,device_hash),
 FOREIGN KEY(profile_id) REFERENCES social_mirror_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS social_mirror_response_profile ON social_mirror_responses(profile_id);
