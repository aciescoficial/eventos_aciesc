"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

let client: SupabaseClient<Database> | undefined;

// Único cliente do app (chave publicável + RLS). Sessão no localStorage, login por PKCE.
export function getSupabase() {
  if (!client) {
    const { url, publishableKey } = supabaseEnv();
    client = createSupabaseClient<Database>(url, publishableKey, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}
