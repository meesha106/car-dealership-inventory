import type { InputHTMLAttributes } from "react";

export function Field({
  label,
  id,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/10 disabled:bg-slate-100"
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-700" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
