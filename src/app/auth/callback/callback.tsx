"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth";

// Destino do link mágico: o cliente Supabase troca o ?code= pela sessão (detectSessionInUrl).
export function Callback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = safeNext(params.get("next"));
    getSupabase()
      .auth.getSession()
      .then(({ data }) => router.replace(data.session ? next : "/entrar/?erro=link"));
  }, [params, router]);

  return null;
}
