"use client";

import { useState } from "react";
import { AdminPage } from "@/components/admin-page";
import { Alert, Button, Card, Empty, Select, Spinner, TextInput } from "@/components/ui";
import { parseCsv } from "@/lib/csv";
import { errorMessage, localInputToIso, slugify } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useLoad } from "@/lib/use-rpc";

type Setting = { key: string; value: unknown; description: string | null };
type RoleRow = { id: string; email: string; role: string; event_id: string | null; created_at: string };

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", organizer: "Organizador", door: "Portaria", finance: "Financeiro" };

export function Settings() {
  return (
    <AdminPage title="Configurações" roles={["admin"]}>
      {() => (
        <div className="flex flex-col gap-6">
          <Roles />
          <AppSettings />
          <SymplaImport />
        </div>
      )}
    </AdminPage>
  );
}

function AppSettings() {
  const res = useLoad<Setting[]>(() => getSupabase().from("app_settings").select("key,value,description").order("key"), []);
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  if (!res.data) return <Spinner />;

  async function save(s: Setting) {
    const raw = values[s.key];
    if (raw === undefined) return;
    let value: unknown = raw;
    if (typeof s.value === "boolean") value = raw === "true";
    else if (typeof s.value === "number") value = Number(raw);
    const { error } = await getSupabase().from("app_settings").update({ value: value as never }).eq("key", s.key);
    setMsg(error ? { tone: "error", text: errorMessage(error) } : { tone: "info", text: `“${s.key}” salvo.` });
    res.reload();
  }

  async function uploadInto(s: Setting, file: File) {
    const db = getSupabase();
    const path = `certificates/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
    const { error } = await db.storage.from("public-assets").upload(path, file, { contentType: file.type });
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    setValues({ ...values, [s.key]: db.storage.from("public-assets").getPublicUrl(path).data.publicUrl });
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-extrabold">Configurações gerais</h2>
      <p className="text-sm text-muted">Itens marcados como “decisão pendente” dependem da diretoria. Toda alteração fica registrada na auditoria.</p>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <ul className="flex flex-col gap-3">
        {res.data.map((s) => {
          const current = values[s.key] ?? (typeof s.value === "string" ? s.value : String(s.value));
          return (
            <li key={s.key} className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              {typeof s.value === "boolean" ? (
                <Select label={s.description ?? s.key} value={current} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </Select>
              ) : s.key === "expired_associate_tier" ? (
                <Select label={s.description ?? s.key} value={current} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}>
                  <option value="adept">Adepto</option>
                  <option value="other">Sem vínculo</option>
                </Select>
              ) : (
                <TextInput
                  label={s.description ?? s.key}
                  type={typeof s.value === "number" ? "number" : "text"}
                  value={current}
                  onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                />
              )}
              <div>
                {s.key.endsWith("_url") && s.key.startsWith("certificate") && (
                  <input type="file" accept="image/*" aria-label={`Enviar imagem para ${s.key}`} className="text-sm" onChange={(e) => e.target.files?.[0] && uploadInto(s, e.target.files[0])} />
                )}
              </div>
              <Button variant="secondary" onClick={() => save(s)} disabled={values[s.key] === undefined}>Salvar</Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Roles() {
  const res = useLoad<RoleRow[]>(() => getSupabase().rpc("list_roles"), []);
  const events = useLoad<{ id: string; title: string }[]>(() => getSupabase().from("events").select("id,title").order("created_at", { ascending: false }), []);
  const [form, setForm] = useState({ email: "", role: "organizer", event_id: "" });
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function grant() {
    const { error } = await getSupabase().rpc("grant_role_by_email", {
      p_email: form.email, p_role: form.role as "admin" | "organizer" | "door" | "finance", p_event_id: (form.event_id || null) as string,
    });
    setMsg(error ? { tone: "error", text: errorMessage(error) } : { tone: "info", text: "Acesso concedido." });
    res.reload();
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-extrabold">Equipe e acessos</h2>
      <p className="text-sm text-muted">A pessoa precisa ter entrado no site ao menos uma vez com o e-mail. Portaria pode ser limitada a um evento.</p>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto]">
        <TextInput label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Select label="Papel" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select label="Evento (opcional)" value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })}>
          <option value="">Todos os eventos</option>
          {events.data?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </Select>
        <div className="flex items-end"><Button onClick={grant} disabled={!form.email}>Conceder</Button></div>
      </div>
      {!res.data ? (
        <Spinner />
      ) : !res.data.length ? (
        <Empty>Ninguém.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {res.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <strong>{r.email}</strong> · {ROLE_LABEL[r.role]}
                {r.event_id && ` · ${events.data?.find((e) => e.id === r.event_id)?.title ?? "evento"}`}
              </span>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Remover este acesso?")) return;
                  const { error } = await getSupabase().from("user_roles").delete().eq("id", r.id);
                  if (error) setMsg({ tone: "error", text: errorMessage(error) });
                  res.reload();
                }}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Migração do Sympla: um CSV de participantes por evento antigo.
function SymplaImport() {
  const [ev, setEv] = useState({ title: "", starts_at: "", ends_at: "", certificate_hours: "0" });
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const mapped = rows!.map((r) => ({
      full_name: r.nome_completo || [r.nome, r.sobrenome].filter(Boolean).join(" ") || r.participante || r.name || "",
      cpf: r.cpf || r.documento || "",
      email: r.email || r.e_mail || "",
      phone: r.telefone || r.celular || "",
      checked_in: /sim|yes|true|check/i.test(r.check_in || r.checkin || r.status_check_in || ""),
    }));
    const { data, error } = await getSupabase().rpc("import_sympla", {
      p_event: { title: ev.title, slug: `sympla-${slugify(ev.title)}`, starts_at: localInputToIso(ev.starts_at), ends_at: localInputToIso(ev.ends_at || ev.starts_at), certificate_hours: Number(ev.certificate_hours) },
      p_rows: mapped,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    const out = data as { imported: number; errors: { line: number; error: string }[] };
    setResult(`${out.imported} participante(s) importado(s). ${out.errors.length} linha(s) com problema${out.errors.length ? `: ${out.errors.slice(0, 5).map((e) => `linha ${e.line + 1} (${e.error})`).join("; ")}` : ""}.`);
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-extrabold">Migrar histórico do Sympla</h2>
      <p className="text-sm text-muted">
        Exporte a lista de participantes de cada evento no Sympla (CSV) e importe aqui. Colunas reconhecidas: Nome/Sobrenome, CPF, E-mail, Telefone, Check-in.
        Cria um evento encerrado e privado com o histórico; linhas sem CPF válido são ignoradas.
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <TextInput label="Nome do evento" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} />
        <TextInput label="Início" type="datetime-local" value={ev.starts_at} onChange={(e) => setEv({ ...ev, starts_at: e.target.value })} />
        <TextInput label="Fim" type="datetime-local" value={ev.ends_at} onChange={(e) => setEv({ ...ev, ends_at: e.target.value })} />
        <TextInput label="Carga horária" type="number" min={0} value={ev.certificate_hours} onChange={(e) => setEv({ ...ev, certificate_hours: e.target.value })} />
      </div>
      <input type="file" accept=".csv,text/csv" aria-label="CSV do Sympla" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) setRows(parseCsv(await f.text()));
      }} />
      {rows && <p className="text-sm">{rows.length} linha(s) lida(s).</p>}
      {error && <Alert>{error}</Alert>}
      {result && <Alert tone="info">{result}</Alert>}
      <div><Button onClick={run} disabled={busy || !rows?.length || !ev.title || !ev.starts_at}>Importar evento</Button></div>
    </Card>
  );
}
