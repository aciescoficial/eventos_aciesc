"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { Alert, Badge, Button, ButtonLink, Card, Checkbox, Empty, Select, Spinner, Stat, Tabs, TextArea, TextInput, statusTone } from "@/components/ui";
import { hasAnyRole, type CurrentUser } from "@/lib/auth";
import { downloadCsv, toCsv } from "@/lib/csv";
import { dateShort, dateTime, errorMessage, money, moneyPlain, STATUS_LABEL, time, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Tab = "overview" | "tickets" | "comms" | "certs" | "promo" | "finance";
type Ev = {
  id: string;
  slug: string;
  title: string;
  status: string;
  kind: string;
  visibility: string;
  certificate_hours: number;
  rules: Record<string, boolean | number>;
  event_dates: { id: string; starts_at: string; ends_at: string; label: string | null; capacity: number }[];
};

export function EventPanel() {
  const id = useSearchParams().get("id") ?? "";
  const ev = useLoad<Ev>(() => getSupabase().from("events").select("id,slug,title,status,kind,visibility,certificate_hours,rules,event_dates(id,starts_at,ends_at,label,capacity)").eq("id", id).single(), [id]);
  const [tab, setTab] = useState<Tab>("overview");
  const e = ev.data;

  return (
    <AdminPage
      title={e ? e.title : "Evento"}
      actions={
        e && (
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status]}</Badge>
            <ButtonLink href={e.status === "draft" ? `/evento/?s=${e.slug}` : `/e/${e.slug}/`} variant="secondary">Ver página</ButtonLink>
            <ButtonLink href={`/admin/eventos/novo/?id=${e.id}`} variant="secondary">Editar</ButtonLink>
          </div>
        )
      }
    >
      {(user) => {
        if (ev.error) return <Alert>{ev.error}</Alert>;
        if (!e) return <Spinner />;
        const manage = hasAnyRole(user, ["organizer"]);
        return (
          <div className="flex flex-col gap-6">
            <Tabs
              tabs={[
                { id: "overview", label: "Visão geral" },
                { id: "tickets", label: "Ingressos e lotes" },
                { id: "comms", label: "Comunicação" },
                { id: "certs", label: "Certificados" },
                { id: "promo", label: "Divulgue" },
                { id: "finance", label: "Financeiro" },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "overview" && <Overview e={e} manage={manage} reload={ev.reload} />}
            {tab === "tickets" && <TicketsTab e={e} manage={manage} />}
            {tab === "comms" && <Comms e={e} manage={manage} />}
            {tab === "certs" && <Certs e={e} manage={manage} />}
            {tab === "promo" && <Promo e={e} />}
            {tab === "finance" && <Finance e={e} manage={manage} user={user} />}
          </div>
        );
      }}
    </AdminPage>
  );
}

type DateStats = {
  date_id: string; starts_at: string; ends_at: string; label: string | null; capacity: number; remaining: number;
  registered: number; pending: number; confirmed: number; declined: number; checked_in: number; waitlist: number; offered: number;
  certificates: number; by_tier: Record<string, number>;
};

