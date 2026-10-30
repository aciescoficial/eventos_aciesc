"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { Alert, Badge, Button, Card, Checkbox, Empty, Select, Spinner, Stat, Tabs, TextInput, cx, statusTone } from "@/components/ui";
import { hasAnyRole } from "@/lib/auth";
import { downloadCsv, toCsv } from "@/lib/csv";
import { dateShort, dateTime, errorMessage, STATUS_LABEL, time, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

export type DoorRow = {
  ticket_id: string;
  code: string;
  sig: string;
  name: string;
  status: string;
  order_status: string;
  type: string;
  tier: string;
  cpf_masked: string;
  email: string | null;
  phone: string | null;
  creci: string | null;
  company: string | null;
  city: string | null;
  presence_confirmed: boolean | null;
  in_at: string | null;
  out_at: string | null;
  person_id: string;
};

type DateInfo = { id: string; starts_at: string; ends_at: string; label: string | null; events: { id: string; title: string; rules: Record<string, boolean> } };

const RESULT: Record<string, { text: string; tone: "green" | "red" | "yellow" }> = {
  ok: { text: "Liberado", tone: "green" },
  already_used: { text: "Já utilizado", tone: "red" },
  pending_payment: { text: "Pagamento pendente", tone: "yellow" },
  other_event: { text: "Ingresso de outro evento/data", tone: "red" },
  invalid: { text: "Ingresso inválido", tone: "red" },
  cancelled: { text: "Ingresso cancelado", tone: "red" },
  no_checkin: { text: "Sem check-in de entrada", tone: "yellow" },
};

export function Participants() {
  const dateId = useSearchParams().get("d") ?? "";
  const info = useLoad<DateInfo>(() => getSupabase().from("event_dates").select("id,starts_at,ends_at,label,events(id,title,rules)").eq("id", dateId).single(), [dateId]);
  const list = useLoad<DoorRow[]>(() => getSupabase().rpc("door_list", { p_event_date_id: dateId }), [dateId]);
  const [tab, setTab] = useState<"checkin" | "waitlist" | "badges">("checkin");

  return (
    <AdminPage title={info.data ? `${info.data.events.title}` : "Participantes"} roles={["organizer", "finance"]}>
      {(user) => {
        if (list.error) return <Alert>{list.error}</Alert>;
        if (!info.data || !list.data) return <Spinner />;
        const manage = hasAnyRole(user, ["organizer"]);
        return (
          <div className="flex flex-col gap-6">
            <p className="-mt-4 text-muted print:hidden">
              {info.data.label ? `${info.data.label} · ` : ""}{dateShort(info.data.starts_at)} · {time(info.data.starts_at)} ·{" "}
              <Link href={`/admin/evento/?id=${info.data.events.id}`} className="font-semibold text-brand">voltar ao evento</Link>
            </p>
            <div className="print:hidden">
              <Tabs
                tabs={[
                  { id: "checkin", label: "Check-in" },
                  { id: "waitlist", label: "Lista de espera" },
                  { id: "badges", label: "Crachás e etiquetas" },
                ]}
                value={tab}
                onChange={setTab}
              />
            </div>
            {tab === "checkin" && <Checkin rows={list.data} dateId={dateId} manage={manage} requireOut={!!info.data.events.rules.require_checkout} reload={list.reload} title={info.data.events.title} />}
            {tab === "waitlist" && <Waitlist dateId={dateId} manage={manage} />}
            {tab === "badges" && <Badges rows={list.data.filter((r) => r.status !== "cancelled")} title={info.data.events.title} />}
          </div>
        );
      }}
    </AdminPage>
  );
}

function Checkin({ rows, dateId, manage, requireOut, reload, title }: { rows: DoorRow[]; dateId: string; manage: boolean; requireOut: boolean; reload: () => void; title: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "in" | "not_in" | "unconfirmed">("all");
  const [kind, setKind] = useState<"in" | "out">("in");
  const [scan, setScan] = useState("");
  const [last, setLast] = useState<{ result: string; name?: string; at?: string } | null>(null);
  const [usbMode, setUsbMode] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Leitor USB: mantém o foco no campo de leitura.
  useEffect(() => {
    if (!usbMode) return;
    const t = setInterval(() => {
      if (document.activeElement !== scanRef.current) scanRef.current?.focus();
    }, 500);
    return () => clearInterval(t);
  }, [usbMode]);

  async function doCheckin(payload: string, k: "in" | "out" = kind) {
    const { data, error } = await getSupabase().rpc("checkin", { p_payload: payload, p_event_date_id: dateId, p_kind: k, p_device_id: "painel" });
    if (error) return setLast({ result: "invalid", name: errorMessage(error) });
    setLast(data as { result: string; name?: string; at?: string });
    reload();
  }

  async function undo(ticketId: string, k: "in" | "out") {
    if (!confirm("Desfazer este check-in?")) return;
    const { error } = await getSupabase().rpc("undo_checkin", { p_ticket_id: ticketId, p_kind: k });
    if (error) alert(errorMessage(error));
    reload();
  }

  const term = q.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      r.status !== "cancelled" &&
      (!term || `${r.name} ${r.email ?? ""} ${r.code} ${r.creci ?? ""} ${r.cpf_masked}`.toLowerCase().includes(term)) &&
      (filter === "all" || (filter === "in" && r.in_at) || (filter === "not_in" && !r.in_at) || (filter === "unconfirmed" && r.presence_confirmed === null)),
  );
  const active = rows.filter((r) => r.status !== "cancelled");
  const checked = active.filter((r) => r.in_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Inscritos" value={active.length} />
        <Stat label="Check-in" value={checked} hint={active.length ? `${Math.round((checked / active.length) * 100)}%` : undefined} />
        <Stat label="Confirmaram" value={active.filter((r) => r.presence_confirmed).length} />
        <Stat label="Saída" value={active.filter((r) => r.out_at).length} />
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <form
            className="flex min-w-64 flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (scan.trim()) doCheckin(scan.trim());
              setScan("");
            }}
          >
            <div className="flex-1">
              <TextInput ref={scanRef} label="Leitor de QR (USB) ou código" value={scan} onChange={(e) => setScan(e.target.value)} autoComplete="off" hint="O leitor digita o código e envia Enter." />
            </div>
            <Button type="submit">Registrar</Button>
          </form>
          {requireOut && (
            <Select label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as "in" | "out")}>
              <option value="in">Entrada</option>
              <option value="out">Saída</option>
            </Select>
          )}
        </div>
        <Checkbox label="Modo leitor USB (mantém o foco no campo)" checked={usbMode} onChange={(e) => setUsbMode(e.target.checked)} />
        {last && (
          <div className={cx("rounded-xl p-4 text-lg font-bold", RESULT[last.result]?.tone === "green" ? "bg-tint text-brand" : RESULT[last.result]?.tone === "yellow" ? "bg-pending-bg text-pending-fg" : "bg-error-bg text-error-fg")} role="status">
            {RESULT[last.result]?.text ?? last.result} {last.name && `· ${last.name}`} {last.at && `· ${time(last.at)}`}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1"><TextInput label="Buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, e-mail, CPF, CRECI, código" /></div>
        <Select label="Filtro" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Todos</option>
          <option value="not_in">Sem check-in</option>
          <option value="in">Com check-in</option>
          <option value="unconfirmed">Não confirmaram presença</option>
        </Select>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(`participantes-${title}.csv`, toCsv(active, [
              { key: "name", label: "Nome" }, { key: "cpf_masked", label: "CPF" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Telefone" },
              { key: "creci", label: "CRECI" }, { key: "type", label: "Ingresso" }, { key: "tier", label: "Perfil" }, { key: "code", label: "Código" },
              { key: "presence_confirmed", label: "Confirmou" }, { key: "in_at", label: "Entrada" }, { key: "out_at", label: "Saída" },
            ]))
          }
        >
          Exportar CSV
        </Button>
      </div>
      {!visible.length ? (
        <Empty>Ninguém encontrado.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((r) => (
            <li key={r.ticket_id} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {r.name} <Badge tone="gray">{TIER_LABEL[r.tier]}</Badge>{" "}
                  {r.order_status === "pending" && <Badge tone="yellow">Pagamento pendente</Badge>}
                  {r.presence_confirmed === true && <Badge tone="green">Confirmou</Badge>}
                  {r.presence_confirmed === false && <Badge tone="red">Não vai</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {r.type} · {r.cpf_masked} · {r.email} · <span className="font-mono">{r.code}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.in_at ? (
                  <>
                    <Badge tone="green">Entrada {time(r.in_at)}</Badge>
                    {manage && <Button variant="ghost" onClick={() => undo(r.ticket_id, "in")}>Desfazer</Button>}
                  </>
                ) : (
                  <Button onClick={() => doCheckin(r.code, "in")} disabled={r.order_status !== "paid"}>Check-in</Button>
                )}
                {requireOut && r.in_at && (r.out_at ? <Badge tone="gray">Saída {time(r.out_at)}</Badge> : <Button variant="secondary" onClick={() => doCheckin(r.code, "out")}>Saída</Button>)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type W = { id: string; name: string; email: string | null; phone: string | null; status: string; created_at: string; offered_at: string | null; expires_at: string | null; absences: number };

function Waitlist({ dateId, manage }: { dateId: string; manage: boolean }) {
  const w = useLoad<W[]>(() => getSupabase().rpc("waitlist_list", { p_event_date_id: dateId }), [dateId]);
  const [msg, setMsg] = useState<string | null>(null);
  if (w.error) return <Alert>{w.error}</Alert>;
  if (!w.data) return <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      {msg && <Alert tone="info">{msg}</Alert>}
      {manage && (
        <div>
          <Button
            onClick={async () => {
              const { data, error } = await getSupabase().rpc("offer_waitlist_seat", { p_event_date_id: dateId });
              setMsg(error ? errorMessage(error) : data ? `${data} vaga(s) oferecida(s).` : "Não há vagas livres no momento.");
              w.reload();
            }}
          >
            Oferecer vagas livres
          </Button>
        </div>
      )}
      {!w.data.length ? (
        <Empty>Lista de espera vazia.</Empty>
      ) : (
        <ol className="flex flex-col gap-2">
          {w.data.map((x, i) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3">
              <span>
                <strong>{i + 1}. {x.name}</strong> <span className="text-sm text-muted">{x.email} · {x.phone} · entrou {dateTime(x.created_at)}</span>
                {x.absences > 0 && <span className="ml-2"><Badge tone="yellow">{x.absences} falta(s) no semestre</Badge></span>}
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={statusTone(x.status)}>{STATUS_LABEL[x.status]}</Badge>
                {x.status === "offered" && <span className="text-xs text-muted">até {dateTime(x.expires_at)}</span>}
                {manage && ["waiting", "offered"].includes(x.status) && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await getSupabase().from("waitlist").update({ status: "removed" }).eq("id", x.id);
                      w.reload();
                    }}
                  >
                    Remover
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const LAYOUTS = {
  a4_10: { label: "A4 · 10 por folha", cols: 2, rows: 5, page: "A4" },
  a4_16: { label: "A4 · 16 por folha", cols: 2, rows: 8, page: "A4" },
  a4_21: { label: "A4 · 21 por folha", cols: 3, rows: 7, page: "A4" },
  a6: { label: "A6 · 1 por folha", cols: 1, rows: 1, page: "A6" },
  thermal: { label: "Térmica 90×29 mm", cols: 1, rows: 1, page: "90mm 29mm" },
} as const;

const LINE_FIELDS = [
  ["name", "Nome"],
  ["company", "Empresa/imobiliária"],
  ["creci", "CRECI"],
  ["city", "Cidade"],
  ["type", "Tipo de ingresso"],
  ["tier", "Perfil"],
  ["event", "Nome do evento"],
] as const;

function Badges({ rows, title }: { rows: DoorRow[]; title: string }) {
  const [layout, setLayout] = useState<keyof typeof LAYOUTS>("a4_10");
  const [lines, setLines] = useState<string[]>(["name", "company", "creci"]);
  const L = LAYOUTS[layout];
  const pages = useMemo(() => {
    const per = L.cols * L.rows;
    const out: DoorRow[][] = [];
    for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
    return out;
  }, [rows, L]);
  const value = (r: DoorRow, f: string) =>
    f === "event" ? title : f === "tier" ? TIER_LABEL[r.tier] : f === "creci" && r.creci ? `CRECI ${r.creci}` : String((r as Record<string, unknown>)[f] ?? "");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Formato" value={layout} onChange={(e) => setLayout(e.target.value as keyof typeof LAYOUTS)}>
            {Object.entries(LAYOUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-sm font-semibold">Linhas do crachá (na ordem marcada)</legend>
          {LINE_FIELDS.map(([f, l]) => (
            <Checkbox key={f} label={l} checked={lines.includes(f)} onChange={(e) => setLines(e.target.checked ? [...lines, f] : lines.filter((x) => x !== f))} />
          ))}
        </fieldset>
        <div><Button onClick={() => window.print()}>Imprimir / salvar PDF ({rows.length})</Button></div>
      </Card>
      <style>{`@media print { @page { size: ${L.page}; margin: ${layout === "thermal" ? "0" : "8mm"} } }`}</style>
      <div className="flex flex-col gap-4 print:gap-0">
        {pages.map((p, i) => (
          <div
            key={i}
            className="grid gap-2 bg-white p-2 shadow print:break-after-page print:shadow-none"
            style={{ gridTemplateColumns: `repeat(${L.cols}, 1fr)`, gridAutoRows: layout.startsWith("a4") ? `calc((297mm - 16mm - ${(L.rows - 1) * 2}mm) / ${L.rows})` : layout === "a6" ? "140mm" : "27mm" }}
          >
            {p.map((r) => (
              <div key={r.ticket_id} className="flex flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-line p-2 text-center print:border-line">
                {lines.map((f, j) => {
                  const v = value(r, f);
                  if (!v) return null;
                  return (
                    <p key={f} className={j === 0 ? (layout === "thermal" ? "text-base font-extrabold leading-tight" : "text-xl font-extrabold leading-tight") : "text-sm text-muted"}>
                      {v}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
