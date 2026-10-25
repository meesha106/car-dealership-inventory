import type { FormEvent } from "react";
import { Field } from "../Field";

export interface InventoryFilters {
  make: string;
  model: string;
  category: string;
  minPrice: string;
  maxPrice: string;
}

export const emptyInventoryFilters: InventoryFilters = {
  make: "",
  model: "",
  category: "",
  minPrice: "",
  maxPrice: "",
};

interface InventoryFiltersFormProps {
  filters: InventoryFilters;
  onChange: (filters: InventoryFilters) => void;
  onSearch: (filters: InventoryFilters) => void;
  onClear: () => void;
}

export function InventoryFiltersForm({
  filters,
  onChange,
  onSearch,
  onClear,
}: InventoryFiltersFormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(filters);
  }

  return (
    <form
      className="mt-7 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
      onSubmit={submit}
    >
      {(["make", "model", "category"] as const).map((key) => (
        <Field
          id={`filter-${key}`}
          key={key}
          label={key[0].toUpperCase() + key.slice(1)}
          onChange={(event) => onChange({ ...filters, [key]: event.target.value })}
          placeholder={`Any ${key}`}
          type="search"
          value={filters[key]}
        />
      ))}
      <Field
        id="filter-min-price"
        label="Min price"
        min="0"
        onChange={(event) =>
          onChange({ ...filters, minPrice: event.target.value })
        }
        placeholder="$0"
        type="number"
        value={filters.minPrice}
      />
      <Field
        id="filter-max-price"
        label="Max price"
        min="0"
        onChange={(event) =>
          onChange({ ...filters, maxPrice: event.target.value })
        }
        placeholder="No limit"
        type="number"
        value={filters.maxPrice}
      />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
        <button
          className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          onClick={onClear}
          type="button"
        >
          Clear
        </button>
        <button
          className="min-h-10 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          type="submit"
        >
          Search inventory
        </button>
      </div>
    </form>
  );
}
