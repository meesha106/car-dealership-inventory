import { useState, type FormEvent } from "react";
import { Field } from "../Field";

export interface NewVehicleInput {
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

interface AdminInventorySectionProps {
  isSubmitting: boolean;
  onAdd: (vehicle: NewVehicleInput) => Promise<boolean>;
}

const emptyDraft = {
  make: "",
  model: "",
  category: "",
  price: "",
  quantity: "",
};

export function AdminInventorySection({
  isSubmitting,
  onAdd,
}: AdminInventorySectionProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearError(field: string) {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(draft.price);
    const quantity = Number(draft.quantity);
    const validationErrors: Record<string, string> = {};
    if (!draft.make.trim()) validationErrors.make = "Enter a make.";
    if (!draft.model.trim()) validationErrors.model = "Enter a model.";
    if (!draft.category.trim()) {
      validationErrors.category = "Enter a category.";
    }
    if (!Number.isFinite(price) || price < 0) {
      validationErrors.price = "Enter a nonnegative price.";
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      validationErrors.quantity =
        "Enter a nonnegative whole-number quantity.";
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const added = await onAdd({
      make: draft.make.trim(),
      model: draft.model.trim(),
      category: draft.category.trim(),
      price,
      quantity,
    });
    if (added) setDraft(emptyDraft);
  }

  return (
    <section
      aria-label="Inventory Management"
      className="mt-8 rounded-xl border border-amber-200 bg-amber-50/60 p-5"
    >
      <h2 className="text-lg font-semibold">Inventory Management</h2>
      <p className="mt-1 text-sm text-slate-600">
        Add vehicles and maintain listing details and stock.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={submit}
      >
        <Field
          id="admin-new-make"
          label="New make"
          error={errors.make}
          maxLength={200}
          onChange={(event) => {
            clearError("make");
            setDraft((current) => ({ ...current, make: event.target.value }));
          }}
          required
          value={draft.make}
        />
        <Field
          id="admin-new-model"
          label="New model"
          error={errors.model}
          maxLength={200}
          onChange={(event) => {
            clearError("model");
            setDraft((current) => ({ ...current, model: event.target.value }));
          }}
          required
          value={draft.model}
        />
        <Field
          id="admin-new-category"
          label="New category"
          error={errors.category}
          maxLength={100}
          onChange={(event) => {
            clearError("category");
            setDraft((current) => ({
              ...current,
              category: event.target.value,
            }));
          }}
          required
          value={draft.category}
        />
        <Field
          id="admin-new-price"
          label="New price"
          error={errors.price}
          min="0"
          onChange={(event) => {
            clearError("price");
            setDraft((current) => ({ ...current, price: event.target.value }));
          }}
          required
          step="0.01"
          type="number"
          value={draft.price}
        />
        <Field
          id="admin-new-quantity"
          label="Initial quantity"
          error={errors.quantity}
          min="0"
          onChange={(event) => {
            clearError("quantity");
            setDraft((current) => ({
              ...current,
              quantity: event.target.value,
            }));
          }}
          required
          step="1"
          type="number"
          value={draft.quantity}
        />
        <div className="sm:col-span-2 lg:col-span-5">
          <button
            className="min-h-10 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Adding…" : "Add vehicle"}
          </button>
        </div>
      </form>
    </section>
  );
}
