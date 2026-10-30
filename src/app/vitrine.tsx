"use client";

import { useEffect, useMemo, useState } from "react";
import { EventCardView } from "@/components/event-card";
import { Empty } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { EVENT_CARD_SELECT, isUpcoming, nextDate, type EventCard } from "@/lib/public-data";

export function Vitrine({ initial }: { initial: EventCard[] }) {
  const [events, setEvents] = useState(initial);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");

  // Atualiza com dados vivos (eventos publicados depois do último build).
  useEffect(() => {
    getSupabase()
      .from("events")
      .select(EVENT_CARD_SELECT)
      .in("status", ["published", "closed"])
      .neq("visibility", "private")
      .order("created_at", { ascending: false })
      .then(({ data }) => data && setEvents(data as unknown as EventCard[]));
  }, []);

  const cities = useMemo(
    () => [...new Set(events.map((e) => e.venues?.city).filter(Boolean) as string[])].sort(),
    [events],
  );
  const categories = useMemo(
    () => [...new Set(events.map((e) => e.category).filter(Boolean) as string[])].sort(),
    [events],
  );

  const term = q.trim().toLowerCase();
  const filtered = events.filter(
    (e) =>
      (!term || `${e.title} ${e.summary ?? ""} ${e.category ?? ""}`.toLowerCase().includes(term)) &&
      (!city || e.venues?.city === city) &&
      (!category || e.category === category),
  );
  const byDate = (a: EventCard, b: EventCard) =>
    (nextDate(a)?.starts_at ?? "").localeCompare(nextDate(b)?.starts_at ?? "");
  const upcoming = filtered.filter(isUpcoming).sort(byDate);
  const featured = upcoming.filter((e) => e.featured);
  const freeCourses = upcoming.filter((e) => e.kind === "free_course");
  const past = filtered.filter((e) => !isUpcoming(e)).sort((a, b) => byDate(b, a)).slice(0, 8);
  const filtering = !!(term || city || category);

  return (
    <div id="agenda" className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="-mt-14 grid gap-2 rounded-2xl bg-white p-3 shadow-lg sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor="busca">Buscar eventos</label>
        <input
          id="busca"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cursos, palestras, workshops…"
          className="min-h-11 rounded-xl border border-line px-4"
        />
        <label className="sr-only" htmlFor="cidade">Cidade</label>
        <select id="cidade" value={city} onChange={(e) => setCity(e.target.value)} className="min-h-11 rounded-xl border border-line px-3">
          <option value="">Todas as cidades</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="sr-only" htmlFor="categoria">Categoria</label>
        <select id="categoria" value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-11 rounded-xl border border-line px-3">
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {!filtering && featured.length > 0 && <Row title="Destaques" items={featured} />}
      {!filtering && freeCourses.length > 0 && <Row title="Cursos gratuitos para associados" items={freeCourses} />}
      <Row title={filtering ? "Resultados" : "Próximos eventos"} items={upcoming} grid />
      {upcoming.length === 0 && <Empty>Nenhum evento encontrado no momento.</Empty>}
      {past.length > 0 && <Row title="Eventos anteriores" items={past} grid />}
    </div>
  );
}

function Row({ title, items, grid }: { title: string; items: EventCard[]; grid?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-extrabold">{title}</h2>
      <div
        className={
          grid
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            : "-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [&>*]:w-72 [&>*]:shrink-0 [&>*]:snap-start"
        }
      >
        {items.map((e) => <EventCardView key={e.id} e={e} />)}
      </div>
    </section>
  );
}
