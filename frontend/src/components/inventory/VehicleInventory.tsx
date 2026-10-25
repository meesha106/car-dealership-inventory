import type { Vehicle } from "../../api/client";
import type { VehicleUpdateInput } from "./VehicleCard";
import { VehicleCard } from "./VehicleCard";

interface VehicleInventoryProps {
  vehicles: Vehicle[];
  isLoading: boolean;
  error: string;
  isAdmin: boolean;
  purchasingId: string | null;
  managementOperation: string | null;
  onRetry: () => void;
  onPurchase: (vehicle: Vehicle) => void;
  onUpdate: (
    vehicleId: string,
    update: VehicleUpdateInput,
  ) => Promise<boolean>;
  onDelete: (vehicle: Vehicle) => void;
  onRestock: (vehicle: Vehicle, quantity: number) => Promise<boolean>;
}

export function VehicleInventory({
  vehicles,
  isLoading,
  error,
  isAdmin,
  purchasingId,
  managementOperation,
  onRetry,
  onPurchase,
  onUpdate,
  onDelete,
  onRestock,
}: VehicleInventoryProps) {
  return (
    <section aria-labelledby="available-inventory-heading" className="mt-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <h2
          className="text-2xl font-semibold tracking-tight"
          id="available-inventory-heading"
        >
          Available Inventory
        </h2>
        <p className="text-sm text-slate-500" aria-live="polite">
          {isLoading ? "Loading inventory…" : `${vehicles.length} vehicles`}
        </p>
      </div>
      {error && (
        <section
          aria-live="polite"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
          role="alert"
        >
          <h2 className="font-semibold text-red-950">Inventory unavailable</h2>
          <p className="mt-1 text-sm text-red-800">{error}</p>
          <button
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        </section>
      )}
      {isLoading && (
        <p className="mt-8 text-sm text-slate-600" role="status">
          Loading vehicles…
        </p>
      )}
      {!isLoading && !error && vehicles.length === 0 && (
        <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">No vehicles found</h2>
          <p className="mt-2 text-sm text-slate-600">
            Try changing your search or check back as inventory is updated.
          </p>
        </section>
      )}
      {!isLoading && !error && vehicles.length > 0 && (
        <section
          aria-label="Vehicle inventory"
          className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {vehicles.map((vehicle) => (
            <VehicleCard
              isAdmin={isAdmin}
              isPurchasing={purchasingId === vehicle.id}
              key={vehicle.id}
              managementOperation={managementOperation}
              onDelete={onDelete}
              onPurchase={onPurchase}
              onRestock={onRestock}
              onUpdate={onUpdate}
              vehicle={vehicle}
            />
          ))}
        </section>
      )}
    </section>
  );
}
