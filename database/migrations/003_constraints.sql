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
