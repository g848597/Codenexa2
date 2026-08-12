import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ToolShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-[560px] flex-col px-4 pb-10 pt-4">
      <Link
        to="/"
        className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted transition-colors hover:text-text"
      >
        <span aria-hidden>←</span> Все инструменты
      </Link>
      <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted " +
  "focus:border-accent focus:outline-none";
