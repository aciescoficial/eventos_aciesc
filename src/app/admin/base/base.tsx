"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin-page";
import { Alert, Badge, Button, Card, Checkbox, Empty, Select, Spinner, Stat, TextInput } from "@/components/ui";
import { hasAnyRole } from "@/lib/auth";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { dateShort, errorMessage, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Row = {
  id: string; full_name: string; email: string | null; phone: string | null; creci: string | null; company: string | null; city: string | null;
  cpf_masked: string; tier: string; status: string; effective: string; valid_until: string | null; source: string;
  registrations: number; attended: number; absences: number;
};
type Result = { total: number; funnel: Record<string, number>; rows: Row[] };
const PAGE = 50;

export function Base() {
  return (
    <AdminPage title="Base ACIESC">
      {(user) => <Content manage={hasAnyRole(user, ["organizer"])} />}
    </AdminPage>
  );
}

function Content({ manage }: { manage: boolean }) {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ q: "", tier: "", part: "", page: 0 });
  const res = useLoad<Result>(
    () => getSupabase().rpc("base_people", { p_search: applied.q, p_tier: applied.tier, p_participation: applied.part, p_limit: PAGE, p_offset: applied.page * PAGE }),
    [applied],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [importing, setImporting] = useState(false);

  async function bulk(template: string) {
    if (!selected.length) return;
    if (!confirm(`Enviar para ${selected.length} pessoa(s)?`)) return;
    const { data, error } = await getSupabase().rpc("send_base_message", { p_person_ids: selected, p_template: template, p_channels: ["email", "whatsapp"] });
    setMsg(error ? { tone: "error", text: errorMessage(error) } : { tone: "info", text: `${data} mensagem(ns) na fila.` });
    setSelected([]);
  }

  async function exportAll() {
    const { data, error } = await getSupabase().rpc("base_people", { p_search: applied.q, p_tier: applied.tier, p_participation: applied.part, p_limit: 500, p_offset: 0 });
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    const rows = (data as unknown as Result).rows.map((r) => ({ ...r, tier: TIER_LABEL[r.tier], effective: TIER_LABEL[r.effective] }));
    downloadCsv("base-aciesc.csv", toCsv(rows, [
      { key: "full_name", label: "Nome" }, { key: "cpf_masked", label: "CPF" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Telefone" },
      { key: "creci", label: "CRECI" }, { key: "company", label: "Empresa" }, { key: "city", label: "Cidade" }, { key: "tier", label: "Vínculo" },
      { key: "effective", label: "Perfil efetivo" }, { key: "valid_until", label: "Validade" }, { key: "registrations", label: "Inscrições" },
      { key: "attended", label: "Presenças" }, { key: "absences", label: "Faltas" },
    ]));
  }

  const r = res.data;
  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {r && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Sem vínculo" value={r.funnel.other} />
          <Stat label="Adeptos" value={r.funnel.adept} />
          <Stat label="Associados ativos" value={r.funnel.associate} />
          <Stat label="Anuidade vencida" value={r.funnel.expired} />
        </div>
      )}
      <Card className="flex flex-col gap-3">
        <form
          className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ ...applied, q: search, page: 0 });
          }}
        >
          <TextInput label="Buscar" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, CPF, CRECI ou e-mail" />
          <Select label="Vínculo" value={applied.tier} onChange={(e) => setApplied({ ...applied, tier: e.target.value, page: 0 })}>
            <option value="">Todos</option>
            <option value="associate">Associado ativo</option>
            <option value="expired">Anuidade vencida</option>
            <option value="adept">Adepto</option>
            <option value="other">Sem vínculo</option>
          </Select>
          <Select label="Participação" value={applied.part} onChange={(e) => setApplied({ ...applied, part: e.target.value, page: 0 })}>
            <option value="">Todas</option>
            <option value="never">Nunca foi</option>
            <option value="1-2">1–2 presenças</option>
            <option value="3+">3+ presenças</option>
            <option value="missed_last">Faltou no último</option>
          </Select>
          <div className="flex items-end"><Button type="submit">Filtrar</Button></div>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportAll}>Exportar CSV</Button>
          {manage && <Button variant="secondary" onClick={() => setImporting(!importing)}>Sincronizar Hi Gestor (CSV)</Button>}
        </div>
      </Card>
      {importing && manage && <Import onDone={() => { setImporting(false); res.reload(); }} />}
      {manage && selected.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{selected.length} selecionada(s):</span>
          <Button variant="secondary" onClick={() => bulk("invite_associate")}>Convidar a associar</Button>
          <Button variant="secondary" onClick={() => bulk("renewal_reminder")}>Cobrar renovação</Button>
          <Button variant="secondary" onClick={() => bulk("invite_adept")}>Convidar a ser adepto</Button>
        </Card>
      )}
      {res.error && <Alert>{res.error}</Alert>}
      {!r ? (
        <Spinner />
      ) : !r.rows.length ? (
        <Empty>Ninguém encontrado.</Empty>
      ) : (
        <>
          <p className="text-sm text-muted">{r.total} pessoa(s)</p>
          <ul className="flex flex-col gap-2">
            {r.rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                {manage && (
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${p.full_name}`}
                    className="size-5 accent-brand"
                    checked={selected.includes(p.id)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/pessoa/?id=${p.id}`} className="font-bold hover:text-brand">{p.full_name}</Link>{" "}
                  <Badge tone={p.effective === "associate" ? "green" : p.tier === "associate" ? "yellow" : p.tier === "adept" ? "dark" : "gray"}>
                    {p.tier === "associate" && p.effective !== "associate" ? "Anuidade vencida" : TIER_LABEL[p.tier]}
                  </Badge>
                  <p className="truncate text-xs text-muted">
                    {p.cpf_masked} · {p.email ?? "sem e-mail"} {p.creci && `· CRECI ${p.creci}`} {p.valid_until && `· validade ${dateShort(p.valid_until)}`}
                  </p>
                </div>
                <p className="hidden shrink-0 text-right text-xs text-muted sm:block">
                  {p.registrations} inscrições<br />{p.attended} presenças · {p.absences} faltas
                </p>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button variant="secondary" disabled={applied.page === 0} onClick={() => setApplied({ ...applied, page: applied.page - 1 })}>Anterior</Button>
            <Button variant="secondary" disabled={(applied.page + 1) * PAGE >= r.total} onClick={() => setApplied({ ...applied, page: applied.page + 1 })}>Próxima</Button>
          </div>
        </>
      )}
    </div>
  );
}

