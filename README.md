# ΣΤΟΝ ΚΟΥΒΑ!

Live sports social web app — βλέπεις τον αγώνα, μπαίνεις στη συζήτηση.

**Δεν είμαστε bookmaker.** Δεν υπάρχουν deposits, wallets, ή τοποθέτηση στοιχημάτων. Οι προβλέψεις είναι social content.

## Requirements

- Node.js 20+
- PostgreSQL 14+ (τοπικό ή δικός σου server)
- npm

Δεν χρειάζεται Supabase, Firebase, ή άλλο BaaS.

## 1. PostgreSQL setup

```bash
# παράδειγμα τοπικά
sudo -u postgres createuser -s stonkouva
sudo -u postgres psql -c "ALTER USER stonkouva WITH PASSWORD 'stonkouva_dev';"
sudo -u postgres createdb -O stonkouva stonkouva
```

## 2. Environment variables

```bash
cp .env.example .env
```

Συμπλήρωσε:

```env
DATABASE_URL=postgresql://stonkouva:stonkouva_dev@localhost:5432/stonkouva
SESSION_SECRET=change-me-to-a-long-random-secret
APP_URL=http://localhost:3000
SOFASCORE_BASE_URL=https://api.sofascore.com/api/v1
NODE_ENV=development
```

## 3. Install

```bash
npm install
```

## 4. Migrations

```bash
npm run db:migrate
```

SQL αρχεία: `database/migrations/`

- `001_initial_schema.sql`
- `002_indexes.sql`
- `003_constraints.sql`
- `004_seed_data.sql` (marker — πλήρες seed μέσω script)

Πλήρες schema reference: `database/schema.sql`

## 5. Seed (development)

```bash
npm run db:seed
```

Demo users (password: `password123`):

- `admin`
- `demo_user`
- `football_fan`
- `bettor`

Demo live match: Ελλάδα vs Ισπανία 1-1 (67').

## 6. Database reset (development only)

```bash
NODE_ENV=development CONFIRM_DB_RESET=YES npm run db:reset
```

Αρνείται να τρέξει αν `NODE_ENV !== development` ή λείπει `CONFIRM_DB_RESET=YES`.

## 7. Development

```bash
npm run dev
```

Άνοιξε [http://localhost:3000](http://localhost:3000).

## 8. Production

```bash
npm run build
npm run start
```

Χρησιμοποίησε ισχυρό `SESSION_SECRET`, `NODE_ENV=production`, και HTTPS (secure cookies).

## 8b. Vercel deploy (διόρθωση 404)

Αν το `https://ston-kouva.vercel.app` δείχνει **404: NOT_FOUND** από τη Vercel (όχι από την εφαρμογή), το production domain δεν είναι συνδεδεμένο ή το Deployment Protection μπλοκάρει το κοινό.

### Βήματα στο Vercel Dashboard

1. Άνοιξε [Project → ston-kouva](https://vercel.com/codesgreeces-projects/ston-kouva)
2. **Settings → Domains**
   - Πρόσθεσε / επιβεβαίωσε: `ston-kouva.vercel.app`
   - Production branch: `main`
3. **Settings → Deployment Protection**
   - Για Production: **Disabled** (ή Standard Protection off)
   - Αλλιώς το site ζητάει Vercel login και φαίνεται «σπασμένο» σε κινητό
4. **Settings → Environment Variables** (Production):

```env
DATABASE_URL=postgresql://…   # δικός σου Postgres με δημόσιο host + SSL
SESSION_SECRET=long-random-secret
APP_URL=https://ston-kouva.vercel.app
SOFASCORE_BASE_URL=https://api.sofascore.com/api/v1
NODE_ENV=production
DATABASE_SSL=true
```

5. **Deployments → … → Redeploy** το τελευταίο production deployment από `main`
6. Τρέξε migrations στο production DB (από τοπικό μηχάνημα με το production `DATABASE_URL`):

```bash
DATABASE_URL='postgresql://…' npm run db:migrate
DATABASE_URL='postgresql://…' npm run db:seed   # μόνο αν θες demo data
```

> Το Vercel deployment URL τύπου `ston-kouva-xxxx-codesgreeces-projects.vercel.app` μπορεί να δουλεύει πίσω από SSO, ενώ το `ston-kouva.vercel.app` 404-άρει μέχρι να συνδεθεί το domain.

## 9. Realtime server

Το Phase 1 χρησιμοποιεί HTTP + refresh για chat. Η αρχιτεκτονική για production realtime (Phase 3):

- Ξεχωριστό WebSocket-compatible Node process
- Room subscriptions ανά match room
- Broadcast messages / reactions / match events
- Online presence από πραγματικά connections

**Όχι** Supabase Realtime / Firebase.

## 10. Sports data sync

```
SofaScore → Sports Worker → PostgreSQL → Our API → Users
```

- Browser **ποτέ** δεν χτυπάει SofaScore
- Adapter: `src/lib/sports/sofascore-client.ts`
- Internal models + `SofaScoreAdapter`
- Controlled polling ανά status (scheduled / live / finished)
- Αν η πηγή πέσει: cached DB data + «Τελευταία ενημέρωση πριν από X sec»
- Το chat συνεχίζει ανεξάρτητα

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run test` | Unit tests |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop + migrate + seed (dev only) |

## Phase roadmap

1. **Foundation** (τρέχον) — Next.js, Postgres, auth, layout, skeletons
2. **Sports** — SofaScore adapter, live sync, events
3. **Match Rooms** — realtime WebSocket chat
4. **Social** — feed, follows, profiles deep features
5. **Predictions** — votes, results, reputation
6. **Moderation** — reports, bans, admin
7. **Performance** — caching, pagination polish

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL + `pg` (SQL, χωρίς ORM/BaaS)
- Zod validation
- bcrypt password hashing
- HTTP-only session cookies
