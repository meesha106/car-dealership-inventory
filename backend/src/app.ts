import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import vehicleRoutes from "./routes/vehicle.routes.js";
import { authenticate } from "./middleware/authentication.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", authenticate);
app.use("/api/vehicles", vehicleRoutes);

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);
