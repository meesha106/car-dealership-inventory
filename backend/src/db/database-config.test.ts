import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "./database-config.js";

const databaseEnvironment = {
  DATABASE_URL: "postgresql://app:secret@localhost:5432/dealership",
  TEST_DATABASE_URL: "postgresql://app:secret@localhost:5432/dealership_test",
};

describe("getDatabaseUrl", () => {
  it("uses the test database for test operations", () => {
    expect(getDatabaseUrl("test", databaseEnvironment)).toBe(
      databaseEnvironment.TEST_DATABASE_URL,
    );
  });

  it("rejects a test configuration that points at the development database", () => {
    expect(() =>
      getDatabaseUrl("test", {
        ...databaseEnvironment,
        TEST_DATABASE_URL: databaseEnvironment.DATABASE_URL,
      }),
    ).toThrow(/must be different/i);
  });

  it("requires a separate test database URL", () => {
    expect(() =>
      getDatabaseUrl("test", {
        DATABASE_URL: databaseEnvironment.DATABASE_URL,
      }),
    ).toThrow(/TEST_DATABASE_URL/i);
  });
});
