import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("application shell", () => {
  it("shows that the app is running", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Car Dealership Inventory System",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("The app is running.")).toBeInTheDocument();
  });
});
