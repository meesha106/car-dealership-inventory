import { createDatabasePool } from "../db/pool.js";

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
