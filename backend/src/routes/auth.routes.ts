import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http-error.js";
import { loginUser, registerUser } from "../services/auth.service.js";

const credentialsSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(12),
});

function parseCredentials(body: unknown) {
  const credentials = credentialsSchema.safeParse(body);
  if (!credentials.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "A valid email and password are required.");
  }
  return credentials.data;
}

const router = Router();

router.post("/register", async (request, response) => {
  const credentials = parseCredentials(request.body);
  const result = await registerUser(credentials.email, credentials.password);
  response.status(201).json(result);
});

router.post("/login", async (request, response) => {
  const credentials = parseCredentials(request.body);
  const result = await loginUser(credentials.email, credentials.password);
  response.status(200).json(result);
});

export default router;
