"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin-page";
import { Alert, Badge, ButtonLink, Empty, Spinner, Stat, Tabs, statusTone } from "@/components/ui";
import { hasAnyRole } from "@/lib/auth";
import { dateShort, moneyPlain, STATUS_LABEL, time } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  kind: string;
  cover_url: string | null;
  first_date: string | null;
  last_date: string | null;
  capacity: number;
  registered: number;
  checked_in: number;
  waitlist: number;
  revenue: number;
};

export function AdminHome() {
  return (
    <AdminPage title="Meus eventos">
      {(user) => <Content canCreate={hasAnyRole(user, ["organizer"])} />}
    </AdminPage>
  );
}

function Content({ canCreate }: { canCreate: boolean }) {
  const { data, error } = useLoad<Row[]>(() => getSupabase().rpc("admin_events"), []);
  const [tab, setTab] = useState<"next" | "draft" | "closed">("next");
  const [now] = useState(() => Date.now());
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const next = data.filter((e) => e.status === "published" && (!e.last_date || new Date(e.last_date).getTime() > now));
  const drafts = data.filter((e) => e.status === "draft");
  const closed = data.filter((e) => !next.includes(e) && !drafts.includes(e));
  const list = tab === "next" ? next : tab === "draft" ? drafts : closed;
  const sum = (k: keyof Row) => next.reduce((s, e) => s + Number(e[k] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {canCreate && (
        <div className="grid gap-3 sm:grid-cols-3">
          <ButtonLink href="/admin/eventos/novo/?tipo=free_course">+ Curso gratuito para associados</ButtonLink>
          <ButtonLink href="/admin/eventos/novo/?tipo=paid" variant="secondary">+ Evento pago</ButtonLink>
          <ButtonLink href="/admin/eventos/novo/?tipo=open_free" variant="secondary">+ Evento gratuito aberto</ButtonLink>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Eventos ativos" value={next.length} />
        <Stat label="Inscritos (ativos)" value={sum("registered")} hint={`de ${sum("capacity")} vagas`} />
        <Stat label="Lista de espera" value={sum("waitlist")} />
        <Stat label="Vendas (ativos)" value={moneyPlain(sum("revenue"))} />
      </div>
      <Tabs
        tabs={[
          { id: "next", label: `Próximos (${next.length})` },
          { id: "draft", label: `Rascunhos (${drafts.length})` },
          { id: "closed", label: `Encerrados (${closed.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!list.length && <Empty>Nenhum evento aqui.</Empty>}
      <ul className="flex flex-col gap-3">
        {list.map((e) => {
          const pct = e.capacity ? Math.round((e.registered / e.capacity) * 100) : 0;
          return (
            <li key={e.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status]}</Badge>
                  {e.first_date && <span className="text-xs font-semibold text-muted">{dateShort(e.first_date)} · {time(e.first_date)}</span>}
                </div>
                <Link href={`/admin/evento/?id=${e.id}`} className="mt-1 block font-bold hover:text-brand">{e.title}</Link>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 w-40 overflow-hidden rounded-full bg-bg" aria-hidden>
                    <div className="h-full bg-accent-strong" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted">
                    {e.registered}/{e.capacity} inscritos · {e.checked_in} check-ins{e.waitlist ? ` · ${e.waitlist} na espera` : ""}
                  </span>
                </div>
              </div>
              <ButtonLink href={`/admin/evento/?id=${e.id}`} variant="secondary">Gerenciar</ButtonLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
