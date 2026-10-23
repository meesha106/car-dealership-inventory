import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

export interface Migration {
  version: string;
  name: string;
  checksum: string;
  sql: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
}

export interface MigrationClient {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
  release(): void;
}

export interface MigrationPool {
  connect(): Promise<MigrationClient>;
}

export function getPendingMigrations(
  migrations: Migration[],
  appliedMigrations: AppliedMigration[],
): Migration[] {
  const ordered = [...migrations].sort(
    (left, right) => Number(left.version) - Number(right.version),
  );

  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1].version === ordered[index].version) {
      throw new Error(`Duplicate migration version: ${ordered[index].version}`);
    }
  }

  const appliedByVersion = new Map(
    appliedMigrations.map((migration) => [migration.version, migration]),
  );
  const availableVersions = new Set(ordered.map((migration) => migration.version));

  for (const applied of appliedMigrations) {
    if (!availableVersions.has(applied.version)) {
      throw new Error(
        `Applied migration ${applied.version} is missing from the migrations directory`,
      );
    }
  }

  return ordered.filter((migration) => {
    const applied = appliedByVersion.get(migration.version);
    if (!applied) {
      return true;
    }
    if (applied.name !== migration.name || applied.checksum !== migration.checksum) {
      throw new Error(
        `Applied migration ${migration.version} name or checksum has changed; add a new migration instead`,
      );
    }
    return false;
  });
}

async function readMigrations(directory: string): Promise<Migration[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const match = /^(\d{3,})_([a-z0-9_]+)\.sql$/i.exec(filename);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }

      const sql = await readFile(resolve(directory, filename), "utf8");
      return {
        version: match[1],
        name: match[2],
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    }),
  );
}

export async function applyMigrations(
  pool: MigrationPool,
  directory = resolve(process.cwd(), "migrations"),
): Promise<string[]> {
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(531995, 1)");
    lockAcquired = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query<AppliedMigration>(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
    );
    const pending = getPendingMigrations(
      await readMigrations(directory),
      appliedResult.rows,
    );
    const appliedVersions: string[] = [];

    for (const migration of pending) {
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum)
           VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `Migration ${migration.version} failed and rollback also failed`,
          );
        }
        throw error;
      }
      appliedVersions.push(migration.version);
    }

    return appliedVersions;
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(531995, 1)");
      }
    } finally {
      client.release();
    }
  }
}
