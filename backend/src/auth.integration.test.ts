import { randomUUID } from "node:crypto";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { createDatabasePool } from "./db/pool.js";

const database = createDatabasePool("test");
const createdEmails = new Set<string>();
const validPassword = "Correct-Horse-Battery-42!";

function uniqueEmail(): string {
  const email = `auth-it-${randomUUID()}@example.test`;
  createdEmails.add(email);
  return email;
}

function expectNoPasswordHash(responseBody: unknown): void {
  expect(JSON.stringify(responseBody)).not.toContain("password_hash");
}

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET must be configured for authentication tests");
  }
  return jwtSecret;
}

describe("authentication HTTP integration", () => {
  beforeAll(async () => {
    await database.query(
      "SELECT id FROM users LIMIT 0",
    );
    getJwtSecret();
  });

  afterEach(async () => {
    const emails = [...createdEmails];
    if (emails.length === 0) {
      return;
    }

    await database.query(
      `DELETE FROM purchases
       WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))`,
      [emails.map((email) => email.toLowerCase())],
    );
    await database.query("DELETE FROM users WHERE email = ANY($1::text[])", [
      emails.map((email) => email.toLowerCase()),
    ]);
    createdEmails.clear();
  });

  afterAll(async () => {
    await database.end();
  });

  it("registers a USER and returns a token without exposing the password hash", async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email, password: validPassword });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      email,
      role: "USER",
    });
    expectNoPasswordHash(response.body);

    const databaseResult = await database.query(
      "SELECT role, password_hash FROM users WHERE email = $1",
      [email],
    );
    expect(databaseResult.rows).toHaveLength(1);
    expect(databaseResult.rows[0].role).toBe("USER");
    expect(databaseResult.rows[0].password_hash).not.toBe(validPassword);
  });

  it("rejects duplicate emails regardless of case", async () => {
    const email = uniqueEmail();
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email, password: validPassword });
    const duplicate = await request(app)
      .post("/api/auth/register")
      .send({ email: email.toUpperCase(), password: validPassword });

    expect(registered.status).toBe(201);
    expect(duplicate.status).toBe(409);
  });

  it("rejects an invalid email address", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: validPassword });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: uniqueEmail(), password: "short" });

    expect(response.status).toBe(400);
  });

  it("does not allow registration to create an ADMIN", async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email, password: validPassword, role: "ADMIN" });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("USER");
    expectNoPasswordHash(response.body);

    const databaseResult = await database.query(
      "SELECT role FROM users WHERE email = $1",
      [email],
    );
    expect(databaseResult.rows[0]?.role).toBe("USER");
  });

  it("logs in with valid credentials and does not expose the password hash", async () => {
    const email = uniqueEmail();
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email, password: validPassword });
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: validPassword });

    expect(registered.status).toBe(201);
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expectNoPasswordHash(response.body);
  });

  it("rejects login with an unknown email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: validPassword });

    expect(response.status).toBe(401);
  });

  it("rejects login with the wrong password", async () => {
    const email = uniqueEmail();
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: validPassword });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Not-the-correct-Password-42!" });

    expect(response.status).toBe(401);
  });

  it("rejects a protected request without a token", async () => {
    const response = await request(app).get("/api/vehicles");

    expect(response.status).toBe(401);
  });

  it("rejects a protected request with an invalid token", async () => {
    const response = await request(app)
      .get("/api/vehicles")
      .set("Authorization", "Bearer not-a-valid-token");

    expect(response.status).toBe(401);
  });

  it("rejects a protected request with an expired token", async () => {
    const expiredToken = sign(
      { sub: randomUUID() },
      getJwtSecret(),
      { expiresIn: "-1s" },
    );
    const response = await request(app)
      .get("/api/vehicles")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });
});
