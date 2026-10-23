import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http-error.js";
import {
  listVehicles,
  type VehicleSearchFilters,
} from "../services/vehicle-query.service.js";

const priceQuerySchema = z
  .string()
  .regex(/^(?:\d+\.?\d*|\.\d+)$/, "Must be a nonnegative price")
  .transform(Number)
  .pipe(z.number().finite().nonnegative())
  .optional();

const searchQuerySchema = z.object({
  make: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  minPrice: priceQuerySchema,
  maxPrice: priceQuerySchema,
});

function parseSearchFilters(query: unknown): VehicleSearchFilters {
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Search filters must contain valid text and nonnegative prices.",
    );
  }

  const { minPrice, maxPrice } = parsed.data;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "minPrice must not be greater than maxPrice.",
    );
  }

  return parsed.data;
}

const router = Router();

router.get("/search", async (request, response) => {
  const filters = parseSearchFilters(request.query);
  const vehicles = await listVehicles(filters);
  response.status(200).json({ vehicles });
});

router.get("/", async (_request, response) => {
  const vehicles = await listVehicles();
  response.status(200).json({ vehicles });
});

export default router;
