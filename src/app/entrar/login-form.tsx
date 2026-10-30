"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const linkError = params.get("erro") === "link";
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setStatus({ kind: "error", message: "Informe um e-mail válido." });
      return;
    }

    setStatus({ kind: "sending" });
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback/?next=${encodeURIComponent(next)}`,
      },
    });
    // Mensagem genérica para não revelar se o e-mail existe; o Supabase Auth limita a taxa.
    setStatus(
      error
        ? { kind: "error", message: "Não foi possível enviar o link agora. Tente novamente em instantes." }
        : { kind: "sent" },
    );
  }

  if (status.kind === "sent") {
    return (
      <p role="status" className="rounded-xl bg-tint p-4 text-ink">
        Enviamos um link de acesso para o seu e-mail. Abra-o neste aparelho para entrar.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {linkError && (
        <p role="alert" className="rounded-xl bg-error-bg p-3 text-sm text-error-fg">
          O link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="min-h-11 rounded-xl border border-line bg-white px-4 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
      {status.kind === "error" && (
        <p role="alert" className="rounded-xl bg-error-bg p-3 text-sm text-error-fg">
          {status.message}
        </p>
      )}
      <button type="submit" disabled={status.kind === "sending"} className="btn-primary">
        {status.kind === "sending" ? "Enviando…" : "Receber link de acesso"}
      </button>
    </form>
  );
}
