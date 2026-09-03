import path from "path";
import { config } from "dotenv";
import pg from "pg";
import { spawnSync } from "child_process";

// Capture shell NODE_ENV before dotenv (safety-critical)
const shellNodeEnv = process.env.NODE_ENV;

config({ path: path.resolve(process.cwd(), ".env"), override: false });

/**
 * DANGEROUS: drops and recreates public schema.
 * Only allowed when NODE_ENV=development.
 */
async function main() {
  const nodeEnv = shellNodeEnv || process.env.NODE_ENV;
  if (nodeEnv !== "development") {
    console.error(
      "db:reset refused — NODE_ENV must be 'development' (got: " +
        String(nodeEnv) +
        ")",
    );
    process.exit(1);
  }

  const confirm = process.env.CONFIRM_DB_RESET;
  if (confirm !== "YES") {
    console.error(
      "db:reset refused — set CONFIRM_DB_RESET=YES to proceed in development.",
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log("Dropping public schema...");
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO PUBLIC");
    console.log("Schema recreated.");
  } finally {
    await client.end();
  }

  const migrate = spawnSync("npx", ["tsx", "scripts/migrate.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);

  const seed = spawnSync("npx", ["tsx", "scripts/seed.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seed.status !== 0) process.exit(seed.status ?? 1);

  console.log("Database reset complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
