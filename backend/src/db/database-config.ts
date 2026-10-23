import { z } from "zod";

export type DatabaseTarget = "development" | "test";

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "must use a PostgreSQL connection URL",
  );

function databaseIdentity(value: string): string {
  const url = new URL(value);
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return `${url.hostname.toLowerCase()}:${port}/${database}`;
}

export function getDatabaseUrl(
  target: DatabaseTarget,
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  if (!source.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  const developmentUrl = databaseUrlSchema.parse(source.DATABASE_URL);

  if (target === "development") {
    if (source.TEST_DATABASE_URL) {
      const testUrl = databaseUrlSchema.parse(source.TEST_DATABASE_URL);
      if (databaseIdentity(testUrl) === databaseIdentity(developmentUrl)) {
        throw new Error("TEST_DATABASE_URL must be different from DATABASE_URL");
      }
    }
    return developmentUrl;
  }

  if (!source.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required for test database operations");
  }
  const testUrl = databaseUrlSchema.parse(source.TEST_DATABASE_URL);
  if (databaseIdentity(testUrl) === databaseIdentity(developmentUrl)) {
      throw new Error("TEST_DATABASE_URL must be different from DATABASE_URL");
  }

  return testUrl;
}
