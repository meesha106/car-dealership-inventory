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
const fixturePrefix = `purchase-it-${randomUUID()}`;
const userId = randomUUID();
const userEmail = `${fixturePrefix}@example.test`;
const createdVehicleIds = new Set<string>();
let lockClient: PoolClient | undefined;
let token: string;

async function addVehicle(quantity: number, price = 27500) {
  const result = await database.query<{
    id: string;
    make: string;
    model: string;
    price: string;
    quantity: number;
  }>(
    `INSERT INTO vehicles (make, model, category, price, quantity)
     VALUES ($1, 'Accord', 'Sedan', $2, $3)
     RETURNING id, make, model, price, quantity`,
    [`${fixturePrefix}-Honda`, price, quantity],
  );
  const vehicle = result.rows[0];
  if (!vehicle) {
    throw new Error("Purchase integration fixture insert returned no row");
  }
  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

function purchaseVehicle(vehicleId: string, authorization = token) {
  const req = request(app).post(`/api/vehicles/${vehicleId}/purchase`);
  return authorization
    ? req.set("Authorization", `Bearer ${authorization}`)
    : req;
}

async function getPurchaseCount(vehicleId: string): Promise<number> {
  const result = await database.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM purchases WHERE vehicle_id = $1",
    [vehicleId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

describe("vehicle purchase HTTP integration", () => {
  beforeAll(async () => {
    lockClient = await database.connect();
    await lockClient.query("SELECT pg_advisory_lock(531995, 2)");
    await database.query("SELECT id FROM purchases LIMIT 0");
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET must be configured for purchase tests");
    }

    await database.query(
      `INSERT INTO users (id, email, password_hash, role)
       VALUES ($1, $2, 'integration-test-hash', 'USER')`,
      [userId, userEmail],
    );
    token = sign({ role: "USER" }, secret, {
      subject: userId,
      expiresIn: "1h",
    });
  });

  afterEach(async () => {
    const vehicleIds = [...createdVehicleIds];
    if (vehicleIds.length > 0) {
      await database.query(
        "DELETE FROM purchases WHERE vehicle_id = ANY($1::uuid[])",
        [vehicleIds],
      );
      await database.query("DELETE FROM vehicles WHERE id = ANY($1::uuid[])", [
        vehicleIds,
      ]);
      createdVehicleIds.clear();
    }
    await database.query("DELETE FROM purchases WHERE user_id = $1", [userId]);
  });

  afterAll(async () => {
    try {
      await database.query("DELETE FROM purchases WHERE user_id = $1", [userId]);
      await database.query("DELETE FROM users WHERE id = $1", [userId]);
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

  it("buys exactly one unit and records user and purchase snapshots", async () => {
    const vehicle = await addVehicle(3, 27500.5);

    const response = await purchaseVehicle(vehicle.id);

    expect(response.status).toBe(201);
    expect(response.body.vehicle).toMatchObject({
      id: vehicle.id,
      quantity: 2,
    });
    const updatedVehicle = await database.query<{ quantity: number }>(
      "SELECT quantity FROM vehicles WHERE id = $1",
      [vehicle.id],
    );
    expect(updatedVehicle.rows[0]?.quantity).toBe(2);

    const purchase = await database.query<{
      user_id: string;
      vehicle_id: string;
      vehicle_make: string;
      vehicle_model: string;
      price_snapshot: string;
    }>(
      `SELECT user_id, vehicle_id, vehicle_make, vehicle_model, price_snapshot
       FROM purchases
       WHERE vehicle_id = $1`,
      [vehicle.id],
    );
    expect(purchase.rows).toHaveLength(1);
    expect(purchase.rows[0]).toMatchObject({
      user_id: userId,
      vehicle_id: vehicle.id,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      price_snapshot: "27500.50",
    });
  });

  it("returns 409 for zero stock without creating a purchase", async () => {
    const vehicle = await addVehicle(0);

    const response = await purchaseVehicle(vehicle.id);

    expect(response.status).toBe(409);
    expect(await getPurchaseCount(vehicle.id)).toBe(0);
  });

  it("returns 404 for an unknown vehicle", async () => {
    const response = await purchaseVehicle(randomUUID());

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed vehicle ID", async () => {
    const response = await purchaseVehicle("not-a-uuid");

    expect(response.status).toBe(400);
  });

  it("returns 401 when the request has no token", async () => {
    const vehicle = await addVehicle(1);

    const response = await purchaseVehicle(vehicle.id, "");

    expect(response.status).toBe(401);
  });

  it("allows exactly one of two concurrent requests to buy the last unit", async () => {
    const vehicle = await addVehicle(1);

    const responses = await Promise.all([
      purchaseVehicle(vehicle.id),
      purchaseVehicle(vehicle.id),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201,
      409,
    ]);
    const remaining = await database.query<{ quantity: number }>(
      "SELECT quantity FROM vehicles WHERE id = $1",
      [vehicle.id],
    );
    expect(remaining.rows[0]?.quantity).toBe(0);
    expect(await getPurchaseCount(vehicle.id)).toBe(1);
  });

  it("rolls back stock decrement when purchase insertion fails", async () => {
    const vehicle = await addVehicle(2);
    await database.query(`
      CREATE OR REPLACE FUNCTION fail_test_purchase_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.vehicle_make LIKE 'purchase-it-%' THEN
          RAISE EXCEPTION 'intentional purchase integration failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await database.query(`
      CREATE TRIGGER fail_test_purchase_insert
      BEFORE INSERT ON purchases
      FOR EACH ROW EXECUTE FUNCTION fail_test_purchase_insert()
    `);

    try {
      const response = await purchaseVehicle(vehicle.id);

      expect(response.status).toBe(500);
      const current = await database.query<{ quantity: number }>(
        "SELECT quantity FROM vehicles WHERE id = $1",
        [vehicle.id],
      );
      expect(current.rows[0]?.quantity).toBe(2);
      expect(await getPurchaseCount(vehicle.id)).toBe(0);
    } finally {
      await database.query(
        "DROP TRIGGER IF EXISTS fail_test_purchase_insert ON purchases",
      );
      await database.query(
        "DROP FUNCTION IF EXISTS fail_test_purchase_insert()",
      );
    }
  });
});
