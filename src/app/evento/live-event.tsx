"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EventView } from "@/components/event-view";
import { Empty, Spinner } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { EVENT_FULL_SELECT, type EventFull } from "@/lib/public-data";

// Evento publicado depois do último build do site (ou prévia de rascunho para a equipe).
export function LiveEvent() {
  const slug = useSearchParams().get("s") ?? "";
  const [e, setE] = useState<EventFull | null | undefined>(slug ? undefined : null);

  useEffect(() => {
    if (!slug) return;
    getSupabase()
      .from("events")
      .select(EVENT_FULL_SELECT)
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        setE((data as unknown as EventFull) ?? null);
        if (data) document.title = `${(data as unknown as EventFull).title} · Eventos ACIESC`;
      });
  }, [slug]);

  if (e === undefined) return <Spinner />;
  if (e === null) return <div className="mx-auto max-w-xl px-4 py-12"><Empty>Evento não encontrado.</Empty></div>;
  return <EventView e={e} />;
}
