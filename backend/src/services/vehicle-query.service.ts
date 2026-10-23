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

  return result.rows.map((vehicle) => ({
    ...vehicle,
    price: Number(vehicle.price),
  }));
}
