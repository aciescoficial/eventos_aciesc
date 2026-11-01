"use client";

// Tela "A · Início — meus eventos" do protótipo aprovado, com dados reais.
import { useState } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin-page";
import { Alert, Spinner } from "@/components/ui";
import { hasAnyRole, type CurrentUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  kind: "free_course" | "paid" | "open_free";
  format: "in_person" | "online" | "hybrid";
  venue_name: string | null;
  venue_city: string | null;
  first_date: string | null;
  last_date: string | null;
  capacity: number;
  registered: number;
  checked_in: number;
  presence_pending: number;
  waitlist: number;
  revenue: number;
};

type Funnel = { associate: number; adept: number; expired: number; other: number };

const TZ = "America/Sao_Paulo";

const KIND: Record<Row["kind"], { label: string; cls: string }> = {
  free_course: { label: "Curso gratuito · associados", cls: "bg-mist text-pine-dark" },
  paid: { label: "Evento pago", cls: "bg-rule-soft text-text-2" },
  open_free: { label: "Gratuito aberto", cls: "bg-rule-soft text-text-2" },
};

const TYPE_FILTER: { value: "" | Row["kind"]; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "free_course", label: "Cursos gratuitos para associados" },
  { value: "paid", label: "Eventos pagos" },
  { value: "open_free", label: "Eventos gratuitos abertos" },
];

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

// "25/11/2026 · 19h"
function when(iso: string | null) {
  if (!iso) return "Data a definir";
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(d);
  const hour = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d).replace(":", "h").replace(/h00$/, "h");
  return `${day} · ${hour}`;
}

function where(e: Row) {
  if (e.format === "online") return "Online";
  if (!e.venue_name) return "Local a definir";
  return e.venue_city ? `${e.venue_name} · ${e.venue_city}` : e.venue_name;
}

const n = (v: number) => Number(v ?? 0).toLocaleString("pt-BR");

export function AdminHome() {
  return <AdminPage>{(user) => <Content user={user} />}</AdminPage>;
}

function Content({ user }: { user: CurrentUser }) {
  const canCreate = hasAnyRole(user, ["organizer"]);
  const events = useLoad<Row[]>(() => getSupabase().rpc("admin_events"), []);
  const base = useLoad<{ total: number; funnel: Funnel }>(
    () => getSupabase().rpc("base_people", { p_limit: 0, p_offset: 0 }),
    [],
  );
  const [tab, setTab] = useState<"next" | "draft" | "done">("next");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | Row["kind"]>("");
  const [now] = useState(() => Date.now());

  if (events.error) return <Alert>{events.error}</Alert>;
  if (!events.data) return <Spinner />;

  const data = events.data;
  const isNext = (e: Row) => e.status === "published" && (!e.last_date || new Date(e.last_date).getTime() > now);
  const groups = {
    next: data.filter(isNext).sort((a, b) => (a.first_date ?? "").localeCompare(b.first_date ?? "")),
    draft: data.filter((e) => e.status === "draft"),
    done: data.filter((e) => !isNext(e) && e.status !== "draft"),
  };
  const next = groups.next;
  const sum = (k: keyof Row) => next.reduce((s, e) => s + Number(e[k] ?? 0), 0);
  const pendingEvent = next.find((e) => e.presence_pending > 0);
  const q = query.trim().toLowerCase();
  const rows = groups[tab].filter((e) => (!type || e.kind === type) && (!q || e.title.toLowerCase().includes(q)));

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "next", label: `Próximos (${groups.next.length})` },
    { id: "draft", label: `Rascunhos (${groups.draft.length})` },
    { id: "done", label: `Encerrados (${groups.done.length})` },
  ];

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-rule bg-white p-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-extrabold">{greeting()}, ACIESC!</h1>
          <span className="text-[15px] text-text-3">O que vamos publicar hoje?</span>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2.5">
            <Link href="/admin/eventos/novo/?tipo=free_course" className="btn-lime">
              + Curso gratuito para associados
            </Link>
            <Link href="/admin/eventos/novo/?tipo=paid&formato=in_person" className="btn-outline">
              Evento presencial
            </Link>
            <Link href="/admin/eventos/novo/?tipo=paid&formato=online" className="btn-outline">
              Evento online
            </Link>
          </div>
        )}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Kpi label="Próximos eventos" value={n(next.length)}>
          {n(next.filter((e) => e.kind === "free_course").length)} cursos gratuitos
        </Kpi>
        <Kpi label="Inscrições abertas" value={n(sum("registered"))}>
          + {n(sum("waitlist"))} na lista de espera
        </Kpi>
        <Kpi label="Aguardando confirmar presença" value={n(sum("presence_pending"))} amber={sum("presence_pending") > 0}>
          {pendingEvent ? `${pendingEvent.title.slice(0, 40)} · lembrete enviado` : "Nenhuma confirmação pendente"}
        </Kpi>
        <Kpi label="Base ACIESC" value={base.data ? n(base.data.total) : "…"}>
          <Link href="/admin/base/" className="text-pine hover:text-pine-dark">
            {base.data ? `${n(base.data.funnel.associate)} associados · ${n(base.data.funnel.adept)} adeptos` : "Ver base"}
          </Link>
        </Kpi>
      </div>

      <section aria-labelledby="meus" className="overflow-hidden rounded-2xl border border-rule bg-white">
        <div className="flex flex-col gap-3.5 px-5 pt-[18px]">
          <h2 id="meus" className="text-xl font-extrabold">Meus eventos</h2>
          <div role="tablist" aria-label="Situação" className="flex flex-wrap gap-1 border-b border-rule">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={
                  "-mb-px min-h-11 cursor-pointer border-b-[3px] px-3.5 py-3 text-sm font-semibold " +
                  (tab === t.id ? "border-pine text-pine" : "border-transparent text-text-3")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pb-4">
            <label className="flex min-h-11 flex-[1_1_260px] items-center gap-2.5 rounded-[10px] border border-field px-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#55625D" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="sr-only">Buscar evento</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pelo nome do evento"
                className="min-w-0 flex-1 border-0 text-sm outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Tipo
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="min-h-11 rounded-[10px] border border-field bg-white p-2.5 text-sm"
              >
                {TYPE_FILTER.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-panel-row text-left text-xs tracking-[.06em] text-text-3 uppercase">
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="p-3">Evento</th>
                <th scope="col" className="p-3">Quando</th>
                <th scope="col" className="p-3">Onde</th>
                <th scope="col" className="p-3">Inscritos</th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <EventRow key={e.id} e={e} done={tab === "done"} />
              ))}
              {!rows.length && (
                <tr className="border-t border-rule-soft">
                  <td colSpan={6} className="px-5 py-10 text-center text-text-3">
                    Nenhum evento aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, amber, children }: { label: string; value: string; amber?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-rule bg-white p-[18px]">
      <span className="text-[13px] font-semibold text-text-3">{label}</span>
      <span className={"text-[26px] font-extrabold " + (amber ? "text-amber" : "")}>{value}</span>
      <span className="text-[13px] text-text-2">{children}</span>
    </div>
  );
}

