// Dados públicos lidos NO BUILD (páginas estáticas/SEO). Usa só a chave publicável.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const EVENT_CARD_SELECT =
  "id,slug,title,kind,category,summary,cover_url,format,visibility,featured,status,certificate_hours,venues(name,city),event_dates(starts_at,ends_at)";

export const EVENT_FULL_SELECT =
  "id,slug,title,kind,category,summary,description,cover_url,format,visibility,featured,status,certificate_hours,published_at,updated_at,venues(name,address,city,maps_url,parking_info),event_dates(id,starts_at,ends_at,label,capacity),speakers(name,bio,photo_url,sort)";

export type EventCard = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  category: string | null;
  summary: string | null;
  cover_url: string | null;
  format: string;
  visibility: string;
  featured: boolean;
  status: string;
  certificate_hours: number;
  venues: { name: string; city: string } | null;
  event_dates: { starts_at: string; ends_at: string }[];
};

export type EventFull = EventCard & {
  description: string | null;
  published_at: string | null;
  updated_at: string;
  venues: { name: string; address: string; city: string; maps_url: string | null; parking_info: string | null } | null;
  event_dates: { id: string; starts_at: string; ends_at: string; label: string | null; capacity: number }[];
  speakers: { name: string; bio: string | null; photo_url: string | null; sort: number }[];
};

function buildClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// Falha de rede no build não derruba o site: a vitrine carrega os dados no navegador.
export async function getPublishedEvents(): Promise<EventCard[]> {
  const db = buildClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("events")
      .select(EVENT_CARD_SELECT)
      .in("status", ["published", "closed"])
      .neq("visibility", "private")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as EventCard[];
  } catch (e) {
    console.warn("[build] eventos indisponíveis:", (e as Error).message);
    return [];
  }
}

export async function getEventBySlug(slug: string): Promise<EventFull | null> {
  const db = buildClient();
  if (!db) return null;
  try {
    const { data } = await db.from("events").select(EVENT_FULL_SELECT).eq("slug", slug).maybeSingle();
    return (data as unknown as EventFull) ?? null;
  } catch {
    return null;
  }
}

export async function getAllEventSlugs(): Promise<string[]> {
  const db = buildClient();
  if (!db) return [];
  try {
    const { data } = await db.from("events").select("slug").in("status", ["published", "closed"]);
    return (data ?? []).map((e) => e.slug);
  } catch {
    return [];
  }
}

export function nextDate(e: Pick<EventCard, "event_dates">) {
  const now = Date.now();
  const sorted = [...e.event_dates].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return sorted.find((d) => new Date(d.ends_at).getTime() > now) ?? sorted[sorted.length - 1] ?? null;
}

export function isUpcoming(e: Pick<EventCard, "event_dates" | "status">) {
  return e.status === "published" && e.event_dates.some((d) => new Date(d.ends_at).getTime() > Date.now());
}

export const KIND_LABEL: Record<string, string> = {
  free_course: "Curso gratuito para associados",
  paid: "Evento pago",
  open_free: "Gratuito aberto",
};

export const FORMAT_LABEL: Record<string, string> = {
  in_person: "Presencial",
  online: "Online",
  hybrid: "Híbrido",
};