function Overview({ e, manage, reload }: { e: Ev; manage: boolean; reload: () => void }) {
  const stats = useLoad<DateStats[]>(() => getSupabase().rpc("event_overview", { p_event_id: e.id }), [e.id]);
  const [rules, setRules] = useState(e.rules);
  const [msg, setMsg] = useState<string | null>(null);

  async function setStatus(status: "published" | "closed" | "cancelled" | "draft") {
    if (status === "cancelled" && !confirm("Cancelar o evento? Os inscritos não são avisados automaticamente.")) return;
    const db = getSupabase();
    const { error } = status === "published" ? await db.rpc("publish_event", { p_event_id: e.id }) : await db.from("events").update({ status }).eq("id", e.id);
    setMsg(error ? errorMessage(error) : "Status atualizado.");
    reload();
  }

  async function saveRule(key: string, value: boolean) {
    const next = { ...rules, [key]: value };
    setRules(next);
    const { error } = await getSupabase().from("events").update({ rules: next }).eq("id", e.id);
    if (error) setMsg(errorMessage(error));
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone="info">{msg}</Alert>}
      {stats.error && <Alert>{stats.error}</Alert>}
      {!stats.data ? (
        <Spinner />
      ) : (
        stats.data.map((d) => (
          <Card key={d.date_id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold">
                {d.label ? `${d.label} · ` : ""}{dateShort(d.starts_at)} · {time(d.starts_at)}–{time(d.ends_at)}
              </h2>
              <ButtonLink href={`/admin/participantes/?d=${d.date_id}`}>Participantes e check-in</ButtonLink>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              <Stat label="Inscritos" value={`${d.registered}/${d.capacity}`} hint={`${d.remaining} vagas livres`} />
              <Stat label="Check-in" value={d.checked_in} hint={d.registered ? `${Math.round((d.checked_in / d.registered) * 100)}% de comparecimento` : undefined} />
              <Stat label="Presença confirmada" value={d.confirmed} hint={d.declined ? `${d.declined} não vão` : undefined} />
              <Stat label="Lista de espera" value={d.waitlist} hint={d.offered ? `${d.offered} com vaga oferecida` : undefined} />
              <Stat label="Pagamento pendente" value={d.pending} />
              <Stat label="Certificados" value={d.certificates} />
            </div>
            <p className="text-sm text-muted">
              Por perfil: {Object.entries(d.by_tier).map(([t, n]) => `${TIER_LABEL[t]} ${n}`).join(" · ") || "—"}
            </p>
          </Card>
        ))
      )}
      {manage && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <h2 className="font-extrabold">Regras do curso</h2>
            {(
              [
                ["free_only_active_associates", "Vagas gratuitas só para associados ativos"],
                ["one_per_cpf", "Uma inscrição por CPF"],
                ["confirm_presence_48h", "Confirmação de presença 48h antes"],
                ["release_unconfirmed_24h", "Liberar vagas não confirmadas 24h antes"],
                ["require_checkout", "Exigir check-in de saída para certificado"],
                ["register_absence", "Registrar faltas"],
                ["waitlist_enabled", "Lista de espera"],
              ] as const
            ).map(([k, l]) => (
              <Checkbox key={k} label={l} checked={!!rules[k]} onChange={(ev) => saveRule(k, ev.target.checked)} />
            ))}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-extrabold">Situação do evento</h2>
            <p className="text-sm text-muted">Publicar ativa os lotes e coloca o evento na vitrine (o site é atualizado em alguns minutos).</p>
            <div className="flex flex-wrap gap-2">
              {e.status !== "published" && <Button onClick={() => setStatus("published")}>Publicar</Button>}
              {e.status === "published" && <Button variant="secondary" onClick={() => setStatus("closed")}>Encerrar inscrições</Button>}
              {e.status !== "cancelled" && <Button variant="danger" onClick={() => setStatus("cancelled")}>Cancelar evento</Button>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

type LotRow = { id: string; name: string; base_price: number; quantity: number; status: string; trigger: string; trigger_at: string | null; event_date_id: string; ticket_types: { name: string } };
type Coupon = { id: string; code: string; kind: "percent" | "fixed"; value: number; max_uses: number | null; used: number; valid_until: string | null; active: boolean };

function TicketsTab({ e, manage }: { e: Ev; manage: boolean }) {
  const lots = useLoad<LotRow[]>(
    () => getSupabase().from("lots").select("id,name,base_price,quantity,status,trigger,trigger_at,event_date_id,ticket_types!inner(name,event_id)").eq("ticket_types.event_id", e.id).order("sort"),
    [e.id],
  );
  const coupons = useLoad<Coupon[]>(() => getSupabase().from("coupons").select("*").eq("event_id", e.id).order("code"), [e.id]);
  const [c, setC] = useState({ code: "", kind: "percent" as "percent" | "fixed", value: "", max_uses: "", valid_until: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const dateLabel = (id: string) => {
    const d = e.event_dates.find((x) => x.id === id);
    return d ? d.label || dateShort(d.starts_at) : "";
  };

  async function turn(id: string) {
    if (!confirm("Virar o lote agora? O próximo lote agendado será ativado.")) return;
    const { error } = await getSupabase().rpc("turn_lot", { p_lot_id: id });
    setMsg(error ? errorMessage(error) : "Lote virado.");
    lots.reload();
  }

  async function addCoupon() {
    const { error } = await getSupabase().from("coupons").insert({
      event_id: e.id,
      code: c.code.trim().toUpperCase(),
      kind: c.kind,
      value: Number(c.value),
      max_uses: c.max_uses ? Number(c.max_uses) : null,
      valid_until: c.valid_until ? new Date(`${c.valid_until}T23:59:59-03:00`).toISOString() : null,
    });
    if (error) return setMsg(errorMessage(error));
    setC({ code: "", kind: "percent", value: "", max_uses: "", valid_until: "" });
    coupons.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone="info">{msg}</Alert>}
      <Card>
        <h2 className="mb-3 font-extrabold">Lotes</h2>
        {!lots.data ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr><th className="py-2">Ingresso</th><th>Data</th><th>Lote</th><th>Valor</th><th>Qtd.</th><th>Virada</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {lots.data.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="py-2">{l.ticket_types.name}</td>
                    <td>{dateLabel(l.event_date_id)}</td>
                    <td>{l.name}</td>
                    <td>{money(l.base_price)}</td>
                    <td>{l.quantity}</td>
                    <td>{l.trigger === "date" ? dateTime(l.trigger_at) : l.trigger === "quantity" ? "Ao esgotar" : "Manual"}</td>
                    <td><Badge tone={l.status === "active" ? "green" : l.status === "closed" ? "gray" : "yellow"}>{l.status === "active" ? "Ativo" : l.status === "closed" ? "Encerrado" : "Agendado"}</Badge></td>
                    <td>{manage && l.status === "active" && <Button variant="ghost" onClick={() => turn(l.id)}>Virar lote agora</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="font-extrabold">Cupons</h2>
        {coupons.data?.length ? (
          <ul className="flex flex-col gap-2">
            {coupons.data.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                <span>
                  <strong className="font-mono">{x.code}</strong> · {x.kind === "percent" ? `${Number(x.value)}%` : moneyPlain(x.value)} · usado {x.used}
                  {x.max_uses ? `/${x.max_uses}` : ""} {x.valid_until && `· até ${dateShort(x.valid_until)}`}
                </span>
                {manage && (
                  <Checkbox
                    label="Ativo"
                    checked={x.active}
                    onChange={async (ev) => {
                      await getSupabase().from("coupons").update({ active: ev.target.checked }).eq("id", x.id);
                      coupons.reload();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhum cupom.</Empty>
        )}
        {manage && (
          <div className="grid gap-3 sm:grid-cols-6">
            <TextInput label="Código" value={c.code} onChange={(ev) => setC({ ...c, code: ev.target.value.toUpperCase() })} />
            <Select label="Tipo" value={c.kind} onChange={(ev) => setC({ ...c, kind: ev.target.value as "percent" | "fixed" })}>
              <option value="percent">%</option>
              <option value="fixed">R$</option>
            </Select>
            <TextInput label="Valor" type="number" min={0} value={c.value} onChange={(ev) => setC({ ...c, value: ev.target.value })} />
            <TextInput label="Limite de usos" type="number" min={1} value={c.max_uses} onChange={(ev) => setC({ ...c, max_uses: ev.target.value })} />
            <TextInput label="Válido até" type="date" value={c.valid_until} onChange={(ev) => setC({ ...c, valid_until: ev.target.value })} />
            <div className="flex items-end"><Button onClick={addCoupon} disabled={!c.code || !c.value}>Criar cupom</Button></div>
          </div>
        )}
        <p className="text-xs text-muted">O cupom acumula ou não com o desconto de perfil conforme a configuração geral.</p>
      </Card>
    </div>
  );
}

function Comms({ e, manage }: { e: Ev; manage: boolean }) {
  const [dateId, setDateId] = useState(e.event_dates[0]?.id ?? "");
  const [segment, setSegment] = useState("all");
  const [channels, setChannels] = useState({ email: true, whatsapp: false });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const log = useLoad<{ id: number; channel: string; template: string; to_address: string; status: string; error: string | null; created_at: string; sent_at: string | null }[]>(
    () => getSupabase().from("messages_log").select("id,channel,template,to_address,status,error,created_at,sent_at").eq("event_id", e.id).order("created_at", { ascending: false }).limit(100),
    [e.id],
  );

  async function send() {
    const ch = (Object.entries(channels).filter(([, v]) => v).map(([k]) => k)) as ("email" | "whatsapp")[];
    if (!ch.length) return setMsg({ tone: "error", text: "Escolha ao menos um canal." });
    if (!confirm("Enviar a mensagem para o segmento escolhido?")) return;
    const { data, error } = await getSupabase().rpc("send_segment_message", { p_event_date_id: dateId, p_segment: segment, p_channels: ch, p_subject: subject, p_body: body });
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    setMsg({ tone: "info", text: `${data} pessoa(s) na fila de envio.` });
    setBody("");
    log.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {manage && (
        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-extrabold sm:col-span-2">Enviar mensagem</h2>
          {e.event_dates.length > 1 && (
            <Select label="Data" value={dateId} onChange={(ev) => setDateId(ev.target.value)}>
              {e.event_dates.map((d) => <option key={d.id} value={d.id}>{d.label || dateShort(d.starts_at)}</option>)}
            </Select>
          )}
          <Select label="Para quem" value={segment} onChange={(ev) => setSegment(ev.target.value)}>
            <option value="all">Todos os inscritos</option>
            <option value="unconfirmed">Não confirmaram presença</option>
            <option value="waitlist">Lista de espera</option>
            <option value="present">Presentes (check-in)</option>
            <option value="absent">Faltantes</option>
          </Select>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Canais</span>
            <Checkbox label="E-mail" checked={channels.email} onChange={(ev) => setChannels({ ...channels, email: ev.target.checked })} />
            <Checkbox label="WhatsApp (quando o provedor estiver configurado)" checked={channels.whatsapp} onChange={(ev) => setChannels({ ...channels, whatsapp: ev.target.checked })} />
          </div>
          <TextInput label="Assunto (e-mail)" value={subject} onChange={(ev) => setSubject(ev.target.value)} />
          <div className="sm:col-span-2"><TextArea label="Mensagem" value={body} onChange={(ev) => setBody(ev.target.value)} /></div>
          {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          <div><Button onClick={send} disabled={!body.trim()}>Enviar</Button></div>
        </Card>
      )}
      <Card>
        <h2 className="mb-3 font-extrabold">Histórico de envios</h2>
        {!log.data ? (
          <Spinner />
        ) : !log.data.length ? (
          <Empty>Nenhum envio ainda.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-2">Quando</th><th>Canal</th><th>Modelo</th><th>Destino</th><th>Status</th></tr></thead>
              <tbody>
                {log.data.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="py-2">{dateTime(m.created_at)}</td>
                    <td>{m.channel === "email" ? "E-mail" : "WhatsApp"}</td>
                    <td>{m.template}</td>
                    <td className="max-w-48 truncate">{m.to_address}</td>
                    <td title={m.error ?? undefined}><Badge tone={m.status === "sent" ? "green" : m.status === "queued" ? "yellow" : m.status === "skipped" ? "gray" : "red"}>{({ sent: "Enviado", queued: "Na fila", skipped: "Não enviado", failed: "Falhou" } as Record<string, string>)[m.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Certs({ e, manage }: { e: Ev; manage: boolean }) {
  const certs = useLoad<{ id: string; code: string; person_name: string; hours: number; issued_at: string; revoked_at: string | null; tickets: { event_date_id: string } }[]>(
    () => getSupabase().from("certificates").select("id,code,person_name,hours,issued_at,revoked_at,tickets!inner(event_id,event_date_id)").eq("tickets.event_id", e.id).order("person_name"),
    [e.id],
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function issue(dateId: string) {
    const { data, error } = await getSupabase().rpc("issue_certificates", { p_event_date_id: dateId });
    setMsg(error ? errorMessage(error) : `${data} certificado(s) emitido(s).`);
    certs.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {e.certificate_hours <= 0 && <Alert tone="warn">Este evento está sem carga horária, então não emite certificado. Ajuste em Editar.</Alert>}
      {msg && <Alert tone="info">{msg}</Alert>}
      <Card className="flex flex-col gap-3">
        <h2 className="font-extrabold">Emissão</h2>
        <p className="text-sm text-muted">
          Emitidos automaticamente no dia seguinte às 9h para quem fez check-in{e.rules.require_checkout ? " e check-out" : ""}. Você também pode emitir agora.
        </p>
        {manage && e.certificate_hours > 0 && (
          <div className="flex flex-wrap gap-2">
            {e.event_dates.map((d) => (
              <Button key={d.id} variant="secondary" onClick={() => issue(d.id)}>Emitir agora · {d.label || dateShort(d.starts_at)}</Button>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">Modelo: assinatura e arte de fundo padrão ficam em Configurações.</p>
      </Card>
      <Card>
        {!certs.data ? (
          <Spinner />
        ) : !certs.data.length ? (
          <Empty>Nenhum certificado emitido.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {certs.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {c.person_name} · {Number(c.hours)}h · <span className="font-mono text-xs">{c.code}</span> {c.revoked_at && <Badge tone="red">Revogado</Badge>}
                </span>
                <span className="flex gap-1">
                  <Link href={`/certificado/?c=${c.code}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand">Ver</Link>
                  {manage && !c.revoked_at && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Revogar este certificado?")) return;
                        await getSupabase().from("certificates").update({ revoked_at: new Date().toISOString() }).eq("id", c.id);
                        certs.reload();
                      }}
                    >
                      Revogar
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const CHANNELS = [
  ["instagram", "social", "Instagram"],
  ["whatsapp", "mensagem", "WhatsApp"],
  ["facebook", "social", "Facebook"],
  ["linkedin", "social", "LinkedIn"],
  ["email", "email", "E-mail marketing"],
  ["site", "referencia", "Site ACIESC"],
] as const;

function Promo({ e }: { e: Ev }) {
  const [campaign, setCampaign] = useState(e.slug);
  const [copied, setCopied] = useState<string | null>(null);
  const base = typeof window !== "undefined" ? `${window.location.origin}/e/${e.slug}/` : "";
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-extrabold">Links de divulgação</h2>
      <p className="text-sm text-muted">Cada canal tem um link com UTM; as inscrições aparecem por origem em Dados.</p>
      <div className="max-w-sm"><TextInput label="Campanha" value={campaign} onChange={(ev) => setCampaign(ev.target.value)} /></div>
      <ul className="flex flex-col gap-2">
        {CHANNELS.map(([source, medium, label]) => {
          const url = `${base}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${encodeURIComponent(campaign)}`;
          return (
            <li key={source} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
              <span className="w-36 shrink-0 font-semibold">{label}</span>
              <code className="min-w-0 flex-1 truncate rounded bg-bg px-2 py-1 text-xs">{url}</code>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  setCopied(source);
                }}
              >
                {copied === source ? "Copiado!" : "Copiar"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

type Fin = {
  paid: number; pending: number; cancelled: number; refunded: number;
  orders: { id: string; created_at: string; status: string; total: number; method: string; installments: number; buyer: string; email: string; tickets: number; utm_source: string | null }[];
};

function Finance({ e, manage, user }: { e: Ev; manage: boolean; user: CurrentUser }) {
  const fin = useLoad<Fin>(() => getSupabase().rpc("event_finance", { p_event_id: e.id }), [e.id]);
  const [msg, setMsg] = useState<string | null>(null);
  void user;
  if (fin.error) return <Alert>{fin.error}</Alert>;
  if (!fin.data) return <Spinner />;
  const f = fin.data;
  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone="info">{msg}</Alert>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Vendas confirmadas" value={moneyPlain(f.paid)} />
        <Stat label="Em processamento" value={moneyPlain(f.pending)} />
        <Stat label="Canceladas" value={moneyPlain(f.cancelled)} />
        <Stat label="Reembolsadas" value={moneyPlain(f.refunded)} />
      </div>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold">Pedidos</h2>
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(`pedidos-${e.slug}.csv`, toCsv(f.orders, [
                { key: "created_at", label: "Data" }, { key: "buyer", label: "Comprador" }, { key: "email", label: "E-mail" },
                { key: "status", label: "Status" }, { key: "method", label: "Forma" }, { key: "installments", label: "Parcelas" },
                { key: "total", label: "Total" }, { key: "tickets", label: "Ingressos" }, { key: "utm_source", label: "Origem" },
              ]))
            }
          >
            Exportar CSV
          </Button>
        </div>
        {!f.orders.length ? (
          <Empty>Nenhum pedido.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-2">Data</th><th>Comprador</th><th>Forma</th><th>Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {f.orders.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="py-2">{dateTime(o.created_at)}</td>
                    <td>{o.buyer}<span className="block text-xs text-muted">{o.email}</span></td>
                    <td>{o.method === "free" ? "Gratuito" : o.method === "pix" ? "Pix" : `Cartão ${o.installments}x`}</td>
                    <td>{money(o.total)}</td>
                    <td><Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge></td>
                    <td>
                      {manage && ["paid", "pending"].includes(o.status) && (
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            const reason = prompt("Motivo do cancelamento (o reembolso no gateway segue a política da ACIESC):");
                            if (reason === null) return;
                            const { error } = await getSupabase().rpc("cancel_order", { p_order_id: o.id, p_reason: reason });
                            setMsg(error ? errorMessage(error) : "Pedido cancelado e ingressos liberados.");
                            fin.reload();
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
