-- ΣΤΟΝ ΚΟΥΒΑ! — Initial schema
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(20) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  password_hash   TEXT NOT NULL,
  display_name    VARCHAR(80) NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
  is_moderator    BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE profiles (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prediction_correct    INT NOT NULL DEFAULT 0,
  prediction_wrong      INT NOT NULL DEFAULT 0,
  followers_count       INT NOT NULL DEFAULT 0,
  following_count       INT NOT NULL DEFAULT 0,
  posts_count           INT NOT NULL DEFAULT 0,
  reputation_score      NUMERIC(6,2) NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  csrf_token      TEXT NOT NULL,
  user_agent      TEXT,
  ip_address      INET,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);

CREATE TABLE user_settings (
  user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language                VARCHAR(10) NOT NULL DEFAULT 'el',
  notify_follows          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_likes            BOOLEAN NOT NULL DEFAULT TRUE,
  notify_comments         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_mentions         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_match_start      BOOLEAN NOT NULL DEFAULT TRUE,
  notify_predictions      BOOLEAN NOT NULL DEFAULT TRUE,
  private_profile         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SPORTS
-- ============================================================

CREATE TABLE sports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(40) NOT NULL UNIQUE,
  name            VARCHAR(80) NOT NULL,
  name_el         VARCHAR(80),
  icon            VARCHAR(16),
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE competitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id            UUID NOT NULL REFERENCES sports(id),
  external_id         VARCHAR(64),
  external_source     VARCHAR(40) DEFAULT 'sofascore',
  name                VARCHAR(160) NOT NULL,
  name_el             VARCHAR(160),
  country_code        VARCHAR(8),
  logo_url            TEXT,
  season              VARCHAR(40),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_source, external_id)
);

CREATE TABLE teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id            UUID NOT NULL REFERENCES sports(id),
  external_id         VARCHAR(64),
  external_source     VARCHAR(40) DEFAULT 'sofascore',
  name                VARCHAR(160) NOT NULL,
  name_el             VARCHAR(160),
  short_name          VARCHAR(40),
  country_code        VARCHAR(8),
  flag_emoji          VARCHAR(8),
  logo_url            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_source, external_id)
);

CREATE TABLE matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id            UUID NOT NULL REFERENCES sports(id),
  competition_id      UUID REFERENCES competitions(id),
  external_id         VARCHAR(64),
  external_source     VARCHAR(40) DEFAULT 'sofascore',
  home_team_id        UUID NOT NULL REFERENCES teams(id),
  away_team_id        UUID NOT NULL REFERENCES teams(id),
  status              VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  -- scheduled | live | finished | postponed | cancelled | interrupted
  start_time          TIMESTAMPTZ,
  minute              INT,
  home_score          INT NOT NULL DEFAULT 0,
  away_score          INT NOT NULL DEFAULT 0,
  period              VARCHAR(40),
  venue               TEXT,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_source, external_id)
);

CREATE TABLE match_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  external_id         VARCHAR(64),
  event_type          VARCHAR(40) NOT NULL,
  -- goal | yellow_card | red_card | substitution | period_start | period_end | var | other
  minute              INT,
  extra_minute        INT,
  team_side           VARCHAR(8),
  -- home | away
  player_name         TEXT,
  assist_name         TEXT,
  description         TEXT,
  payload             JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE match_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  period              VARCHAR(40) NOT NULL DEFAULT 'all',
  stat_key            VARCHAR(80) NOT NULL,
  home_value          NUMERIC,
  away_value          NUMERIC,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, period, stat_key)
);

-- ============================================================
-- MATCH ROOMS & CHAT
-- ============================================================

CREATE TABLE match_rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  status              VARCHAR(24) NOT NULL DEFAULT 'open',
  -- open | locked | archived
  member_count        INT NOT NULL DEFAULT 0,
  active_count        INT NOT NULL DEFAULT 0,
  message_count       INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE match_room_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES match_rooms(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_muted            BOOLEAN NOT NULL DEFAULT FALSE,
  muted_until         TIMESTAMPTZ,
  is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
  banned_until        TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);

CREATE TABLE messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                 UUID NOT NULL REFERENCES match_rooms(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  content                 TEXT NOT NULL,
  message_type            VARCHAR(24) NOT NULL DEFAULT 'user',
  -- user | system | goal | card | substitution | period
  reply_to_message_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE message_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction        VARCHAR(32) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, reaction)
);

CREATE TABLE message_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        VARCHAR(40) NOT NULL,
  reason          TEXT,
  status          VARCHAR(24) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, reporter_id)
);

CREATE TABLE message_mutes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID REFERENCES match_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_by        UUID NOT NULL REFERENCES users(id),
  reason          TEXT,
  muted_until     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE message_bans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID REFERENCES match_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by       UUID NOT NULL REFERENCES users(id),
  reason          TEXT,
  is_permanent    BOOLEAN NOT NULL DEFAULT FALSE,
  banned_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SOCIAL
-- ============================================================

