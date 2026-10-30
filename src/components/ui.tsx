"use client";

import Link from "next/link";
import {
  useId,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

const BTN: Record<BtnVariant, string> = {
  primary: "btn-primary",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 font-semibold text-ink hover:bg-tint disabled:opacity-60",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 font-semibold text-brand hover:bg-tint disabled:opacity-60",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-error-fg px-5 font-semibold text-white hover:brightness-110 disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <button type="button" className={cx(BTN[variant], className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: BtnVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(BTN[variant], className)}>
      {children}
    </Link>
  );
}

const INPUT =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-bg";

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="text-sm font-semibold">
        {label}
      </label>
      {children(fid)}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs font-semibold text-error-fg">{error}</p>}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <Field label={label} hint={hint} error={error} id={props.id}>
      {(id) => <input id={id} className={cx(INPUT, className)} aria-invalid={!!error} {...props} />}
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint} id={props.id}>
      {(id) => <textarea id={id} className={cx(INPUT, "min-h-28 py-2.5", className)} {...props} />}
    </Field>
  );
}

export function Select({
  label,
  hint,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint} id={props.id}>
      {(id) => (
        <select id={id} className={cx(INPUT, className)} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 accent-brand" {...props} />
      <label htmlFor={id} className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-white p-5", className)}>{children}</div>;
}

const BADGE: Record<string, string> = {
  green: "bg-tint text-brand",
  yellow: "bg-pending-bg text-pending-fg",
  red: "bg-error-bg text-error-fg",
  gray: "bg-bg text-muted border border-line",
  dark: "bg-green-800 text-white",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE[tone])}>
      {children}
    </span>
  );
}

export function statusTone(s: string): keyof typeof BADGE {
  if (["published", "paid", "valid", "accepted", "active"].includes(s)) return "green";
  if (["pending", "draft", "waiting", "offered"].includes(s)) return "yellow";
  if (["cancelled", "failed", "refunded", "expired", "removed"].includes(s)) return "red";
  return "gray";
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "warn"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "bg-error-bg text-error-fg"
      : tone === "warn"
        ? "bg-pending-bg text-pending-fg"
        : "bg-tint text-ink";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl p-3.5 text-sm", cls)}>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
            value === t.id ? "bg-green-800 text-white" : "bg-white text-ink border border-line hover:bg-tint",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = "Carregando…" }: { label?: string }) {
  return (
    <p role="status" className="py-6 text-center text-muted">
      {label}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{children}</p>;
}
