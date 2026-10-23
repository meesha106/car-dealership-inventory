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
const adminId = randomUUID();
const userId = randomUUID();
const fixturePrefix = `vehicle-admin-it-${randomUUID()}`;

function tokenFor(role: "USER" | "ADMIN", subject: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be configured for vehicle tests");
  }
  return sign({ role }, secret, { subject, expiresIn: "1h" });
}

const adminToken = tokenFor("ADMIN", adminId);
const userToken = tokenFor("USER", userId);

function validVehicle(overrides: Record<string, unknown> = {}) {
  return {
    make: `${fixturePrefix}-Honda`,
    model: "Civic",
    category: "Sedan",
    price: 24500,
    quantity: 4,
    ...overrides,
  };
}

async function createVehicle(
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request(app)
    .post("/api/vehicles")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(validVehicle(overrides));
  expect(response.status).toBe(201);
  createdVehicleIds.add(response.body.vehicle.id);
  return response.body.vehicle as Record<string, unknown>;
}

describe("admin vehicle management HTTP integration", () => {
  beforeAll(async () => {
    fixtureLockClient = await database.connect();
    await fixtureLockClient.query("SELECT pg_advisory_lock(531995, 2)");
    await database.query("SELECT id FROM vehicles LIMIT 0");
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
      const ids = [...createdVehicleIds];
      if (ids.length > 0) {
        await database.query("DELETE FROM vehicles WHERE id = ANY($1::uuid[])", [
          ids,
        ]);
        createdVehicleIds.clear();
      }
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

  it("allows an ADMIN to add a vehicle", async () => {
    const response = await request(app)
      .post("/api/vehicles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validVehicle());

    expect(response.status).toBe(201);
    expect(response.body.vehicle).toMatchObject({
      make: `${fixturePrefix}-Honda`,
      model: "Civic",
      category: "Sedan",
      price: 24500,
      quantity: 4,
    });
    expect(response.body.vehicle.id).toEqual(expect.any(String));
    createdVehicleIds.add(response.body.vehicle.id);
  });

  it("generates a unique ID for each valid vehicle", async () => {
    const first = await createVehicle();
    const second = await createVehicle({ model: "Accord" });

    expect(first.id).not.toBe(second.id);
  });

  it("allows an ADMIN to update make, model, category, and price", async () => {
    const vehicle = await createVehicle();
    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        make: `${fixturePrefix}-Toyota`,
        model: "Camry",
        category: "Wagon",
        price: 31999.5,
      });

    expect(response.status).toBe(200);
    expect(response.body.vehicle).toMatchObject({
      id: vehicle.id,
      make: `${fixturePrefix}-Toyota`,
      model: "Camry",
      category: "Wagon",
      price: 31999.5,
      quantity: 4,
    });
  });

  it("does not allow vehicle updates to modify quantity", async () => {
    const vehicle = await createVehicle({ quantity: 9 });
    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        make: vehicle.make,
        model: vehicle.model,
        category: vehicle.category,
        price: vehicle.price,
        quantity: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.vehicle.quantity).toBe(9);
  });

  it("allows an ADMIN to delete a vehicle and removes it from listings", async () => {
    const vehicle = await createVehicle();
    const deleted = await request(app)
      .delete(`/api/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleted.status).toBe(200);
    expect(deleted.body).toMatchObject({
      message: "Vehicle deleted successfully.",
    });
    createdVehicleIds.delete(vehicle.id as string);

    const listed = await request(app)
      .get("/api/vehicles")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listed.body.vehicles).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vehicle.id })]),
    );
  });

  it.each([
    ["POST", "/api/vehicles"],
    ["PUT", "/api/vehicles/00000000-0000-4000-8000-000000000001"],
    ["DELETE", "/api/vehicles/00000000-0000-4000-8000-000000000001"],
  ])("returns 403 when a USER attempts %s %s", async (method, path) => {
    const response =
      method === "POST"
        ? await request(app)
            .post(path)
            .set("Authorization", `Bearer ${userToken}`)
            .send(validVehicle())
        : method === "PUT"
          ? await request(app)
              .put(path)
              .set("Authorization", `Bearer ${userToken}`)
              .send(validVehicle())
          : await request(app)
              .delete(path)
              .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);
  });

  it.each([
    ["POST", "/api/vehicles"],
    ["PUT", "/api/vehicles/00000000-0000-4000-8000-000000000001"],
    ["DELETE", "/api/vehicles/00000000-0000-4000-8000-000000000001"],
  ])("returns 401 for missing or invalid token on %s %s", async (method, path) => {
    for (const authorization of [undefined, "Bearer invalid-token"]) {
      let req =
        method === "POST"
          ? request(app).post(path).send(validVehicle())
          : method === "PUT"
            ? request(app).put(path).send(validVehicle())
            : request(app).delete(path);
      if (authorization) {
        req = req.set("Authorization", authorization);
      }
      const response = await req;
      expect(response.status).toBe(401);
    }
  });

  it.each([
    [{ make: undefined }, "missing make"],
    [{ model: undefined }, "missing model"],
    [{ category: undefined }, "missing category"],
    [{ price: undefined }, "missing price"],
    [{ quantity: undefined }, "missing quantity"],
    [{ make: "" }, "empty make"],
    [{ price: -0.01 }, "negative price"],
    [{ quantity: -1 }, "negative quantity"],
    [{ quantity: 1.5 }, "decimal quantity"],
  ])("rejects invalid vehicle data (%s)", async (overrides) => {
    const response = await request(app)
      .post("/api/vehicles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validVehicle(overrides));

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed vehicle IDs", async () => {
    const updated = await request(app)
      .put("/api/vehicles/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validVehicle());
    const deleted = await request(app)
      .delete("/api/vehicles/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(updated.status).toBe(400);
    expect(deleted.status).toBe(400);
  });

  it("returns 404 for an unknown vehicle ID", async () => {
    const unknownId = randomUUID();
    const updated = await request(app)
      .put(`/api/vehicles/${unknownId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validVehicle());
    const deleted = await request(app)
      .delete(`/api/vehicles/${unknownId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(updated.status).toBe(404);
    expect(deleted.status).toBe(404);
  });
});
