-- Phase 2–6 extras

CREATE TABLE IF NOT EXISTS user_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks (user_id, created_at DESC);

-- Soft presence heartbeat for live room counts (session activity)
ALTER TABLE match_room_members
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_match_room_members_online
  ON match_room_members (room_id)
  WHERE is_online = TRUE;
