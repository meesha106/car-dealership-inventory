import type { ReactNode } from "react";

export function AuthLayout({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-screen bg-stone-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-32 size-[32rem] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-12 size-[22rem] rounded-full border border-white/10"
        />
        <a className="relative text-sm font-semibold tracking-wide" href="/">
          NORTHLINE <span className="font-normal text-slate-400">MOTOR CO.</span>
        </a>
        <div className="relative max-w-lg pb-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            Inventory, made simple
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">
            The right car starts with the right details.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-300">
            A clear view of every vehicle, its availability, and the people who
            keep your showroom moving.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">
          CAR DEALERSHIP INVENTORY SYSTEM
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <a
            className="mb-12 inline-block text-sm font-semibold tracking-wide text-slate-900 lg:hidden"
            href="/"
          >
            NORTHLINE <span className="font-normal text-slate-500">MOTOR CO.</span>
          </a>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
