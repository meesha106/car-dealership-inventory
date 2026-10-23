import dotenv from "dotenv";
import { z } from "zod";
import { createDatabasePool } from "./pool.js";
import { seedInitialAdmin } from "./admin-seed.js";

dotenv.config({ path: "../.env" });

const seedEnvironmentSchema = z.object({
  ADMIN_SEED_EMAIL: z.string().trim().email(),
  ADMIN_SEED_PASSWORD: z.string().min(12),
});

async function main(): Promise<void> {
  const seedEnvironment = seedEnvironmentSchema.parse(process.env);
  const pool = createDatabasePool("development");

  try {
    const id = await seedInitialAdmin(
      {
        query: (sql, values) => pool.query<{ id: string }>(sql, values),
      },
      seedEnvironment.ADMIN_SEED_EMAIL,
      seedEnvironment.ADMIN_SEED_PASSWORD,
    );
    console.log(`Initial ADMIN account is ready (id: ${id}).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Admin seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