// Colunas aceitas (cabeçalho, sem acento): cpf, nome, email, telefone, creci, empresa, cidade, situacao, validade
const MAP: Record<string, string> = {
  cpf: "cpf", nome: "full_name", nome_completo: "full_name", full_name: "full_name", email: "email", e_mail: "email",
  telefone: "phone", celular: "phone", whatsapp: "phone", phone: "phone", creci: "creci", empresa: "company", imobiliaria: "company",
  company: "company", cidade: "city", city: "city", situacao: "status", status: "status", validade: "valid_until", vencimento: "valid_until", valid_until: "valid_until",
};

function normalizeRow(r: Record<string, string>) {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) if (MAP[k]) o[MAP[k]] = v;
  const st = (o.status ?? "").toLowerCase();
  o.status = /venc|inativ|expir|inadimpl/.test(st) ? "expired" : "active";
  const m = (o.valid_until ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) o.valid_until = `${m[3]}-${m[2]}-${m[1]}`;
  return o;
}

function Import({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [preview, setPreview] = useState<{ created: number; updated: number; errors: { line: number; cpf?: string; error: string }[] } | null>(null);
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(dry: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabase().rpc("import_members", { p_rows: rows!, p_source: "higestor", p_dry_run: dry });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    if (dry) setPreview(data as typeof preview);
    else onDone();
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-extrabold">Importar associados do Hi Gestor</h2>
      <p className="text-sm text-muted">
        CSV com colunas: CPF, Nome, E-mail, Telefone, CRECI, Empresa, Cidade, Situação (ativo/vencido), Validade (DD/MM/AAAA). Todas as linhas são tratadas como associados.
        Dados já cadastrados não são apagados; campos vazios são completados.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="Arquivo CSV"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setPreview(null);
          setRows(parseCsv(await f.text()).map(normalizeRow));
        }}
      />
      {rows && <p className="text-sm">{rows.length} linha(s) lida(s).</p>}
      {rows && !preview && <div><Button onClick={() => run(true)} disabled={busy}>Ver prévia</Button></div>}
      {preview && (
        <div className="flex flex-col gap-3">
          <p>
            Prévia: <strong>{preview.created}</strong> novos · <strong>{preview.updated}</strong> atualizados · <strong>{preview.errors.length}</strong> com problema
          </p>
          {preview.errors.length > 0 && (
            <details className="rounded-xl bg-pending-bg p-3 text-sm text-pending-fg">
              <summary className="cursor-pointer font-semibold">Relatório de inconsistências</summary>
              <ul className="mt-2 list-disc pl-5">
                {preview.errors.map((x, i) => <li key={i}>Linha {x.line + 1}: {x.error} {x.cpf && `(${x.cpf})`}</li>)}
              </ul>
            </details>
          )}
          <Checkbox label="Conferi a prévia e quero importar" checked={confirmUnderstood} onChange={(e) => setConfirmUnderstood(e.target.checked)} />
          <div><Button onClick={() => run(false)} disabled={busy || !confirmUnderstood}>Importar agora</Button></div>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}
