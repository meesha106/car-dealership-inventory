import { describe, expect, it } from "vitest";
import { getPendingMigrations, type Migration } from "./migrations.js";

const migrations: Migration[] = [
  {
    version: "002",
    name: "add_vehicles",
    checksum: "checksum-2",
    sql: "SELECT 2;",
  },
  {
    version: "001",
    name: "create_users",
    checksum: "checksum-1",
    sql: "SELECT 1;",
  },
];

describe("getPendingMigrations", () => {
  it("returns unapplied migrations in version order", () => {
    expect(
      getPendingMigrations(migrations, [
        { version: "001", name: "create_users", checksum: "checksum-1" },
      ]),
    ).toEqual([migrations[0]]);
  });

  it("rejects changed contents for an already applied migration", () => {
    expect(() =>
      getPendingMigrations(migrations, [
        { version: "001", name: "create_users", checksum: "changed" },
      ]),
    ).toThrow(/checksum/i);
  });
});
