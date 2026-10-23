import { resolve } from "node:path";
import "../config/env.js";
import { createDatabasePool, type DatabaseTarget } from "./pool.js";
import { applyMigrations } from "./migrations.js";

async function main(): Promise<void> {
  const target = process.argv[2] ?? "development";
  if (target !== "development" && target !== "test") {
    throw new Error("Migration target must be 'development' or 'test'");
  }

  const pool = createDatabasePool(target as DatabaseTarget);
  try {
    const applied = await applyMigrations(
      pool,
      resolve(process.cwd(), "migrations"),
    );
    if (applied.length === 0) {
      console.log(`Database schema is up to date (${target}).`);
    } else {
      for (const version of applied) {
        console.log(`Applied migration ${version} (${target}).`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Database migration failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
