import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http-error.js";
import { requireRole } from "../middleware/authentication.js";
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  type VehicleSearchFilters,
  updateVehicle,
} from "../services/vehicle-query.service.js";

const priceSchema = z
  .number()
  .finite()
  .min(0)
  .max(9_999_999_999.99)
  .refine((price) => Math.round(price * 100) === price * 100);

const createVehicleSchema = z.object({
  make: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  price: priceSchema,
  quantity: z.number().int().nonnegative(),
});

const updateVehicleSchema = createVehicleSchema
  .omit({ quantity: true })
  .strip();

const vehicleIdSchema = z.string().uuid();

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

router.post("/", requireRole("ADMIN"), async (request, response) => {
  const parsed = createVehicleSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Vehicle make, model, category, nonnegative price, and nonnegative integer quantity are required.",
    );
  }

  const vehicle = await createVehicle(parsed.data);
  response.status(201).json({ vehicle });
});

router.put("/:id", requireRole("ADMIN"), async (request, response) => {
  const parsedId = vehicleIdSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Vehicle ID must be a UUID.");
  }

  const parsedVehicle = updateVehicleSchema.safeParse(request.body);
  if (!parsedVehicle.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Vehicle make, model, category, and nonnegative price are required.",
    );
  }

  const vehicle = await updateVehicle(parsedId.data, parsedVehicle.data);
  if (!vehicle) {
    throw new HttpError(404, "NOT_FOUND", "Vehicle was not found.");
  }
  response.status(200).json({ vehicle });
});

router.delete("/:id", requireRole("ADMIN"), async (request, response) => {
  const parsedId = vehicleIdSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Vehicle ID must be a UUID.");
  }

  const deleted = await deleteVehicle(parsedId.data);
  if (!deleted) {
    throw new HttpError(404, "NOT_FOUND", "Vehicle was not found.");
  }
  response.status(200).json({ message: "Vehicle deleted successfully." });
});

export default router;
