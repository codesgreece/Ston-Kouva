import path from "path";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import pg from "pg";

config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Development seed data.
 * Demo password for all users: password123
 */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const passwordHash = await bcrypt.hash("password123", 12);

    await client.query("BEGIN");

    // Ensure football sport exists
    await client.query(`
      INSERT INTO sports (slug, name, name_el, icon, sort_order)
      VALUES
        ('football', 'Football', 'Ποδόσφαιρο', '⚽', 1),
        ('basketball', 'Basketball', 'Μπάσκετ', '🏀', 2),
        ('tennis', 'Tennis', 'Τένις', '🎾', 3),
        ('volleyball', 'Volleyball', 'Βόλεϊ', '🏐', 4),
        ('motorsport', 'Motorsport', 'Μηχανοκίνητος', '🏎️', 5),
        ('boxing', 'Boxing', 'Πυγμαχία', '🥊', 6),
        ('esports', 'Esports', 'Esports', '🎮', 7)
      ON CONFLICT (slug) DO NOTHING
    `);

    const football = await client.query<{ id: string }>(
      `SELECT id FROM sports WHERE slug = 'football'`,
    );
    const sportId = football.rows[0]?.id;
    if (!sportId) throw new Error("football sport missing");

    const users = [
      {
        username: "admin",
        email: "admin@stonkouva.local",
        display: "Admin",
        admin: true,
        mod: true,
      },
      {
        username: "demo_user",
        email: "demo@stonkouva.local",
        display: "Demo User",
        admin: false,
        mod: false,
      },
      {
        username: "football_fan",
        email: "fan@stonkouva.local",
        display: "Football Fan",
        admin: false,
        mod: false,
      },
      {
        username: "bettor",
        email: "bettor@stonkouva.local",
        display: "Bettor Opinions",
        admin: false,
        mod: false,
      },
    ];

    const userIds: Record<string, string> = {};

    for (const u of users) {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [u.username],
      );

      let id = existing.rows[0]?.id;
      if (id) {
        await client.query(
          `UPDATE users
           SET password_hash = $2,
               display_name = $3,
               is_admin = $4,
               is_moderator = $5,
               is_verified = TRUE,
               updated_at = NOW()
           WHERE id = $1`,
          [id, passwordHash, u.display, u.admin, u.mod],
        );
      } else {
        const result = await client.query<{ id: string }>(
          `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_moderator, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           RETURNING id`,
          [u.username, u.email, passwordHash, u.display, u.admin, u.mod],
        );
        id = result.rows[0]?.id;
      }

      if (!id) throw new Error(`Failed to upsert user ${u.username}`);
      userIds[u.username] = id;

      await client.query(
        `INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [id],
      );
      await client.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [id],
      );
    }

    // Competition
    const comp = await client.query<{ id: string }>(
      `INSERT INTO competitions (sport_id, external_id, external_source, name, name_el, country_code)
       VALUES ($1, 'demo-intl', 'seed', 'International Friendly', 'Φιλικός Διεθνής', 'INT')
       ON CONFLICT (external_source, external_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [sportId],
    );
    const competitionId = comp.rows[0].id;

    const teams = [
      { key: "greece", name: "Greece", nameEl: "Ελλάδα", flag: "🇬🇷", short: "GRE", ext: "seed-greece" },
      { key: "spain", name: "Spain", nameEl: "Ισπανία", flag: "🇪🇸", short: "ESP", ext: "seed-spain" },
      { key: "england", name: "England", nameEl: "Αγγλία", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", short: "ENG", ext: "seed-england" },
      { key: "france", name: "France", nameEl: "Γαλλία", flag: "🇫🇷", short: "FRA", ext: "seed-france" },
      { key: "germany", name: "Germany", nameEl: "Γερμανία", flag: "🇩🇪", short: "GER", ext: "seed-germany" },
      { key: "italy", name: "Italy", nameEl: "Ιταλία", flag: "🇮🇹", short: "ITA", ext: "seed-italy" },
    ];

    const teamIds: Record<string, string> = {};
    for (const t of teams) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO teams (sport_id, external_id, external_source, name, name_el, short_name, country_code, flag_emoji)
         VALUES ($1, $2, 'seed', $3, $4, $5, $6, $7)
         ON CONFLICT (external_source, external_id) DO UPDATE
           SET name = EXCLUDED.name, name_el = EXCLUDED.name_el, flag_emoji = EXCLUDED.flag_emoji
         RETURNING id`,
        [sportId, t.ext, t.name, t.nameEl, t.short, t.short, t.flag],
      );
      teamIds[t.key] = result.rows[0].id;
    }

    const match = await client.query<{ id: string }>(
      `INSERT INTO matches (
         sport_id, competition_id, external_id, external_source,
         home_team_id, away_team_id, status, start_time, minute,
         home_score, away_score, period, last_synced_at
       ) VALUES (
         $1, $2, 'demo-gre-esp', 'seed',
         $3, $4, 'live', NOW() - INTERVAL '67 minutes', 67,
         1, 1, '2nd half', NOW()
       )
       ON CONFLICT (external_source, external_id) DO UPDATE SET
         status = 'live',
         minute = 67,
         home_score = 1,
         away_score = 1,
         last_synced_at = NOW()
       RETURNING id`,
      [sportId, competitionId, teamIds.greece, teamIds.spain],
    );
    const matchId = match.rows[0].id;

    const room = await client.query<{ id: string }>(
      `INSERT INTO match_rooms (match_id, status, member_count, active_count, message_count)
       VALUES ($1, 'open', 4, 0, 0)
       ON CONFLICT (match_id) DO UPDATE SET status = 'open'
       RETURNING id`,
      [matchId],
    );
    const roomId = room.rows[0].id;

    // Clear previous demo messages for idempotent re-seed of chat content
    await client.query(`DELETE FROM messages WHERE room_id = $1`, [roomId]);

    const demoMessages = [
      { user: "football_fan", content: "Πάμε Ελλάδαααα 🇬🇷" },
      { user: "bettor", content: "Ισοπαλία το βλέπω μέχρι τέλος." },
      { user: "demo_user", content: "ΤΙ ΕΠΑΙΞΑ ΠΑΛΙ ΡΕ ΜΑΛΑΚΑ 😂" },
      { user: "admin", content: "Καλώς ήρθατε στον Κουβά. Παίξτε fair." },
      { user: "football_fan", content: "Στο δεύτερο θα το πάρουμε." },
      { user: "bettor", content: "Ελλάδα να σκοράρει επόμενο — το έχω 🔥" },
    ];

    for (const msg of demoMessages) {
      await client.query(
        `INSERT INTO messages (room_id, user_id, content, message_type)
         VALUES ($1, $2, $3, 'user')`,
        [roomId, userIds[msg.user], msg.content],
      );
    }

    // System goal event message
    await client.query(
      `INSERT INTO messages (room_id, user_id, content, message_type)
       VALUES ($1, NULL, $2, 'goal')`,
      [roomId, "⚽ GOAL — Ελλάδα 1 - 1 Ισπανία · 34'"],
    );

    await client.query(
      `UPDATE match_rooms SET message_count = (
         SELECT COUNT(*) FROM messages WHERE room_id = $1 AND deleted_at IS NULL
       ) WHERE id = $1`,
      [roomId],
    );

    // Demo match events
    await client.query(`DELETE FROM match_events WHERE match_id = $1`, [matchId]);
    await client.query(
      `INSERT INTO match_events (match_id, event_type, minute, team_side, player_name, description)
       VALUES
         ($1, 'goal', 34, 'home', 'Demo Player', 'Goal Greece'),
         ($1, 'goal', 51, 'away', 'Demo Away', 'Goal Spain'),
         ($1, 'yellow_card', 62, 'away', 'Demo Away', 'Yellow card')`,
      [matchId],
    );

    // Demo posts
    await client.query(`DELETE FROM posts WHERE user_id = ANY($1::uuid[])`, [
      Object.values(userIds),
    ]);

    await client.query(
      `INSERT INTO posts (user_id, post_type, content, match_id)
       VALUES
         ($1, 'MATCH', 'Στο δεύτερο ημίχρονο θα το πάρουμε.', $4),
         ($2, 'TEXT', 'Βλέπεις τον αγώνα. Μπες στη συζήτηση. ΣΤΟΝ ΚΟΥΒΑ!', NULL),
         ($3, 'TEXT', 'Όχι bookmaker — μόνο κουβέντα, προβλέψεις και αντιδράσεις 🪣', NULL)`,
      [userIds.football_fan, userIds.demo_user, userIds.bettor, matchId],
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
    console.log("Demo users: admin, demo_user, football_fan, bettor");
    console.log("Password: password123");
    console.log(`Demo match id: ${matchId}`);
    console.log(`Demo room id: ${roomId}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
