import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __stonKouvaPgPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string): boolean {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  // Managed Postgres on Vercel/Neon/Railway/etc. usually requires TLS
  return (
    process.env.NODE_ENV === "production" ||
    /sslmode=require/i.test(connectionString) ||
    /\.neon\.tech|\.supabase\.co|\.render\.com|\.railway\.app|\.vercel-storage\.com/i.test(
      connectionString,
    )
  );
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

export function getPool(): Pool {
  if (!global.__stonKouvaPgPool) {
    global.__stonKouvaPgPool = createPool();
  }
  return global.__stonKouvaPgPool;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const started = Date.now();
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      latencyMs: 0,
      error: "DATABASE_URL is not set",
    };
  }
  try {
    await query("SELECT 1 AS ok");
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
