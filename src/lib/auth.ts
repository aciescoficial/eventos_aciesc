"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type AppRole = "admin" | "organizer" | "door" | "finance";

export type CurrentUser = {
  id: string;
  email: string | null;
  roles: { role: AppRole; eventId: string | null }[];
};

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "ready"; user: CurrentUser };

// O site é estático: a checagem de papel aqui só decide o que mostrar.
// Quem protege os dados de verdade são as políticas RLS no Supabase.
const ROLES_CACHE = "aciesc_roles_cache";

export async function loadCurrentUser(): Promise<CurrentUser | null> {
  const supabase = getSupabase();
  // getUser() confirma o token com o servidor de Auth (não confia só no localStorage).
  const { data, error } = await supabase.auth.getUser();
  if (error && isNetworkError(error)) return offlineUser();
  if (error || !data.user) return null;

  const { data: roles, error: rolesError } = await supabase.rpc("my_roles");
  if (rolesError) {
    if (isNetworkError(rolesError)) return offlineUser();
    throw rolesError;
  }

  const user: CurrentUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    roles: (roles ?? []).map((r: { role: AppRole; event_id: string | null }) => ({
      role: r.role,
      eventId: r.event_id,
    })),
  };
  try {
    localStorage.setItem(ROLES_CACHE, JSON.stringify(user));
  } catch {}
  return user;
}

function isNetworkError(e: unknown) {
  return /fetch|network|Load failed/i.test(String((e as { message?: string })?.message ?? e)) || !navigator.onLine;
}

// Sem internet (portaria offline): usa a sessão local e os papéis já conhecidos.
// Só afeta a interface; tudo é revalidado pelo servidor na sincronização.
async function offlineUser(): Promise<CurrentUser | null> {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(ROLES_CACHE) ?? "null") as CurrentUser | null;
    if (cached?.id === data.session.user.id) return cached;
  } catch {}
  return null;
}

export function useCurrentUser(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const refresh = () =>
      loadCurrentUser()
        .then((user) => active && setState(user ? { status: "ready", user } : { status: "anonymous" }))
        .catch(() => active && setState({ status: "anonymous" }));

    refresh();
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

// Papel global (ou admin) entre os permitidos.
export function hasAnyRole(user: CurrentUser, allowed: AppRole[]) {
  return user.roles.some(
    (r) => r.role === "admin" || (allowed.includes(r.role) && r.eventId === null),
  );
}

// Aceita só caminhos internos, para evitar redirecionamento aberto.
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
