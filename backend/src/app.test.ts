import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("GET /health", () => {
  it("returns a healthy status", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });
});
