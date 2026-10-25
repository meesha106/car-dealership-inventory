import { randomUUID } from "node:crypto";
import { sign } from "jsonwebtoken";
import request from "supertest";
import type { PoolClient } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { app } from "./app.js";
import { createDatabasePool } from "./db/pool.js";

const database = createDatabasePool("test");
const fixturePrefix = `restock-it-${randomUUID()}`;
const createdVehicleIds = new Set<string>();
let lockClient: PoolClient | undefined;
let adminToken: string;
let userToken: string;

async function addVehicle(quantity: number) {
  const result = await database.query<{
    id: string;
    make: string;
    quantity: number;
  }>(
    `INSERT INTO vehicles (make, model, category, price, quantity)
     VALUES ($1, 'Civic', 'Sedan', 21000, $2)
     RETURNING id, make, quantity`,
    [`${fixturePrefix}-Honda`, quantity],
  );
  const vehicle = result.rows[0];
  if (!vehicle) {
    throw new Error("Restock integration fixture insert returned no row");
  }
  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

function restock(vehicleId: string, quantity?: unknown, token = adminToken) {
  const req = request(app)
    .post(`/api/vehicles/${vehicleId}/restock`)
    .send(quantity === undefined ? {} : { quantity });
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

describe("vehicle restock HTTP integration", () => {
  beforeAll(async () => {
    lockClient = await database.connect();
    await lockClient.query("SELECT pg_advisory_lock(531995, 2)");
    await database.query("SELECT id FROM vehicles LIMIT 0");
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET must be configured for restock tests");
    }
    adminToken = sign({ role: "ADMIN" }, secret, {
      subject: randomUUID(),
      expiresIn: "1h",
    });
    userToken = sign({ role: "USER" }, secret, {
      subject: randomUUID(),
      expiresIn: "1h",
    });
  });

  afterEach(async () => {
    const vehicleIds = [...createdVehicleIds];
    if (vehicleIds.length > 0) {
      await database.query("DELETE FROM vehicles WHERE id = ANY($1::uuid[])", [
        vehicleIds,
      ]);
      createdVehicleIds.clear();
    }
  });

  afterAll(async () => {
    try {
      await database.query("DELETE FROM vehicles WHERE make LIKE 'restock-it-%'");
    } finally {
      try {
        if (lockClient) {
          await lockClient.query("SELECT pg_advisory_unlock(531995, 2)");
          lockClient.release();
        }
      } finally {
        await database.end();
      }
    }
  });

  it("allows an ADMIN to restock by the specified amount", async () => {
    const vehicle = await addVehicle(3);

    const response = await restock(vehicle.id, 5);

    expect(response.status).toBe(200);
    expect(response.body.vehicle).toMatchObject({
      id: vehicle.id,
      quantity: 8,
    });
  });

  it("persists restocked quantity for a fresh database read", async () => {
    const vehicle = await addVehicle(2);
    const response = await restock(vehicle.id, 4);

    expect(response.status).toBe(200);
    const freshPool = createDatabasePool("test");
    try {
      const result = await freshPool.query<{ quantity: number }>(
        "SELECT quantity FROM vehicles WHERE id = $1",
        [vehicle.id],
      );
      expect(result.rows[0]?.quantity).toBe(6);
    } finally {
      await freshPool.end();
    }
  });

  it("returns 403 when a USER attempts to restock", async () => {
    const vehicle = await addVehicle(2);

    const response = await restock(vehicle.id, 3, userToken);

    expect(response.status).toBe(403);
  });

  it("returns 401 when the request has no token", async () => {
    const vehicle = await addVehicle(2);

    const response = await restock(vehicle.id, 3, "");

    expect(response.status).toBe(401);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["decimal", 1.5],
    ["string", "3"],
    ["missing", undefined],
  ])("rejects %s restock quantity with 400", async (_kind, quantity) => {
    const vehicle = await addVehicle(2);

    const response = await restock(vehicle.id, quantity);

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown vehicle", async () => {
    const response = await restock(randomUUID(), 2);

    expect(response.status).toBe(404);
  });

  it("applies concurrent restocks without losing increments", async () => {
    const vehicle = await addVehicle(1);

    const responses = await Promise.all([
      restock(vehicle.id, 4),
      restock(vehicle.id, 7),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const result = await database.query<{ quantity: number }>(
      "SELECT quantity FROM vehicles WHERE id = $1",
      [vehicle.id],
    );
    expect(result.rows[0]?.quantity).toBe(12);
  });
});
