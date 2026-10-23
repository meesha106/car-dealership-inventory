import { randomUUID } from "node:crypto";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { app } from "./app.js";
import { createDatabasePool } from "./db/pool.js";

const database = createDatabasePool("test");
let fixtureLockClient: PoolClient | undefined;
const createdVehicleIds = new Set<string>();
const fixturePrefix = `vehicle-it-${randomUUID()}`;

interface VehicleFixture {
  id: string;
  make: string;
  model: string;
  category: string;
  price: string;
  quantity: number;
}

function getToken(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET must be configured for vehicle tests");
  }
  return sign(
    { role: "USER" },
    jwtSecret,
    { subject: randomUUID(), expiresIn: "1h" },
  );
}

async function addVehicle(
  make: string,
  model: string,
  category: string,
  price: number,
  quantity: number,
): Promise<VehicleFixture> {
  const result = await database.query<VehicleFixture>(
    `INSERT INTO vehicles (make, model, category, price, quantity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, make, model, category, price, quantity`,
    [make, model, category, price, quantity],
  );
  const vehicle = result.rows[0];
  if (!vehicle) {
    throw new Error("Vehicle integration fixture insert returned no row");
  }
  createdVehicleIds.add(vehicle.id);
  return vehicle;
}

async function addSearchFixtures(): Promise<VehicleFixture[]> {
  return Promise.all([
    addVehicle(`${fixturePrefix}-Honda`, "Civic", "Sedan", 20000, 2),
    addVehicle(`${fixturePrefix}-Honda`, "Accord", "Sedan", 30000, 0),
    addVehicle(`${fixturePrefix}-Toyota`, "Corolla", "Hatchback", 18000, 5),
  ]);
}

async function getVehicles(path: string) {
  return request(app).get(path).set("Authorization", `Bearer ${getToken()}`);
}

describe("vehicle listing and search HTTP integration", () => {
  beforeAll(async () => {
    fixtureLockClient = await database.connect();
    await fixtureLockClient.query("SELECT pg_advisory_lock(531995, 2)");
    await database.query("SELECT id FROM vehicles LIMIT 0");
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET must be configured for vehicle tests");
    }
    await database.query(
      "DELETE FROM vehicles WHERE make LIKE 'vehicle-it-%'",
    );
    const result = await database.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM vehicles",
    );
    if (result.rows[0]?.count !== "0") {
      throw new Error(
        "Vehicle listing integration tests require an empty test vehicles table",
      );
    }
  });

  afterEach(async () => {
    const ids = [...createdVehicleIds];
    if (ids.length > 0) {
      await database.query("DELETE FROM vehicles WHERE id = ANY($1::uuid[])", [
        ids,
      ]);
      createdVehicleIds.clear();
    }
  });

  afterAll(async () => {
    try {
      await database.query("DELETE FROM vehicles WHERE make LIKE 'vehicle-it-%'");
    } finally {
      if (fixtureLockClient) {
        try {
          await fixtureLockClient.query("SELECT pg_advisory_unlock(531995, 2)");
        } finally {
          fixtureLockClient.release();
        }
      }
      await database.end();
    }
  });

  it("requires a valid token to list vehicles", async () => {
    const missing = await request(app).get("/api/vehicles");
    const invalid = await request(app)
      .get("/api/vehicles")
      .set("Authorization", "Bearer invalid-token");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it("returns an empty list when the test vehicles table is empty", async () => {
    const response = await getVehicles("/api/vehicles");

    expect(response.status).toBe(200);
    expect(response.body.vehicles).toEqual([]);
  });

  it("lists vehicles with required fields and includes zero-stock vehicles", async () => {
    const first = await addVehicle(
      `${fixturePrefix}-Honda`,
      "Civic",
      "Sedan",
      20000,
      2,
    );
    const zeroStock = await addVehicle(
      `${fixturePrefix}-Honda`,
      "Accord",
      "Sedan",
      30000,
      0,
    );

    const response = await getVehicles("/api/vehicles");

    expect(response.status).toBe(200);
    expect(response.body.vehicles).toHaveLength(2);
    const listed = response.body.vehicles as Array<Record<string, unknown>>;
    for (const vehicle of listed) {
      expect(Object.keys(vehicle).sort()).toEqual(
        ["id", "make", "model", "category", "price", "quantity"].sort(),
      );
    }
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          make: first.make,
          model: first.model,
          category: first.category,
          quantity: 2,
        }),
        expect.objectContaining({
          id: zeroStock.id,
          make: zeroStock.make,
          model: zeroStock.model,
          category: zeroStock.category,
          quantity: 0,
        }),
      ]),
    );
    expect(listed.map((vehicle) => Number(vehicle.price))).toEqual(
      expect.arrayContaining([20000, 30000]),
    );
  });

  it("filters search results by make", async () => {
    const [honda, accord] = await addSearchFixtures();

    const response = await getVehicles(
      `/api/vehicles/search?make=${encodeURIComponent(`${fixturePrefix}-Honda`)}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual(expect.arrayContaining([honda.id, accord.id]));
    expect(response.body.vehicles).toHaveLength(2);
  });

  it("filters search results by model", async () => {
    const [, accord] = await addSearchFixtures();

    const response = await getVehicles("/api/vehicles/search?model=Accord");

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual([accord.id]);
  });

  it("filters search results by category", async () => {
    const [honda, accord] = await addSearchFixtures();

    const response = await getVehicles("/api/vehicles/search?category=Sedan");

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual(expect.arrayContaining([honda.id, accord.id]));
    expect(response.body.vehicles).toHaveLength(2);
  });

  it("filters search results by minimum price", async () => {
    const [honda, accord] = await addSearchFixtures();

    const response = await getVehicles("/api/vehicles/search?minPrice=20000");

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual(expect.arrayContaining([honda.id, accord.id]));
    expect(response.body.vehicles).toHaveLength(2);
  });

  it("filters search results by maximum price", async () => {
    const [honda, , toyota] = await addSearchFixtures();

    const response = await getVehicles("/api/vehicles/search?maxPrice=20000");

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual(expect.arrayContaining([honda.id, toyota.id]));
    expect(response.body.vehicles).toHaveLength(2);
  });

  it("applies multiple search filters together", async () => {
    const [, accord] = await addSearchFixtures();

    const response = await getVehicles(
      `/api/vehicles/search?make=${encodeURIComponent(`${fixturePrefix}-Honda`)}&category=Sedan&minPrice=25000&maxPrice=35000`,
    );

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual([accord.id]);
  });

  it("matches make, model, and category without case sensitivity", async () => {
    const [honda] = await addSearchFixtures();

    const response = await getVehicles(
      `/api/vehicles/search?make=${encodeURIComponent(`${fixturePrefix}-hONdA`)}&model=cIvIc&category=sEdAn`,
    );

    expect(response.status).toBe(200);
    expect(response.body.vehicles.map((vehicle: VehicleFixture) => vehicle.id))
      .toEqual([honda.id]);
  });

  it.each([
    ["minPrice", "not-a-price"],
    ["maxPrice", "-1"],
  ])("rejects invalid %s values", async (parameter, value) => {
    const response = await getVehicles(
      `/api/vehicles/search?${parameter}=${value}`,
    );

    expect(response.status).toBe(400);
  });

  it("rejects a minimum price greater than the maximum price", async () => {
    const response = await getVehicles(
      "/api/vehicles/search?minPrice=30000&maxPrice=20000",
    );

    expect(response.status).toBe(400);
  });
});