function EventRow({ e, done }: { e: Row; done: boolean }) {
  const status =
    e.status === "draft"
      ? { label: "Rascunho", dot: "#9AA6A1" }
      : e.status === "cancelled"
        ? { label: "Cancelado", dot: "#B42318" }
        : done
          ? { label: "Encerrado", dot: "#9AA6A1" }
          : { label: "Inscrições abertas", dot: "#256958" };
  const cap = Number(e.capacity ?? 0);
  const sold = Number(e.registered ?? 0);
  const pct = cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
  const soldOut = cap > 0 && sold >= cap;
  const extra = done
    ? `${n(e.checked_in)} presentes`
    : [soldOut ? "Esgotado" : "", e.waitlist ? `${n(e.waitlist)} na lista de espera` : ""].filter(Boolean).join(" · ");
  const kind = KIND[e.kind];

  return (
    <tr className="border-t border-rule-soft hover:bg-panel-row">
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-[9px] rounded-full" style={{ background: status.dot }} />
          {status.label}
        </span>
      </td>
      <td className="max-w-[320px] px-3 py-3.5">
        <div className="flex flex-col gap-1">
          <strong className="leading-[1.35]">{e.title}</strong>
          <span className={"self-start rounded-full px-[9px] py-[3px] text-xs font-bold " + kind.cls}>{kind.label}</span>
        </div>
      </td>
      <td className="px-3 py-3.5 whitespace-nowrap">{when(e.first_date)}</td>
      <td className="px-3 py-3.5">{where(e)}</td>
      <td className="min-w-[170px] px-3 py-3.5">
        <div className="flex flex-col gap-[5px]">
          <span className="text-[13px]">
            <strong>{n(sold)}</strong> de {n(cap)}
          </span>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-rule-soft">
            <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
          </div>
          {extra && <span className="text-xs text-text-3">{extra}</span>}
        </div>
      </td>
      <td className="px-5 py-3.5 text-right whitespace-nowrap">
        <Link
          href={`/admin/evento/?id=${e.id}`}
          className="inline-block rounded-full border border-pine px-4 py-[9px] text-[13px] font-bold text-pine hover:bg-mist"
        >
          Gerenciar
        </Link>{" "}
        <Link href={`/e/${e.slug}/`} aria-label="Ver página pública" className="inline-flex p-2 align-middle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#256958" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </Link>
      </td>
    </tr>
  );
}
