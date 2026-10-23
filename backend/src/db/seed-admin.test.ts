import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";
import { seedInitialAdmin } from "./admin-seed.js";

describe("seedInitialAdmin", () => {
  it("normalizes the email and upserts an ADMIN with a hashed password", async () => {
    const query = vi.fn(async (_sql: string, _values: unknown[]) => ({
      rows: [{ id: "admin-id" }],
    }));

    await seedInitialAdmin(
      { query },
      "  ADMIN@EXAMPLE.COM ",
      "a-long-local-admin-password",
    );

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toMatch(/ON CONFLICT \(email\) DO UPDATE/i);
    expect(query.mock.calls[0][1][0]).toBe("admin@example.com");
    expect(query.mock.calls[0][1][2]).toBe("ADMIN");
    expect(
      await argon2.verify(
        query.mock.calls[0][1][1] as string,
        "a-long-local-admin-password",
      ),
    ).toBe(true);
  });
});
