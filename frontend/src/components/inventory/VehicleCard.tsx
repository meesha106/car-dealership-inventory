import { useState, type FormEvent } from "react";
import type { Vehicle } from "../../api/client";
import { Field } from "../Field";

export interface VehicleUpdateInput {
  make: string;
  model: string;
  category: string;
  price: number;
}

interface VehicleCardProps {
  vehicle: Vehicle;
  isAdmin: boolean;
  isPurchasing: boolean;
  managementOperation: string | null;
  onPurchase: (vehicle: Vehicle) => void;
  onUpdate: (
    vehicleId: string,
    update: VehicleUpdateInput,
  ) => Promise<boolean>;
  onDelete: (vehicle: Vehicle) => void;
  onRestock: (vehicle: Vehicle, quantity: number) => Promise<boolean>;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function VehicleCard({
  vehicle,
  isAdmin,
  isPurchasing,
  managementOperation,
  onPurchase,
  onUpdate,
  onDelete,
  onRestock,
}: VehicleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({
    make: vehicle.make,
    model: vehicle.model,
    category: vehicle.category,
    price: String(vehicle.price),
  });
  const [restockQuantity, setRestockQuantity] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const managementBusy = managementOperation !== null;

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(editDraft.price);
    const errors: Record<string, string> = {};
    if (!editDraft.make.trim()) errors.make = "Enter a make.";
    if (!editDraft.model.trim()) errors.model = "Enter a model.";
    if (!editDraft.category.trim()) errors.category = "Enter a category.";
    if (!Number.isFinite(price) || price < 0) {
      errors.price = "Enter a nonnegative price.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const saved = await onUpdate(vehicle.id, {
      make: editDraft.make.trim(),
      model: editDraft.model.trim(),
      category: editDraft.category.trim(),
      price,
    });
    if (saved) setIsEditing(false);
  }

  async function submitRestock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(restockQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setFieldErrors({ restock: "Enter a positive whole-number quantity." });
      return;
    }

    clearFieldError("restock");
    if (await onRestock(vehicle, quantity)) setRestockQuantity("");
  }

  function confirmDelete() {
    if (
      window.confirm(
        `Delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`,
      )
    ) {
      onDelete(vehicle);
    }
  }

  return (
    <article
      aria-label={`${vehicle.make} ${vehicle.model}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            {vehicle.category}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {vehicle.make} {vehicle.model}
          </h2>
        </div>
        <p className="shrink-0 text-lg font-semibold">{currency(vehicle.price)}</p>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <p
          className={`text-sm font-medium ${
            vehicle.quantity > 0 ? "text-emerald-800" : "text-slate-500"
          }`}
        >
          {vehicle.quantity > 0
            ? `${vehicle.quantity} in stock`
            : "Out of stock"}
        </p>
        <button
          className="min-h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          disabled={vehicle.quantity === 0 || isPurchasing}
          onClick={() => onPurchase(vehicle)}
          type="button"
        >
          {isPurchasing
            ? "Processing…"
            : vehicle.quantity === 0
              ? "Out of stock"
              : "Purchase"}
        </button>
      </div>
      {isAdmin && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {isEditing ? (
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitEdit}>
              <Field
                id={`edit-make-${vehicle.id}`}
                label="Make"
                error={fieldErrors.make}
                maxLength={200}
                onChange={(event) => {
                  clearFieldError("make");
                  setEditDraft((current) => ({
                    ...current,
                    make: event.target.value,
                  }));
                }}
                required
                value={editDraft.make}
              />
              <Field
                id={`edit-model-${vehicle.id}`}
                label="Model"
                error={fieldErrors.model}
                maxLength={200}
                onChange={(event) => {
                  clearFieldError("model");
                  setEditDraft((current) => ({
                    ...current,
                    model: event.target.value,
                  }));
                }}
                required
                value={editDraft.model}
              />
              <Field
                id={`edit-category-${vehicle.id}`}
                label="Category"
                error={fieldErrors.category}
                maxLength={100}
                onChange={(event) => {
                  clearFieldError("category");
                  setEditDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }));
                }}
                required
                value={editDraft.category}
              />
              <Field
                id={`edit-price-${vehicle.id}`}
                label="Price"
                error={fieldErrors.price}
                min="0"
                onChange={(event) => {
                  clearFieldError("price");
                  setEditDraft((current) => ({
                    ...current,
                    price: event.target.value,
                  }));
                }}
                required
                step="0.01"
                type="number"
                value={editDraft.price}
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={managementBusy}
                  type="submit"
                >
                  {managementOperation === `edit:${vehicle.id}`
                    ? "Saving…"
                    : "Save changes"}
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={() => setIsEditing(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  disabled={managementBusy}
                  onClick={() => {
                    setEditDraft({
                      make: vehicle.make,
                      model: vehicle.model,
                      category: vehicle.category,
                      price: String(vehicle.price),
                    });
                    setFieldErrors({});
                    setIsEditing(true);
                  }}
                  type="button"
                >
                  Edit vehicle
                </button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
                  disabled={managementBusy}
                  onClick={confirmDelete}
                  type="button"
                >
                  {managementOperation === `delete:${vehicle.id}`
                    ? "Deleting…"
                    : "Delete vehicle"}
                </button>
              </div>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={submitRestock}
              >
                <Field
                  className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-600"
                  id={`restock-quantity-${vehicle.id}`}
                  label="Restock quantity"
                  error={fieldErrors.restock}
                  min="1"
                  onChange={(event) => {
                    clearFieldError("restock");
                    setRestockQuantity(event.target.value);
                  }}
                  required
                  step="1"
                  type="number"
                  value={restockQuantity}
                />
                <button
                  className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  disabled={managementBusy}
                  type="submit"
                >
                  {managementOperation === `restock:${vehicle.id}`
                    ? "Restocking…"
                    : "Restock"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
