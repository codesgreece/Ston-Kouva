-- Migration 006: Real SofaScore integration — expanded match model & statuses

-- Migrate legacy status values before constraint change
UPDATE matches SET status = 'upcoming' WHERE status = 'scheduled';
UPDATE matches SET status = 'canceled' WHERE status = 'cancelled';
UPDATE matches SET status = 'suspended' WHERE status = 'interrupted';

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN (
    'upcoming', 'live', 'halftime', 'finished',
    'postponed', 'canceled', 'suspended', 'unknown'
  ));

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS slug VARCHAR(200),
  ADD COLUMN IF NOT EXISTS sofascore_event_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS start_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS status_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS status_code INT,
  ADD COLUMN IF NOT EXISTS status_description VARCHAR(160),
  ADD COLUMN IF NOT EXISTS status_period VARCHAR(40),
  ADD COLUMN IF NOT EXISTS injury_time INT,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_finished BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_postponed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_canceled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_upcoming BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS home_period_score JSONB,
  ADD COLUMN IF NOT EXISTS away_period_score JSONB,
  ADD COLUMN IF NOT EXISTS category_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS round_name VARCHAR(80);

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS slug VARCHAR(200),
  ADD COLUMN IF NOT EXISTS category_name VARCHAR(160);

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS slug VARCHAR(200);

-- Backfill SofaScore event IDs from existing external rows
UPDATE matches
SET sofascore_event_id = external_id
WHERE external_source = 'sofascore'
  AND sofascore_event_id IS NULL
  AND external_id IS NOT NULL;

UPDATE matches SET is_upcoming = TRUE, is_live = FALSE
WHERE status = 'upcoming';

UPDATE matches SET is_live = TRUE, is_upcoming = FALSE
WHERE status IN ('live', 'halftime');

UPDATE matches SET is_finished = TRUE, is_live = FALSE, is_upcoming = FALSE
WHERE status = 'finished';

UPDATE matches SET is_postponed = TRUE, is_live = FALSE
WHERE status = 'postponed';

UPDATE matches SET is_canceled = TRUE, is_live = FALSE
WHERE status = 'canceled';

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_sofascore_event_id
  ON matches (sofascore_event_id)
  WHERE sofascore_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_start_timestamp
  ON matches (start_timestamp);

CREATE INDEX IF NOT EXISTS idx_matches_is_live
  ON matches (is_live)
  WHERE is_live = TRUE;

CREATE INDEX IF NOT EXISTS idx_matches_is_upcoming_start
  ON matches (is_upcoming, start_time)
  WHERE is_upcoming = TRUE;

CREATE INDEX IF NOT EXISTS idx_matches_competition
  ON matches (competition_id);

CREATE INDEX IF NOT EXISTS idx_competitions_external
  ON competitions (external_source, external_id);

CREATE INDEX IF NOT EXISTS idx_teams_external
  ON teams (external_source, external_id);

-- Sports sync health metadata (no schema change — uses existing sports_sync_state)
