import { createDatabasePool } from "../db/pool.js";
import { HttpError } from "../errors/http-error.js";

export interface VehicleSearchFilters {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

interface VehicleRecord extends Omit<Vehicle, "price"> {
  price: string | number;
}

const database = createDatabasePool(
  process.env.NODE_ENV === "test" ? "test" : "development",
);

export async function createVehicle(
  vehicle: Omit<Vehicle, "id">,
): Promise<Vehicle> {
  const result = await database.query<VehicleRecord>(
    `INSERT INTO vehicles (make, model, category, price, quantity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, make, model, category, price, quantity`,
    [vehicle.make, vehicle.model, vehicle.category, vehicle.price, vehicle.quantity],
  );
  return toPublicVehicle(result.rows[0]);
}

export async function updateVehicle(
  id: string,
  vehicle: Pick<Vehicle, "make" | "model" | "category" | "price">,
): Promise<Vehicle | null> {
  const result = await database.query<VehicleRecord>(
    `UPDATE vehicles
     SET make = $2, model = $3, category = $4, price = $5, updated_at = now()
     WHERE id = $1
     RETURNING id, make, model, category, price, quantity`,
    [id, vehicle.make, vehicle.model, vehicle.category, vehicle.price],
  );
  const row = result.rows[0];
  return row ? toPublicVehicle(row) : null;
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const result = await database.query<{ id: string }>(
    "DELETE FROM vehicles WHERE id = $1 RETURNING id",
    [id],
  );
  return result.rows.length > 0;
}

export async function restockVehicle(
  id: string,
  quantity: number,
): Promise<Vehicle | null> {
  const result = await database.query<VehicleRecord>(
    `UPDATE vehicles
     SET quantity = quantity + $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, make, model, category, price, quantity`,
    [id, quantity],
  );
  const vehicle = result.rows[0];
  return vehicle ? toPublicVehicle(vehicle) : null;
}

export async function purchaseVehicle(
  vehicleId: string,
  userId: string,
): Promise<{
  purchase: {
    id: string;
    userId: string;
    vehicleId: string;
    vehicleMake: string;
    vehicleModel: string;
    priceSnapshot: number;
  };
  vehicle: Vehicle;
}> {
  const client = await database.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const updateResult = await client.query<VehicleRecord>(
      `UPDATE vehicles
       SET quantity = quantity - 1, updated_at = NOW()
       WHERE id = $1 AND quantity > 0
       RETURNING id, make, model, category, price, quantity`,
      [vehicleId],
    );
    const vehicle = updateResult.rows[0];

    if (!vehicle) {
      const existingVehicle = await client.query<{ id: string }>(
        "SELECT id FROM vehicles WHERE id = $1",
        [vehicleId],
      );
      throw existingVehicle.rows.length > 0
        ? new HttpError(409, "OUT_OF_STOCK", "Vehicle is out of stock.")
        : new HttpError(404, "NOT_FOUND", "Vehicle was not found.");
    }

    const purchaseResult = await client.query<{
      id: string;
      user_id: string;
      vehicle_id: string;
      vehicle_make: string;
      vehicle_model: string;
      price_snapshot: string | number;
    }>(
      `INSERT INTO purchases (
         user_id, vehicle_id, vehicle_make, vehicle_model, price_snapshot
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, vehicle_id, vehicle_make, vehicle_model, price_snapshot`,
      [userId, vehicleId, vehicle.make, vehicle.model, vehicle.price],
    );
    const purchase = purchaseResult.rows[0];
    if (!purchase) {
      throw new Error("Purchase insert did not return a record");
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      purchase: {
        id: purchase.id,
        userId: purchase.user_id,
        vehicleId: purchase.vehicle_id,
        vehicleMake: purchase.vehicle_make,
        vehicleModel: purchase.vehicle_model,
        priceSnapshot: Number(purchase.price_snapshot),
      },
      vehicle: toPublicVehicle(vehicle),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Purchase failed and its database transaction could not be rolled back",
        );
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listVehicles(
  filters: VehicleSearchFilters = {},
): Promise<Vehicle[]> {
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  for (const field of ["make", "model", "category"] as const) {
    const value = filters[field];
    if (value !== undefined) {
      values.push(value.toLowerCase());
      conditions.push(`lower(${field}) = $${values.length}`);
    }
  }

  if (filters.minPrice !== undefined) {
    values.push(filters.minPrice);
    conditions.push(`price >= $${values.length}`);
  }
  if (filters.maxPrice !== undefined) {
    values.push(filters.maxPrice);
    conditions.push(`price <= $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await database.query<VehicleRecord>(
    `SELECT id, make, model, category, price, quantity
     FROM vehicles
     ${whereClause}
     ORDER BY lower(make), lower(model), id`,
    values,
  );

  return result.rows.map(toPublicVehicle);
}

function toPublicVehicle(vehicle: VehicleRecord): Vehicle {
  return { ...vehicle, price: Number(vehicle.price) };
}
