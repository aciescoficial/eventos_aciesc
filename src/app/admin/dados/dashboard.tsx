"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin-page";
import { Alert, Button, Card, Empty, Spinner, Stat, TextInput } from "@/components/ui";
import { downloadCsv, toCsv } from "@/lib/csv";
import { errorMessage, moneyPlain, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Dash = {
  registrations: number; free: number; paid: number; checked_in: number; certificates: number; hours: number; revenue: number;
  by_tier: Record<string, number>; by_event: { title: string; registered: number; present: number }[];
  by_device: Record<string, number>; by_hour: Record<string, number>;
  by_source: { source: string; medium: string | null; campaign: string | null; n: number }[];
  ranking: { person_id: string; name: string; attended: number }[]; associates_never: number;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function Dashboard() {
  return <AdminPage title="Dados">{() => <Content />}</AdminPage>;
}

function Content() {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
  });
  const res = useLoad<Dash>(() => getSupabase().rpc("admin_dashboard", { p_from: period.from, p_to: period.to }), [period]);
  const [msg, setMsg] = useState<string | null>(null);

  async function exportNever() {
    const { data, error } = await getSupabase().rpc("base_people", { p_tier: "associate", p_participation: "never", p_limit: 500, p_offset: 0 });
    if (error) return setMsg(errorMessage(error));
    downloadCsv("associados-nunca-participaram.csv", toCsv((data as unknown as { rows: Record<string, unknown>[] }).rows, [
      { key: "full_name", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Telefone" }, { key: "creci", label: "CRECI" }, { key: "city", label: "Cidade" },
    ]));
  }

  const d = res.data;
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-end gap-3">
        <TextInput label="De" type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
        <TextInput label="Até" type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
      </Card>
      {(res.error || msg) && <Alert>{res.error ?? msg}</Alert>}
      {!d ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Inscrições" value={d.registrations} hint={`${d.free} gratuitas · ${d.paid} pagas`} />
            <Stat label="Comparecimento" value={d.registrations ? `${Math.round((d.checked_in / d.registrations) * 100)}%` : "—"} hint={`${d.checked_in} check-ins`} />
            <div id="certificados" className="scroll-mt-6"><Stat label="Certificados" value={d.certificates} /></div>
            <Stat label="Horas certificadas" value={`${Number(d.hours)}h`} />
            <div id="financeiro" className="scroll-mt-6"><Stat label="Receita" value={moneyPlain(d.revenue)} /></div>
            <Stat label="Associados que nunca vieram" value={d.associates_never} hint={<button type="button" className="font-semibold text-brand underline" onClick={exportNever}>Exportar</button>} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-extrabold">Inscritos × presentes por evento</h2>
              {!d.by_event.length ? <Empty>Sem dados no período.</Empty> : (
                <ul className="flex flex-col gap-3">
                  {d.by_event.map((e) => {
                    const max = Math.max(...d.by_event.map((x) => x.registered), 1);
                    return (
                      <li key={e.title}>
                        <p className="text-sm font-semibold">{e.title}</p>
                        <div className="mt-1 flex flex-col gap-1">
                          <Bar value={e.registered} max={max} label={`${e.registered} inscritos`} cls="bg-green-600" />
                          <Bar value={e.present} max={max} label={`${e.present} presentes`} cls="bg-accent-strong" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 font-extrabold">Origem das inscrições (UTM)</h2>
              {!d.by_source.length ? <Empty>Sem dados.</Empty> : (
                <BarList items={d.by_source.map((s) => ({ label: [s.source, s.medium, s.campaign].filter(Boolean).join(" · "), n: s.n }))} />
              )}
            </Card>
            <Card>
              <h2 className="mb-3 font-extrabold">Por perfil</h2>
              <BarList items={Object.entries(d.by_tier).map(([k, n]) => ({ label: TIER_LABEL[k] ?? k, n }))} />
            </Card>
            <Card>
              <h2 className="mb-3 font-extrabold">Aparelho</h2>
              <BarList items={Object.entries(d.by_device).map(([k, n]) => ({ label: k, n }))} />
            </Card>
            <Card>
              <h2 className="mb-3 font-extrabold">Horário de pico das inscrições</h2>
              <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Inscrições por hora do dia">
                {Array.from({ length: 24 }, (_, h) => {
                  const n = d.by_hour[String(h)] ?? 0;
                  const max = Math.max(...Object.values(d.by_hour), 1);
                  return <div key={h} title={`${h}h: ${n}`} className="flex-1 rounded-t bg-green-600" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 2 : 0 }} />;
                })}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted"><span>0h</span><span>12h</span><span>23h</span></div>
            </Card>
            <Card>
              <h2 className="mb-3 font-extrabold">Ranking de participação</h2>
              {!d.ranking.length ? <Empty>Sem dados.</Empty> : (
                <ol className="flex flex-col gap-1 text-sm">
                  {d.ranking.map((r, i) => (
                    <li key={r.person_id}>
                      {i + 1}. <Link href={`/admin/pessoa/?id=${r.person_id}`} className="font-semibold hover:text-brand">{r.name}</Link> · {r.attended} presença(s)
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
          <div>
            <Button variant="secondary" onClick={() => downloadCsv("dados-por-evento.csv", toCsv(d.by_event, [{ key: "title", label: "Evento" }, { key: "registered", label: "Inscritos" }, { key: "present", label: "Presentes" }]))}>
              Exportar por evento (CSV)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Bar({ value, max, label, cls }: { value: number; max: number; label: string; cls: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
        <div className={`h-full ${cls}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-28 text-xs text-muted">{label}</span>
    </div>
  );
}

function BarList({ items }: { items: { label: string; n: number }[] }) {
  if (!items.length) return <Empty>Sem dados.</Empty>;
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.label}>
          <p className="text-sm">{i.label}</p>
          <Bar value={i.n} max={max} label={String(i.n)} cls="bg-green-600" />
        </li>
      ))}
    </ul>
  );
}
