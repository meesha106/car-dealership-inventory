import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("dealership application", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows login and registration forms and links between them", async () => {
    const user = userEvent.setup();
    renderAt("/login");

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /create an account/i }));
    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("registers a customer, saves the session, and loads real inventory through the API client", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(201, {
          token: "registration-token",
          user: {
            id: "customer-1",
            email: "customer@example.test",
            role: "USER",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          vehicles: [
            {
              id: "vehicle-1",
              make: "Honda",
              model: "Civic",
              category: "Sedan",
              price: 24500,
              quantity: 2,
            },
            {
              id: "vehicle-2",
              make: "Toyota",
              model: "Prius",
              category: "Hybrid",
              price: 31000,
              quantity: 0,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/register");

    await user.type(screen.getByLabelText(/email address/i), "customer@example.test");
    await user.type(
      screen.getByLabelText(/^password$/i),
      "a-safe-password-123",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByRole("heading", { name: /available inventory/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Honda Civic")).toBeInTheDocument();
    expect(screen.getByText("Toyota Prius")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled();
    expect(localStorage.getItem("car-dealership-session")).toContain(
      "registration-token",
    );
    expect(fetchMock.mock.calls[1][0]).toContain("/api/vehicles");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "Bearer registration-token",
      }),
    });
    expect(screen.queryByText("registration-token")).not.toBeInTheDocument();
  });

  it("logs in and explains invalid credentials without navigating away", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, {
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/login");

    await user.type(screen.getByLabelText(/email address/i), "wrong@example.test");
    await user.type(screen.getByLabelText(/^password$/i), "incorrect-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("redirects an unauthenticated dashboard visit to login", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears an expired session and redirects to login", async () => {
    localStorage.setItem(
      "car-dealership-session",
      JSON.stringify({
        token: "expired-token",
        user: { id: "customer-1", email: "customer@example.test", role: "USER" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          error: { code: "UNAUTHORIZED", message: "A valid bearer token is required." },
        }),
      ),
    );
    renderAt("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem("car-dealership-session")).toBeNull();
    });
  });


});
