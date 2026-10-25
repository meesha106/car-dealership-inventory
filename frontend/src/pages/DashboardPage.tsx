import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  createVehicle,
  deleteVehicle,
  getVehicles,
  purchaseVehicle,
  restockVehicle,
  updateVehicle,
  type Vehicle,
} from "../api/client";
import { useAuth } from "../auth/auth-context";
import { ActionModal } from "../components/ActionModal";
import {
  AdminInventorySection,
  type NewVehicleInput,
} from "../components/inventory/AdminInventorySection";
import {
  emptyInventoryFilters,
  InventoryFiltersForm,
  type InventoryFilters,
} from "../components/inventory/InventoryFiltersForm";
import type { VehicleUpdateInput } from "../components/inventory/VehicleCard";
import {
  VehicleInventory,
} from "../components/inventory/VehicleInventory";
import { useActionModal } from "../components/useActionModal";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] =
    useState<InventoryFilters>(emptyInventoryFilters);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [managementOperation, setManagementOperation] = useState<string | null>(
    null,
  );
  const pendingActionsRef = useRef(new Set<string>());
  const dashboardHeadingRef = useRef<HTMLHeadingElement>(null);
  const { modal, closeModal, showError, showSuccess } = useActionModal();
  const isAdmin = user?.role === "ADMIN";

  const loadInventory = useCallback(async (searchFilters: InventoryFilters) => {
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(searchFilters)) {
        if (value.trim()) params.set(key, value.trim());
      }
      setVehicles(await getVehicles(params));
    } catch (loadError) {
      setError(
        getErrorMessage(
          loadError,
          "Inventory could not be loaded. Check the API connection and try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getVehicles()
      .then(
        (inventory) => {
          if (active) setVehicles(inventory);
        },
        (loadError: unknown) => {
          if (active) {
            setError(
              getErrorMessage(
                loadError,
                "Inventory could not be loaded. Check the API connection and try again.",
              ),
            );
          }
        },
      )
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSearch(searchFilters: InventoryFilters) {
    setIsLoading(true);
    setError("");
    await loadInventory(searchFilters);
  }

  function clearFilters() {
    setFilters(emptyInventoryFilters);
    setIsLoading(true);
    setError("");
    void loadInventory(emptyInventoryFilters);
  }

  async function handlePurchase(vehicle: Vehicle) {
    const actionKey = `purchase:${vehicle.id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);
    setPurchasingId(vehicle.id);
    try {
      const result = await purchaseVehicle(vehicle.id);
      showSuccess(
        "Purchase successful",
        `${result.vehicle.make} ${result.vehicle.model} purchased. ${result.vehicle.quantity} remaining in stock.`,
      );
      setIsLoading(true);
      setError("");
      await loadInventory(filters);
    } catch (purchaseError) {
      showError(
        "Purchase could not be completed",
        getErrorMessage(purchaseError, "Purchase could not be completed."),
      );
      if (purchaseError instanceof ApiError && purchaseError.status === 409) {
        setIsLoading(true);
        setError("");
        await loadInventory(filters);
      }
    } finally {
      pendingActionsRef.current.delete(actionKey);
      setPurchasingId(null);
    }
  }

  async function handleAddVehicle(vehicle: NewVehicleInput): Promise<boolean> {
    if (pendingActionsRef.current.has("management")) return false;
    pendingActionsRef.current.add("management");
    setManagementOperation("add");
    try {
      const result = await createVehicle(vehicle);
      showSuccess(
        "Vehicle added",
        `${result.vehicle.make} ${result.vehicle.model} added with ${result.vehicle.quantity} in stock.`,
      );
      setIsLoading(true);
      await loadInventory(filters);
      return true;
    } catch (operationError) {
      showError(
        "Vehicle could not be added",
        getErrorMessage(operationError, "The vehicle could not be added."),
      );
      return false;
    } finally {
      pendingActionsRef.current.delete("management");
      setManagementOperation(null);
    }
  }

  async function handleUpdateVehicle(
    vehicleId: string,
    update: VehicleUpdateInput,
  ): Promise<boolean> {
    if (pendingActionsRef.current.has("management")) return false;
    pendingActionsRef.current.add("management");
    setManagementOperation(`edit:${vehicleId}`);
    try {
      const result = await updateVehicle(vehicleId, update);
      showSuccess(
        "Vehicle updated",
        `${result.vehicle.make} ${result.vehicle.model} updated. ${result.vehicle.quantity} in stock.`,
      );
      setIsLoading(true);
      await loadInventory(filters);
      return true;
    } catch (operationError) {
      showError(
        "Vehicle could not be updated",
        getErrorMessage(operationError, "The vehicle could not be updated."),
      );
      return false;
    } finally {
      pendingActionsRef.current.delete("management");
      setManagementOperation(null);
    }
  }

  async function handleDeleteVehicle(vehicle: Vehicle) {
    if (pendingActionsRef.current.has("management")) return;
    pendingActionsRef.current.add("management");
    setManagementOperation(`delete:${vehicle.id}`);
    try {
      await deleteVehicle(vehicle.id);
      showSuccess(
        "Vehicle deleted",
        `${vehicle.make} ${vehicle.model} was deleted from inventory.`,
      );
      setIsLoading(true);
      await loadInventory(filters);
    } catch (operationError) {
      showError(
        "Vehicle could not be deleted",
        getErrorMessage(operationError, "The vehicle could not be deleted."),
      );
    } finally {
      pendingActionsRef.current.delete("management");
      setManagementOperation(null);
    }
  }

  async function handleRestockVehicle(
    vehicle: Vehicle,
    quantity: number,
  ): Promise<boolean> {
    if (pendingActionsRef.current.has("management")) return false;
    pendingActionsRef.current.add("management");
    setManagementOperation(`restock:${vehicle.id}`);
    try {
      const result = await restockVehicle(vehicle.id, quantity);
      showSuccess(
        "Stock updated",
        `${result.vehicle.make} ${result.vehicle.model} now has ${result.vehicle.quantity} in stock.`,
      );
      setIsLoading(true);
      await loadInventory(filters);
      return true;
    } catch (operationError) {
      showError(
        "Restock could not be completed",
        getErrorMessage(operationError, "The vehicle could not be restocked."),
      );
      return false;
    } finally {
      pendingActionsRef.current.delete("management");
      setManagementOperation(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <div inert={modal !== null}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <a className="text-sm font-semibold tracking-wide" href="/dashboard">
              NORTHLINE{" "}
              <span className="font-normal text-slate-500">MOTOR CO.</span>
            </a>
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:inline">
                {user?.email}
              </span>
              <button
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                onClick={logout}
                type="button"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
                Showroom inventory
              </p>
              <h1
                className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
                ref={dashboardHeadingRef}
                tabIndex={-1}
              >
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Browse current vehicles and availability.
              </p>
            </div>
          </section>

          <InventoryFiltersForm
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            onSearch={(searchFilters) => void handleSearch(searchFilters)}
          />

          <VehicleInventory
            error={error}
            isAdmin={isAdmin}
            isLoading={isLoading}
            managementOperation={managementOperation}
            onDelete={(vehicle) => void handleDeleteVehicle(vehicle)}
            onPurchase={(vehicle) => void handlePurchase(vehicle)}
            onRestock={handleRestockVehicle}
            onRetry={() => {
              setIsLoading(true);
              setError("");
              void loadInventory(filters);
            }}
            onUpdate={handleUpdateVehicle}
            purchasingId={purchasingId}
            vehicles={vehicles}
          />

          {isAdmin && (
            <AdminInventorySection
              isSubmitting={managementOperation !== null}
              onAdd={handleAddVehicle}
            />
          )}
        </main>
      </div>
      {modal && (
        <ActionModal
          fallbackFocusRef={dashboardHeadingRef}
          modal={modal}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
