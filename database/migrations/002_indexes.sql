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
