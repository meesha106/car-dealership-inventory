import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