CREATE TABLE posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_type           VARCHAR(24) NOT NULL DEFAULT 'TEXT',
  -- TEXT | MATCH | PREDICTION | POLL | IMAGE
  content             TEXT NOT NULL,
  match_id            UUID REFERENCES matches(id) ON DELETE SET NULL,
  prediction_id       UUID,
  media_url           TEXT,
  like_count          INT NOT NULL DEFAULT 0,
  comment_count       INT NOT NULL DEFAULT 0,
  reaction_count      INT NOT NULL DEFAULT 0,
  bookmark_count      INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE comments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id           UUID REFERENCES comments(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  like_count          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE post_likes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE post_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction        VARCHAR(32) NOT NULL,
  -- like | fire | laugh | bucket (ΣΤΟΝ ΚΟΥΒΑ!)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, reaction)
);

CREATE TABLE follows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE bookmarks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  mime_type       VARCHAR(80) NOT NULL,
  size_bytes      INT NOT NULL,
  width           INT,
  height          INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PREDICTIONS
-- ============================================================

CREATE TABLE predictions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  prediction_type     VARCHAR(40) NOT NULL DEFAULT 'opinion',
  -- opinion | next_goal | score | winner | custom
  status              VARCHAR(24) NOT NULL DEFAULT 'open',
  -- open | locked | hit | miss
  vote_have_it        INT NOT NULL DEFAULT 0,
  vote_bucket         INT NOT NULL DEFAULT 0,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- late FK from posts.prediction_id
ALTER TABLE posts
  ADD CONSTRAINT posts_prediction_id_fkey
  FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE SET NULL;

CREATE TABLE prediction_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote            VARCHAR(24) NOT NULL,
  -- have_it | bucket
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prediction_id, user_id)
);

CREATE TABLE prediction_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   UUID NOT NULL UNIQUE REFERENCES predictions(id) ON DELETE CASCADE,
  result          VARCHAR(24) NOT NULL,
  -- hit | miss
  resolved_by     UUID REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS / MODERATION / AUDIT
-- ============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(40) NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type     VARCHAR(40) NOT NULL,
  -- user | post | comment | message
  target_id       UUID NOT NULL,
  category        VARCHAR(40) NOT NULL,
  -- spam | harassment | abuse | hate_speech | illegal | other
  reason          TEXT,
  status          VARCHAR(24) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE moderation_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES users(id),
  target_type     VARCHAR(40) NOT NULL,
  target_id       UUID NOT NULL,
  action          VARCHAR(40) NOT NULL,
  -- warn | mute | ban | unban | delete | restore
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action          VARCHAR(80) NOT NULL,
  entity_type     VARCHAR(40),
  entity_id       UUID,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync metadata for sports worker
CREATE TABLE sports_sync_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_key        VARCHAR(80) NOT NULL UNIQUE,
  last_success_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_error      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'
);
-- Indexes for hot query paths

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_match_id ON posts (match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id);

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches (start_time);
CREATE INDEX IF NOT EXISTS idx_matches_status_start ON matches (status, start_time);
CREATE INDEX IF NOT EXISTS idx_matches_competition_id ON matches (competition_id);

CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events (match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match_minute ON match_events (match_id, minute);

CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions (match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions (user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions (status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows (following_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_match_room_members_room_id ON match_room_members (room_id);
CREATE INDEX IF NOT EXISTS idx_match_room_members_user_id ON match_room_members (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
-- Additional constraints & checks

ALTER TABLE users
  ADD CONSTRAINT users_username_format
  CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');

ALTER TABLE users
  ADD CONSTRAINT users_email_format
  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled', 'interrupted'));

ALTER TABLE matches
  ADD CONSTRAINT matches_scores_nonneg
  CHECK (home_score >= 0 AND away_score >= 0);

ALTER TABLE messages
  ADD CONSTRAINT messages_content_length
  CHECK (char_length(content) BETWEEN 1 AND 2000);

ALTER TABLE messages
  ADD CONSTRAINT messages_type_check
  CHECK (message_type IN ('user', 'system', 'goal', 'card', 'substitution', 'period'));

ALTER TABLE posts
  ADD CONSTRAINT posts_type_check
  CHECK (post_type IN ('TEXT', 'MATCH', 'PREDICTION', 'POLL', 'IMAGE'));

ALTER TABLE posts
  ADD CONSTRAINT posts_content_length
  CHECK (char_length(content) BETWEEN 1 AND 4000);

ALTER TABLE comments
  ADD CONSTRAINT comments_content_length
  CHECK (char_length(content) BETWEEN 1 AND 2000);

ALTER TABLE predictions
  ADD CONSTRAINT predictions_status_check
  CHECK (status IN ('open', 'locked', 'hit', 'miss'));

ALTER TABLE prediction_votes
  ADD CONSTRAINT prediction_votes_vote_check
  CHECK (vote IN ('have_it', 'bucket'));

ALTER TABLE prediction_results
  ADD CONSTRAINT prediction_results_result_check
  CHECK (result IN ('hit', 'miss'));

ALTER TABLE reports
  ADD CONSTRAINT reports_category_check
  CHECK (category IN ('spam', 'harassment', 'abuse', 'hate_speech', 'illegal', 'other'));

ALTER TABLE match_rooms
  ADD CONSTRAINT match_rooms_status_check
  CHECK (status IN ('open', 'locked', 'archived'));

ALTER TABLE post_reactions
  ADD CONSTRAINT post_reactions_reaction_check
  CHECK (reaction IN ('like', 'fire', 'laugh', 'bucket'));
