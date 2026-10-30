"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { Alert, Badge, Button, Card, Empty, Select, Spinner, Stat, TextInput, statusTone } from "@/components/ui";
import { hasAnyRole } from "@/lib/auth";
import { formatCpf } from "@/lib/cpf";
import { dateShort, dateTime, errorMessage, money, STATUS_LABEL, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Detail = {
  person: { id: string; cpf: string; full_name: string; email: string | null; phone: string | null; creci: string | null; company: string | null; city: string | null; source: string; created_at: string; whatsapp_opt_in: boolean };
  membership: { tier: string; status: string; valid_until: string | null; source: string; adept_since: string | null; terms_version: string | null; terms_accepted_at: string | null; last_synced_at: string | null } | null;
  effective_tier: string;
  history: { id: number; from_tier: string | null; to_tier: string; from_status: string | null; to_status: string; reason: string; created_at: string }[];
  events: { ticket_id: string; event_title: string; starts_at: string; status: string; tier: string; price: number; order_status: string; checked_in: boolean; absent: boolean; certificate: string | null }[];
  stats: { registrations: number; attended: number; absences: number; hours: number };
};

export function Person() {
  const id = useSearchParams().get("id") ?? "";
  const res = useLoad<Detail>(() => getSupabase().rpc("person_detail", { p_person_id: id }), [id]);
  return (
    <AdminPage title={res.data?.person.full_name ?? "Ficha da pessoa"}>
      {(user) => {
        if (res.error) return <Alert>{res.error}</Alert>;
        if (!res.data) return <Spinner />;
        return <Content d={res.data} reload={res.reload} manage={hasAnyRole(user, ["organizer"])} admin={user.roles.some((r) => r.role === "admin")} />;
      }}
    </AdminPage>
  );
}

function Content({ d, reload, manage, admin }: { d: Detail; reload: () => void; manage: boolean; admin: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(d.person);
  const [m, setM] = useState({ tier: d.membership?.tier ?? "other", status: d.membership?.status ?? "none", valid_until: d.membership?.valid_until ?? "", reason: "" });
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const pct = d.stats.registrations ? Math.round((d.stats.attended / d.stats.registrations) * 100) : 0;

  async function savePerson() {
    const { error } = await getSupabase().from("people").update({
      full_name: p.full_name, email: p.email?.toLowerCase() || null, phone: p.phone || null, creci: p.creci || null, company: p.company || null, city: p.city || null,
    }).eq("id", p.id);
    setMsg(error ? { tone: "error", text: errorMessage(error) } : { tone: "info", text: "Dados salvos." });
  }

  async function saveMembership() {
    if (!m.reason.trim()) return setMsg({ tone: "error", text: "Informe o motivo da alteração do vínculo." });
    const { error } = await getSupabase().rpc("set_membership", {
      p_person_id: p.id, p_tier: m.tier as "associate" | "adept" | "other", p_status: m.status as "active" | "expired" | "none",
      p_valid_until: (m.valid_until || null) as string, p_reason: m.reason,
    });
    setMsg(error ? { tone: "error", text: errorMessage(error) } : { tone: "info", text: "Vínculo atualizado." });
    reload();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dados-${p.full_name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
  }

  async function anonymize() {
    if (!confirm("Excluir os dados pessoais desta pessoa (LGPD)? O histórico agregado é mantido, sem identificação. Não é possível desfazer.")) return;
    const { error } = await getSupabase().rpc("anonymize_person", { p_person_id: p.id });
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    router.replace("/admin/base/");
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={d.effective_tier === "associate" ? "green" : "gray"}>Perfil efetivo: {TIER_LABEL[d.effective_tier]}</Badge>
        <Badge tone="gray">Origem: {p.source}</Badge>
        {p.whatsapp_opt_in && <Badge tone="green">Aceita divulgação por WhatsApp</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Inscrições" value={d.stats.registrations} />
        <Stat label="Presenças" value={d.stats.attended} />
        <Stat label="Faltas" value={d.stats.absences} />
        <Stat label="% presença" value={`${pct}%`} />
        <Stat label="Horas certificadas" value={`${Number(d.stats.hours)}h`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="font-extrabold sm:col-span-2">Dados</h2>
          <TextInput label="CPF" value={formatCpf(p.cpf)} disabled />
          <TextInput label="Nome" value={p.full_name} disabled={!manage} onChange={(e) => setP({ ...p, full_name: e.target.value })} />
          <TextInput label="E-mail" type="email" value={p.email ?? ""} disabled={!manage} onChange={(e) => setP({ ...p, email: e.target.value })} />
          <TextInput label="Telefone" value={p.phone ?? ""} disabled={!manage} onChange={(e) => setP({ ...p, phone: e.target.value })} />
          <TextInput label="CRECI" value={p.creci ?? ""} disabled={!manage} onChange={(e) => setP({ ...p, creci: e.target.value })} />
          <TextInput label="Empresa" value={p.company ?? ""} disabled={!manage} onChange={(e) => setP({ ...p, company: e.target.value })} />
          <TextInput label="Cidade" value={p.city ?? ""} disabled={!manage} onChange={(e) => setP({ ...p, city: e.target.value })} />
          {manage && <div className="flex items-end"><Button onClick={savePerson}>Salvar dados</Button></div>}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-extrabold">Vínculo</h2>
          {d.membership && (
            <p className="text-sm text-muted">
              Fonte: {d.membership.source}
              {d.membership.last_synced_at && ` · sincronizado ${dateTime(d.membership.last_synced_at)}`}
              {d.membership.adept_since && ` · adepto desde ${dateShort(d.membership.adept_since)}`}
              {d.membership.terms_accepted_at && ` · aceitou termos v${d.membership.terms_version} em ${dateTime(d.membership.terms_accepted_at)}`}
            </p>
          )}
          {manage && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="Vínculo" value={m.tier} onChange={(e) => setM({ ...m, tier: e.target.value })}>
                <option value="associate">Associado</option>
                <option value="adept">Adepto</option>
                <option value="other">Sem vínculo</option>
              </Select>
              <Select label="Situação" value={m.status} onChange={(e) => setM({ ...m, status: e.target.value })}>
                <option value="active">Ativo</option>
                <option value="expired">Vencido</option>
                <option value="none">Nenhum</option>
              </Select>
              <TextInput label="Validade" type="date" value={m.valid_until} onChange={(e) => setM({ ...m, valid_until: e.target.value })} />
              <div className="sm:col-span-3"><TextInput label="Motivo" value={m.reason} onChange={(e) => setM({ ...m, reason: e.target.value })} /></div>
              <div><Button onClick={saveMembership}>Atualizar vínculo</Button></div>
            </div>
          )}
          <h3 className="mt-2 font-bold">Histórico do vínculo</h3>
          {!d.history.length ? (
            <Empty>Sem alterações.</Empty>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {d.history.map((h) => (
                <li key={h.id}>
                  {dateTime(h.created_at)} · {h.from_tier ? TIER_LABEL[h.from_tier] : "—"} → <strong>{TIER_LABEL[h.to_tier]}</strong> ({h.to_status}) · {h.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-extrabold">Eventos</h2>
        {!d.events.length ? (
          <Empty>Nunca participou.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-2">Data</th><th>Evento</th><th>Inscrito como</th><th>Valor</th><th>Resultado</th></tr></thead>
              <tbody>
                {d.events.map((e) => (
                  <tr key={e.ticket_id} className="border-t border-line">
                    <td className="py-2">{dateShort(e.starts_at)}</td>
                    <td>{e.event_title}</td>
                    <td>{TIER_LABEL[e.tier]}</td>
                    <td>{money(e.price)}</td>
                    <td>
                      {e.checked_in ? <Badge tone="green">Presente</Badge> : e.absent ? <Badge tone="red">Faltou</Badge> : <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status]}</Badge>}
                      {e.certificate && <span className="ml-2 text-xs text-muted">Certificado {e.certificate}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="flex flex-wrap items-center gap-2">
        <h2 className="w-full font-extrabold">LGPD</h2>
        <Button variant="secondary" onClick={exportData}>Exportar dados do titular</Button>
        {admin && <Button variant="danger" onClick={anonymize}>Excluir dados pessoais</Button>}
      </Card>
    </div>
  );
}
