-- Development seed data — clearly marked as demo/dev only
-- Password for all demo users: password123
-- bcrypt hash of "password123" (cost 12)

DO $$
DECLARE
  v_football UUID;
  v_admin UUID;
  v_demo UUID;
  v_fan UUID;
  v_bettor UUID;
  v_greece UUID;
  v_spain UUID;
  v_england UUID;
  v_france UUID;
  v_germany UUID;
  v_italy UUID;
  v_comp UUID;
  v_match UUID;
  v_room UUID;
  v_pwd TEXT := '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2oQ.YqKzqKzqK';
  -- placeholder — will be replaced by seed script with real hash
BEGIN
  -- sports
  INSERT INTO sports (id, slug, name, name_el, icon, sort_order)
  VALUES
    (gen_random_uuid(), 'football', 'Football', 'Ποδόσφαιρο', '⚽', 1),
    (gen_random_uuid(), 'basketball', 'Basketball', 'Μπάσκετ', '🏀', 2),
    (gen_random_uuid(), 'tennis', 'Tennis', 'Τένις', '🎾', 3),
    (gen_random_uuid(), 'volleyball', 'Volleyball', 'Βόλεϊ', '🏐', 4),
    (gen_random_uuid(), 'motorsport', 'Motorsport', 'Μηχανοκίνητος', '🏎️', 5),
    (gen_random_uuid(), 'boxing', 'Boxing', 'Πυγμαχία', '🥊', 6),
    (gen_random_uuid(), 'esports', 'Esports', 'Esports', '🎮', 7)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_football FROM sports WHERE slug = 'football';

  -- NOTE: Actual password hashes are applied by scripts/seed.ts
  -- This SQL seed is a structural fallback for sports/teams/matches only when run alone.
END $$;

-- Teams & demo match are seeded by scripts/seed.ts for correct password hashes.
-- Minimal sports confirmation:
INSERT INTO sports_sync_state (sync_key, last_success_at, metadata)
VALUES ('seed_marker', NOW(), '{"source":"004_seed_data.sql","note":"dev seed marker"}')
ON CONFLICT (sync_key) DO UPDATE SET last_success_at = NOW();
