import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

function setSession(role: "USER" | "ADMIN" = "USER") {
  localStorage.setItem(
    "car-dealership-session",
    JSON.stringify({
      token: "session-token",
      user: { id: "customer-1", email: "customer@example.test", role },
    }),
  );
}

function vehicle(quantity: number) {
  return {
    id: "vehicle-1",
    make: "Honda",
    model: "Civic",
    category: "Sedan",
    price: 24500,
    quantity,
  };
}

describe("dashboard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a loading state until inventory responds", async () => {
    localStorage.setItem(
      "car-dealership-session",
      JSON.stringify({
        token: "session-token",
        user: { id: "customer-1", email: "customer@example.test", role: "USER" },
      }),
    );
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    renderAt("/dashboard");

    expect(await screen.findByText("Loading vehicles…")).toBeInTheDocument();
    resolveFetch?.(jsonResponse(200, { vehicles: [] }));
    expect(await screen.findByText("No vehicles found")).toBeInTheDocument();
  });

  it("shows an empty inventory state when the API returns no vehicles", async () => {
    localStorage.setItem(
      "car-dealership-session",
      JSON.stringify({
        token: "session-token",
        user: { id: "customer-1", email: "customer@example.test", role: "USER" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { vehicles: [] })),
    );
    renderAt("/dashboard");

    expect(await screen.findByText("No vehicles found")).toBeInTheDocument();
    expect(screen.getByText("Try changing your search or check back as inventory is updated.")).toBeInTheDocument();
  });

  it("shows an actionable error when inventory cannot be loaded", async () => {
    localStorage.setItem(
      "car-dealership-session",
      JSON.stringify({
        token: "session-token",
        user: { id: "customer-1", email: "customer@example.test", role: "USER" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          error: { code: "SERVICE_UNAVAILABLE", message: "Inventory is unavailable." },
        }),
      ),
    );
    renderAt("/dashboard");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inventory is unavailable.",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("logs out and clears the stored session", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "car-dealership-session",
      JSON.stringify({
        token: "session-token",
        user: { id: "customer-1", email: "customer@example.test", role: "USER" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { vehicles: [] })),
    );
    renderAt("/dashboard");

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("car-dealership-session")).toBeNull();
  });

  it("sends only provided filter values to vehicle search", async () => {
    const user = userEvent.setup();
    setSession();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [] }));
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/dashboard");

    await screen.findByText("No vehicles found");
    await user.type(screen.getByRole("searchbox", { name: "Make" }), "Honda");
    await user.type(screen.getByRole("searchbox", { name: "Model" }), "Civic");
    await user.type(screen.getByRole("searchbox", { name: "Category" }), "Sedan");
    await user.type(screen.getByRole("spinbutton", { name: "Min price" }), "10000");
    await user.type(screen.getByRole("spinbutton", { name: "Max price" }), "30000");
    await user.click(screen.getByRole("button", { name: "Search inventory" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const searchUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(searchUrl.pathname).toBe("/api/vehicles/search");
    expect([...searchUrl.searchParams.entries()]).toEqual([
      ["make", "Honda"],
      ["model", "Civic"],
      ["category", "Sedan"],
      ["minPrice", "10000"],
      ["maxPrice", "30000"],
    ]);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.type(screen.getByRole("searchbox", { name: "Make" }), "Honda");
    await user.click(screen.getByRole("button", { name: "Search inventory" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const makeOnlySearchUrl = new URL(fetchMock.mock.calls[3][0] as string);
    expect([...makeOnlySearchUrl.searchParams.entries()]).toEqual([
      ["make", "Honda"],
    ]);
  });

  it("keeps a zero-stock vehicle visible with its purchase button disabled", async () => {
    setSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { vehicles: [vehicle(0)] }),
      ),
    );
    renderAt("/dashboard");

    expect(await screen.findByText("Honda Civic")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Out of stock" }),
    ).toBeDisabled();
  });

  it("waits for purchase confirmation and refreshes inventory from the server", async () => {
    const user = userEvent.setup();
    setSession();
    let resolvePurchase: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(2)] }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolvePurchase = resolve;
          }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(1)] }));
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/dashboard");

    const purchaseButton = await screen.findByRole("button", {
      name: "Purchase",
    });
    await user.click(purchaseButton);
    expect(screen.getByRole("button", { name: "Processing…" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Processing…" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });

    resolvePurchase?.(
      jsonResponse(201, {
        purchase: {
          id: "purchase-1",
          userId: "customer-1",
          vehicleId: "vehicle-1",
          vehicleMake: "Honda",
          vehicleModel: "Civic",
          priceSnapshot: 24500,
        },
        vehicle: vehicle(1),
      }),
    );

    const purchaseDialog = await screen.findByRole("dialog", {
      name: "Purchase successful",
    });
    expect(purchaseButton.closest("[inert]")).not.toBeNull();
    expect(purchaseDialog).toHaveTextContent(
      "Honda Civic purchased. 1 remaining in stock.",
    );
    await user.click(
      within(purchaseDialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toContain("/api/vehicles");
    expect(screen.getByText("1 in stock")).toBeInTheDocument();
  });

  it("shows conflict feedback and refreshes stale stock after a 409", async () => {
    const user = userEvent.setup();
    setSession();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(1)] }))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          error: { code: "OUT_OF_STOCK", message: "Vehicle is out of stock." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(0)] }));
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/dashboard");

    await user.click(await screen.findByRole("button", { name: "Purchase" }));

    const errorDialog = await screen.findByRole("dialog", {
      name: "Purchase could not be completed",
    });
    expect(errorDialog).toHaveTextContent("Vehicle is out of stock.");
    expect(await screen.findByRole("button", { name: "Out of stock" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("closes an action modal with Escape and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    setSession();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(2)] }))
        .mockResolvedValueOnce(
          jsonResponse(201, {
            purchase: {
              id: "purchase-1",
              userId: "customer-1",
              vehicleId: "vehicle-1",
              vehicleMake: "Honda",
              vehicleModel: "Civic",
              priceSnapshot: 24500,
            },
            vehicle: vehicle(1),
          }),
        )
        .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(1)] })),
    );
    renderAt("/dashboard");

    const purchaseButton = await screen.findByRole("button", {
      name: "Purchase",
    });
    await user.click(purchaseButton);
    await screen.findByRole("dialog", { name: "Purchase successful" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchaseButton).toHaveFocus();
  });

  it("does not show inventory management controls to a USER", async () => {
    setSession("USER");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { vehicles: [vehicle(2)] })),
    );
    renderAt("/dashboard");

    await screen.findByText("Honda Civic");

    expect(screen.queryByRole("region", { name: /inventory management/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add vehicle/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit vehicle/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete vehicle/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /restock/i })).toBeNull();
  });

  it("allows an ADMIN to add, edit, restock, and delete vehicles", async () => {
    const user = userEvent.setup();
    setSession("ADMIN");
    const original = {
      id: "vehicle-1",
      make: "Honda",
      model: "Civic",
      category: "Sedan",
      price: 24500,
      quantity: 2,
    };
    const created = {
      id: "vehicle-2",
      make: "Toyota",
      model: "Prius",
      category: "Hybrid",
      price: 31000,
      quantity: 3,
    };
    const edited = { ...original, make: "Honda", model: "Accord", price: 28000 };
    const restocked = { ...edited, quantity: 7 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [original] }))
      .mockResolvedValueOnce(jsonResponse(201, { vehicle: created }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [original, created] }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicle: edited }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [edited, created] }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicle: restocked }))
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [restocked, created] }))
      .mockResolvedValueOnce(
        jsonResponse(200, { message: "Vehicle deleted successfully." }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [created] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    renderAt("/dashboard");

    await screen.findByText("Honda Civic");
    expect(
      screen.getByRole("region", { name: /inventory management/i }),
    ).toBeInTheDocument();
    const dashboardHeading = screen.getByRole("heading", {
      level: 1,
      name: "Dashboard",
    });
    const inventoryHeading = screen.getByRole("heading", {
      level: 2,
      name: "Available Inventory",
    });
    const managementHeading = screen.getByRole("heading", {
      level: 2,
      name: "Inventory Management",
    });
    expect(
      dashboardHeading.compareDocumentPosition(inventoryHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      inventoryHeading.compareDocumentPosition(managementHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.type(screen.getByLabelText("New make"), "Toyota");
    await user.type(screen.getByLabelText("New model"), "Prius");
    await user.type(screen.getByLabelText("New category"), "Hybrid");
    await user.type(screen.getByLabelText("New price"), "31000");
    await user.type(screen.getByLabelText("Initial quantity"), "3");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(await screen.findByText("Toyota Prius")).toBeInTheDocument();
    const addedDialog = await screen.findByRole("dialog", {
      name: "Vehicle added",
    });
    expect(addedDialog).toHaveTextContent("Toyota Prius");
    expect(addedDialog).toHaveTextContent("3 in stock");
    await user.click(within(addedDialog).getByRole("button", { name: "Close" }));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        make: "Toyota",
        model: "Prius",
        category: "Hybrid",
        price: 31000,
        quantity: 3,
      }),
    });

    const hondaCard = screen.getByRole("article", { name: /Honda Civic/i });
    await user.click(
      within(hondaCard).getByRole("button", { name: "Edit vehicle" }),
    );
    await user.clear(within(hondaCard).getByLabelText("Model"));
    await user.type(within(hondaCard).getByLabelText("Model"), "Accord");
    await user.clear(within(hondaCard).getByLabelText("Price"));
    await user.type(within(hondaCard).getByLabelText("Price"), "28000");
    await user.click(within(hondaCard).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Honda Accord")).toBeInTheDocument();
    const editedDialog = await screen.findByRole("dialog", {
      name: "Vehicle updated",
    });
    expect(editedDialog).toHaveTextContent("Honda Accord");
    expect(editedDialog).toHaveTextContent("2 in stock");
    await user.click(within(editedDialog).getByRole("button", { name: "Close" }));
    expect(fetchMock.mock.calls[3][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        make: "Honda",
        model: "Accord",
        category: "Sedan",
        price: 28000,
      }),
    });

    const accordCard = screen.getByRole("article", { name: /Honda Accord/i });
    await user.type(within(accordCard).getByLabelText("Restock quantity"), "5");
    await user.click(within(accordCard).getByRole("button", { name: "Restock" }));
    expect(await screen.findByText("7 in stock")).toBeInTheDocument();
    const restockDialog = await screen.findByRole("dialog", {
      name: "Stock updated",
    });
    expect(restockDialog).toHaveTextContent("Honda Accord");
    expect(restockDialog).toHaveTextContent("7 in stock");
    await user.click(
      within(restockDialog).getByRole("button", { name: "Close" }),
    );
    expect(fetchMock.mock.calls[5][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ quantity: 5 }),
    });

    await user.click(
      within(accordCard).getByRole("button", { name: "Delete vehicle" }),
    );
    expect(confirm).toHaveBeenCalled();
    const deletedDialog = await screen.findByRole("dialog", {
      name: "Vehicle deleted",
    });
    expect(deletedDialog).toHaveTextContent("Honda Accord");
    await user.click(
      within(deletedDialog).getByRole("button", { name: "Close" }),
    );
    expect(await screen.findByText("Toyota Prius")).toBeInTheDocument();
    expect(screen.queryByText("Honda Accord")).toBeNull();
    expect(fetchMock.mock.calls[7][1]).toMatchObject({ method: "DELETE" });
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it("shows restock validation and server errors to an ADMIN", async () => {
    setSession("ADMIN");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { vehicles: [vehicle(2)] }))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          error: {
            code: "STOCK_LIMIT",
            message: "The requested stock exceeds the inventory limit.",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/dashboard");

    const card = await screen.findByRole("article", { name: "Honda Civic" });
    const quantity = within(card).getByLabelText("Restock quantity");
    await userEvent.setup().clear(quantity);
    await userEvent.setup().type(quantity, "0");
    const restockForm = within(card)
      .getByRole("button", { name: "Restock" })
      .closest("form");
    if (!restockForm) {
      throw new Error("Restock button must be within a form");
    }
    fireEvent.submit(restockForm);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a positive whole-number quantity.",
    );
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).toHaveBeenCalledOnce();

    await userEvent.setup().clear(quantity);
    await userEvent.setup().type(quantity, "4");
    await userEvent.click(within(card).getByRole("button", { name: "Restock" }));

    const errorDialog = await screen.findByRole("dialog", {
      name: "Restock could not be completed",
    });
    expect(errorDialog).toHaveTextContent(
      "The requested stock exceeds the inventory limit.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows an API error in a modal when adding a vehicle fails", async () => {
    const user = userEvent.setup();
    setSession("ADMIN");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { vehicles: [] }))
        .mockResolvedValueOnce(
          jsonResponse(400, {
            error: {
              code: "VALIDATION_ERROR",
              message: "Vehicle price must be nonnegative.",
            },
          }),
        ),
    );
    renderAt("/dashboard");

    await user.type(screen.getByLabelText("New make"), "Honda");
    await user.type(screen.getByLabelText("New model"), "Civic");
    await user.type(screen.getByLabelText("New category"), "Sedan");
    await user.type(screen.getByLabelText("New price"), "20000");
    await user.type(screen.getByLabelText("Initial quantity"), "2");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    const errorDialog = await screen.findByRole("dialog", {
      name: "Vehicle could not be added",
    });
    expect(errorDialog).toHaveTextContent(
      "Vehicle price must be nonnegative.",
    );
  });
});
