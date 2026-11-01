"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { Alert, Badge, Button, Card, Checkbox, Select, Spinner, TextArea, TextInput, cx } from "@/components/ui";
import { errorMessage, isoToLocalInput, localInputToIso, money, slugify, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { tierPrice, type PriceMode } from "@/lib/pricing";

type Tier = "associate" | "adept" | "other";
const TIERS: Tier[] = ["associate", "adept", "other"];
type Rule = { mode: PriceMode; value: string; reserved: string };
type Lot = { key: string; id?: string; date_key: string; name: string; base_price: string; quantity: string; trigger: "quantity" | "date" | "manual"; trigger_at: string; status: string };
type TType = { key: string; id?: string; name: string; description: string; people_per_ticket: string; max_per_order: string; visible: boolean; rules: Record<Tier, Rule>; lots: Lot[] };
type DateRow = { key: string; id?: string; label: string; starts_at: string; ends_at: string; capacity: string };
type Speaker = { key: string; id?: string; name: string; bio: string; photo_url: string };
type Question = { key: string; id?: string; label: string; type: "text" | "select" | "checkbox"; required: boolean; options: string };
type Originals = { dates: string[]; speakers: string[]; types: string[]; lots: string[]; questions: string[] };
type Venue = { id: string; name: string; address: string; city: string; maps_url: string | null; parking_info: string | null };

type Draft = {
  id?: string;
  status: string;
  slug: string;
  title: string;
  kind: "free_course" | "paid" | "open_free";
  category: string;
  summary: string;
  description: string;
  cover_url: string;
  format: "in_person" | "online" | "hybrid";
  venue_id: string;
  visibility: "public" | "associates" | "associates_adepts" | "private";
  certificate_hours: string;
  featured: boolean;
  rules: Record<string, boolean | number>;
  auto_messages: Record<string, boolean>;
  online_url: string;
  attendee_instructions: string;
  dates: DateRow[];
  speakers: Speaker[];
  types: TType[];
  questions: Question[];
};

const k = () => Math.random().toString(36).slice(2);

const PRESETS: { id: string; label: string; rules: Record<Tier, Rule> }[] = [
  { id: "free_all", label: "Gratuito para todos", rules: { associate: r("free"), adept: r("free"), other: r("free") } },
  { id: "assoc_free", label: "Associado grátis · adepto 50% · demais valor cheio", rules: { associate: r("free"), adept: r("percent", "50"), other: r("full") } },
  { id: "assoc_only", label: "Só associados (grátis)", rules: { associate: r("free"), adept: r("blocked"), other: r("blocked") } },
  { id: "full_all", label: "Valor cheio para todos", rules: { associate: r("full"), adept: r("full"), other: r("full") } },
];
function r(mode: PriceMode, value = ""): Rule {
  return { mode, value, reserved: "" };
}

function emptyType(kind: Draft["kind"], dateKey: string): TType {
  return {
    key: k(),
    name: "Ingresso individual",
    description: "",
    people_per_ticket: "1",
    max_per_order: "5",
    visible: true,
    rules: kind === "paid" ? PRESETS[1].rules : PRESETS[0].rules,
    lots: [{ key: k(), date_key: dateKey, name: "Lote único", base_price: kind === "paid" ? "100" : "0", quantity: "50", trigger: "quantity", trigger_at: "", status: "scheduled" }],
  };
}

function newDraft(kind: Draft["kind"]): Draft {
  const dk = k();
  return {
    status: "draft",
    slug: "",
    title: "",
    kind,
    category: kind === "free_course" ? "Cursos" : "",
    summary: "",
    description: "",
    cover_url: "",
    format: "in_person",
    venue_id: "",
    visibility: kind === "free_course" ? "associates_adepts" : "public",
    certificate_hours: kind === "free_course" ? "4" : "0",
    featured: false,
    rules: {
      free_only_active_associates: kind === "free_course",
      one_per_cpf: kind === "free_course",
      confirm_presence_48h: kind === "free_course",
      release_unconfirmed_24h: kind === "free_course",
      require_checkout: false,
      register_absence: kind === "free_course",
      waitlist_enabled: true,
      waitlist_accept_hours: 4,
    },
    auto_messages: { ticket: true, confirm_48h: true, reminder_2h: true, certificate: true },
    online_url: "",
    attendee_instructions: "",
    dates: [{ key: dk, label: "", starts_at: "", ends_at: "", capacity: "50" }],
    speakers: [],
    types: [emptyType(kind, dk)],
    questions: [],
  };
}


async function fetchDraft(id: string): Promise<{ draft: Draft; originals: Originals; hasSales: boolean } | null> {
  const db = getSupabase();
  const [{ data: e }, { data: s }, { data: qs }] = await Promise.all([
    db.from("events").select("*, event_dates(*), speakers(*), ticket_types(*, tier_rules(*), lots(*))").eq("id", id).single(),
    db.from("event_secrets").select("*").eq("event_id", id).maybeSingle(),
    db.from("form_questions").select("*").eq("event_id", id).order("sort"),
  ]);
  if (!e) return null;
  const { count } = await db.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ev = e as any;
  const dates: DateRow[] = [...ev.event_dates]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((x) => ({ key: x.id, id: x.id, label: x.label ?? "", starts_at: isoToLocalInput(x.starts_at), ends_at: isoToLocalInput(x.ends_at), capacity: String(x.capacity) }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const types: TType[] = [...ev.ticket_types].sort((a: any, b: any) => a.sort - b.sort).map((t: any) => ({
    key: t.id,
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    people_per_ticket: String(t.people_per_ticket),
    max_per_order: String(t.max_per_order),
    visible: t.visible,
    rules: Object.fromEntries(
      TIERS.map((tier) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rr = t.tier_rules.find((x: any) => x.tier === tier);
        return [tier, { mode: rr?.mode ?? "full", value: rr?.value != null ? String(rr.value) : "", reserved: rr?.reserved_seats ? String(rr.reserved_seats) : "" }];
      }),
    ) as Record<Tier, Rule>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lots: [...t.lots].sort((a: any, b: any) => a.sort - b.sort).map((l: any) => ({
      key: l.id, id: l.id, date_key: l.event_date_id, name: l.name, base_price: String(l.base_price), quantity: String(l.quantity),
      trigger: l.trigger, trigger_at: isoToLocalInput(l.trigger_at), status: l.status,
    })),
  }));
  const originals = {
    dates: dates.map((x) => x.id!),
    speakers: ev.speakers.map((x: { id: string }) => x.id),
    types: types.map((x) => x.id!),
    lots: types.flatMap((t) => t.lots.map((l) => l.id!)),
    questions: (qs ?? []).map((x) => x.id),
  };
  const draft: Draft = {
    id: ev.id, status: ev.status, slug: ev.slug, title: ev.title, kind: ev.kind, category: ev.category ?? "", summary: ev.summary ?? "",
    description: ev.description ?? "", cover_url: ev.cover_url ?? "", format: ev.format, venue_id: ev.venue_id ?? "", visibility: ev.visibility,
    certificate_hours: String(ev.certificate_hours), featured: ev.featured, rules: ev.rules, auto_messages: ev.auto_messages,
    online_url: s?.online_url ?? "", attendee_instructions: s?.attendee_instructions ?? "",
    dates,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    speakers: [...ev.speakers].sort((a: any, b: any) => a.sort - b.sort).map((x: any) => ({ key: x.id, id: x.id, name: x.name, bio: x.bio ?? "", photo_url: x.photo_url ?? "" })),
    types,
    questions: (qs ?? []).map((q) => ({ key: q.id, id: q.id, label: q.label, type: q.type as Question["type"], required: q.required, options: ((q.options as string[]) ?? []).join(", ") })),
  };
  return { draft, originals, hasSales: (count ?? 0) > 0 };
}

export function EventEditor() {
  return (
    <AdminPage title="Evento" roles={["organizer"]}>
      {() => <Editor />}
    </AdminPage>
  );
}

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [d, setD] = useState<Draft | null>(() => {
    if (id) return null;
    const draft = newDraft((params.get("tipo") as Draft["kind"]) ?? "free_course");
    const format = params.get("formato");
    return format === "online" || format === "in_person" || format === "hybrid" ? { ...draft, format } : draft;
  });
  const original = useRef<{ dates: string[]; speakers: string[]; types: string[]; lots: string[]; questions: string[] }>({ dates: [], speakers: [], types: [], lots: [], questions: [] });
  const [venues, setVenues] = useState<Venue[]>([]);
  const [newVenue, setNewVenue] = useState<Omit<Venue, "id"> | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [hasSales, setHasSales] = useState(false);

  useEffect(() => {
    const db = getSupabase();
    db.from("venues").select("*").order("name").then(({ data }) => setVenues((data as Venue[]) ?? []));
    if (!id) return;
    fetchDraft(id).then((r) => {
      if (!r) return setMsg({ tone: "error", text: "Evento não encontrado." });
      original.current = r.originals;
      setHasSales(r.hasSales);
      setD(r.draft);
    });
  }, [id]);

  if (!d) return msg ? <Alert>{msg.text}</Alert> : <Spinner />;
  const set = (patch: Partial<Draft>) => setD((s) => ({ ...s!, ...patch }));

  async function upload(file: File, folder: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const db = getSupabase();
    const { error } = await db.storage.from("public-assets").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return db.storage.from("public-assets").getPublicUrl(path).data.publicUrl;
  }

  function validate(): string | null {
    if (d!.title.trim().length < 3) return "Informe o nome do evento.";
    for (const x of d!.dates) {
      if (!x.starts_at || !x.ends_at) return "Preencha início e fim de todas as datas.";
      if (x.ends_at <= x.starts_at) return "O fim deve ser depois do início.";
      if (!(Number(x.capacity) > 0)) return "Informe a capacidade de cada data.";
    }
    for (const t of d!.types) {
      if (!t.name.trim()) return "Dê um nome a cada ingresso.";
      for (const tier of TIERS) {
        const rr = t.rules[tier];
        if (rr.mode === "percent" && !(Number(rr.value) >= 0 && Number(rr.value) <= 100)) return `Desconto inválido em "${t.name}".`;
        if (rr.mode === "fixed" && !(Number(rr.value) >= 0)) return `Valor fixo inválido em "${t.name}".`;
      }
      for (const l of t.lots) {
        if (!(Number(l.quantity) > 0)) return `Quantidade inválida no lote "${l.name}".`;
        if (l.trigger === "date" && !l.trigger_at) return `Informe a data de virada do lote "${l.name}".`;
      }
    }
    if (d!.format !== "in_person" && !d!.online_url && d!.status !== "draft") return "Informe o link da transmissão.";
    return null;
  }

  async function save(opts: { quiet?: boolean } = {}) {
    const err = validate();
    if (err) {
      if (!opts.quiet) setMsg({ tone: "error", text: err });
      return null;
    }
    setSaving(true);
    setMsg(null);
    const db = getSupabase();
    try {
      let venueId = d!.venue_id || null;
      if (newVenue) {
        const { data, error } = await db.from("venues").insert(newVenue).select().single();
        if (error) throw error;
        venueId = data.id;
        setVenues((v) => [...v, data as Venue]);
        setNewVenue(null);
      }
      const row = {
        slug: d!.slug || slugify(d!.title),
        title: d!.title.trim(),
        kind: d!.kind,
        category: d!.category || null,
        summary: d!.summary || null,
        description: d!.description || null,
        cover_url: d!.cover_url || null,
        format: d!.format,
        venue_id: d!.format === "online" ? null : venueId,
        visibility: d!.visibility,
        certificate_hours: Number(d!.certificate_hours || 0),
        featured: d!.featured,
        rules: d!.rules,
        auto_messages: d!.auto_messages,
      };
      let eventId = d!.id;
      if (eventId) {
        const { error } = await db.from("events").update(row).eq("id", eventId);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("events").insert(row).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }
      await db.from("event_secrets").upsert({ event_id: eventId, online_url: d!.online_url || null, attendee_instructions: d!.attendee_instructions || null });

      // Datas
      const dateMap: Record<string, string> = {};
      for (const x of d!.dates) {
        const r = { event_id: eventId, label: x.label || null, starts_at: localInputToIso(x.starts_at), ends_at: localInputToIso(x.ends_at), capacity: Number(x.capacity) };
        if (x.id) {
          const { error } = await db.from("event_dates").update(r).eq("id", x.id);
          if (error) throw error;
          dateMap[x.key] = x.id;
        } else {
          const { data, error } = await db.from("event_dates").insert(r).select("id").single();
          if (error) throw error;
          dateMap[x.key] = data.id;
        }
      }
      // Palestrantes
      const keepSpeakers: string[] = [];
      for (const [i, s] of d!.speakers.entries()) {
        const r = { event_id: eventId, name: s.name, bio: s.bio || null, photo_url: s.photo_url || null, sort: i };
        if (s.id) {
          await db.from("speakers").update(r).eq("id", s.id);
          keepSpeakers.push(s.id);
        } else {
          const { data } = await db.from("speakers").insert(r).select("id").single();
          if (data) keepSpeakers.push(data.id);
        }
      }
      const delSpeakers = original.current.speakers.filter((x) => !keepSpeakers.includes(x));
      if (delSpeakers.length) await db.from("speakers").delete().in("id", delSpeakers);

      // Ingressos, regras e lotes
      const keepTypes: string[] = [];
      const keepLots: string[] = [];
      for (const [i, t] of d!.types.entries()) {
        const r = { event_id: eventId, name: t.name, description: t.description || null, people_per_ticket: Number(t.people_per_ticket || 1), max_per_order: Number(t.max_per_order || 1), visible: t.visible, sort: i };
        let typeId = t.id;
        if (typeId) {
          const { error } = await db.from("ticket_types").update(r).eq("id", typeId);
          if (error) throw error;
        } else {
          const { data, error } = await db.from("ticket_types").insert(r).select("id").single();
          if (error) throw error;
          typeId = data.id;
        }
        keepTypes.push(typeId!);
        const { error: re } = await db.from("tier_rules").upsert(
          TIERS.map((tier) => ({
            ticket_type_id: typeId!,
            tier,
            mode: t.rules[tier].mode,
            value: ["percent", "fixed"].includes(t.rules[tier].mode) ? Number(t.rules[tier].value || 0) : null,
            reserved_seats: Number(t.rules[tier].reserved || 0),
          })),
          { onConflict: "ticket_type_id,tier" },
        );
        if (re) throw re;
        for (const [j, l] of t.lots.entries()) {
          const lr = {
            ticket_type_id: typeId!,
            event_date_id: dateMap[l.date_key] ?? Object.values(dateMap)[0],
            name: l.name,
            base_price: Number(l.base_price || 0),
            quantity: Number(l.quantity),
            trigger: l.trigger,
            trigger_at: l.trigger === "date" ? localInputToIso(l.trigger_at) : null,
            sort: j + 1,
          };
          if (l.id) {
            const { error } = await db.from("lots").update(lr).eq("id", l.id);
            if (error) throw error;
            keepLots.push(l.id);
          } else {
            const { data, error } = await db.from("lots").insert(lr).select("id").single();
            if (error) throw error;
            keepLots.push(data.id);
          }
        }
      }
      const delLots = original.current.lots.filter((x) => !keepLots.includes(x));
      if (delLots.length) {
        const { error } = await db.from("lots").delete().in("id", delLots);
        if (error) throw new Error("Não é possível remover lotes que já têm inscrições.");
      }
      const delTypes = original.current.types.filter((x) => !keepTypes.includes(x));
      if (delTypes.length) {
        const { error } = await db.from("ticket_types").delete().in("id", delTypes);
        if (error) throw new Error("Não é possível remover ingressos que já têm inscrições.");
      }
      const keepDates = Object.values(dateMap);
      const delDates = original.current.dates.filter((x) => !keepDates.includes(x));
      if (delDates.length) {
        const { error } = await db.from("event_dates").delete().in("id", delDates);
        if (error) throw error;
      }

      // Perguntas
      const keepQ: string[] = [];
      for (const [i, q] of d!.questions.entries()) {
        const r = { event_id: eventId, label: q.label, type: q.type, required: q.required, options: q.options.split(",").map((o) => o.trim()).filter(Boolean), sort: i };
        if (q.id) {
          await db.from("form_questions").update(r).eq("id", q.id);
          keepQ.push(q.id);
        } else {
          const { data } = await db.from("form_questions").insert(r).select("id").single();
          if (data) keepQ.push(data.id);
        }
      }
      const delQ = original.current.questions.filter((x) => !keepQ.includes(x));
      if (delQ.length) await db.from("form_questions").delete().in("id", delQ);

      // Recarrega do banco para ter todos os ids (próximos salvamentos só atualizam).
      const fresh = await fetchDraft(eventId!);
      if (fresh) {
        original.current = fresh.originals;
        setHasSales(fresh.hasSales);
        setD(fresh.draft);
      }
      setSaving(false);
      if (!d!.id) window.history.replaceState(null, "", `/admin/eventos/novo/?id=${eventId}`);
      if (!opts.quiet) setMsg({ tone: "info", text: "Alterações salvas." });
      return eventId;
    } catch (e) {
      setSaving(false);
      const m = errorMessage(e);
      setMsg({ tone: "error", text: /events_slug_key|duplicate key.*slug/.test(m) ? "Já existe um evento com este endereço (slug). Altere o endereço." : m });
      return null;
    }
  }

  async function publish() {
    const eventId = await save({ quiet: true });
    if (!eventId) return;
    const { error } = await getSupabase().rpc("publish_event", { p_event_id: eventId });
    if (error) return setMsg({ tone: "error", text: errorMessage(error) });
    router.push(`/admin/evento/?id=${eventId}`);
  }

  async function goStep(n: number) {
    if (d!.title.trim().length >= 3 && d!.status === "draft") await save({ quiet: true });
    setStep(n);
    window.scrollTo({ top: 0 });
  }

  const STEPS = ["Sobre o evento", "Datas e local", "Ingressos e preços", "Participante e divulgação"];

  return (
    <div className="flex flex-col gap-6 pb-24">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => goStep(i + 1)}
              className={cx("flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold", step === i + 1 ? "border-brand bg-tint" : "border-line bg-white")}
              aria-current={step === i + 1 ? "step" : undefined}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-800 text-xs text-white">{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {hasSales && <Alert tone="warn">Este evento já tem inscrições. Mudanças em preço e datas valem só para novas inscrições.</Alert>}

      {step === 1 && (
        <Card className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo de evento" value={d.kind} onChange={(e) => set({ kind: e.target.value as Draft["kind"] })}>
            <option value="free_course">Curso gratuito para associados</option>
            <option value="paid">Evento pago</option>
            <option value="open_free">Gratuito aberto</option>
          </Select>
          <TextInput label="Categoria" value={d.category} onChange={(e) => set({ category: e.target.value })} placeholder="Cursos, Palestras, Workshops…" />
          <div className="sm:col-span-2">
            <TextInput label="Nome do evento" required value={d.title} onChange={(e) => set({ title: e.target.value, slug: d.id ? d.slug : slugify(e.target.value) })} />
          </div>
          <TextInput label="Endereço da página" value={d.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} hint={`eventos.aciesc.com.br/e/${d.slug || "…"}/`} />
          <TextInput label="Carga horária do certificado (h)" type="number" min={0} step={0.5} value={d.certificate_hours} onChange={(e) => set({ certificate_hours: e.target.value })} hint="0 = sem certificado" />
          <div className="sm:col-span-2">
            <TextInput label="Resumo (uma frase)" value={d.summary} maxLength={200} onChange={(e) => set({ summary: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <TextArea label="Descrição" rows={8} value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Capa (arte do evento, 16:9)</span>
            {d.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.cover_url} alt="" className="aspect-[16/9] w-full max-w-md rounded-xl object-cover" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Enviar capa"
              className="text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  set({ cover_url: await upload(f, "covers") });
                } catch (err) {
                  setMsg({ tone: "error", text: errorMessage(err) });
                }
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Checkbox label="Destacar na vitrine" checked={d.featured} onChange={(e) => set({ featured: e.target.checked })} />
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <h2 className="font-bold">Palestrantes</h2>
            {d.speakers.map((s, i) => (
              <div key={s.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_2fr_auto]">
                <TextInput label="Nome" value={s.name} onChange={(e) => set({ speakers: d.speakers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <TextInput label="Mini bio" value={s.bio} onChange={(e) => set({ speakers: d.speakers.map((x, j) => (j === i ? { ...x, bio: e.target.value } : x)) })} />
                <div className="flex items-end gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-3 text-sm font-semibold">
                    {s.photo_url ? "Trocar foto" : "Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await upload(f, "speakers");
                          set({ speakers: d.speakers.map((x, j) => (j === i ? { ...x, photo_url: url } : x)) });
                        }
                      }}
                    />
                  </label>
                  <Button variant="ghost" onClick={() => set({ speakers: d.speakers.filter((_, j) => j !== i) })}>Remover</Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={() => set({ speakers: [...d.speakers, { key: k(), name: "", bio: "", photo_url: "" }] })}>+ Palestrante</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-6">
          <Select label="Formato" value={d.format} onChange={(e) => set({ format: e.target.value as Draft["format"] })}>
            <option value="in_person">Presencial</option>
            <option value="online">Online</option>
            <option value="hybrid">Híbrido</option>
          </Select>
          {d.format !== "in_person" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Link da transmissão" type="url" value={d.online_url} onChange={(e) => set({ online_url: e.target.value })} hint="Visível só para quem tem ingresso." />
            </div>
          )}
          {d.format !== "online" && (
            <div className="flex flex-col gap-3">
              {!newVenue ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-64 flex-1">
                    <Select label="Local" value={d.venue_id} onChange={(e) => set({ venue_id: e.target.value })}>
                      <option value="">Selecione um local salvo…</option>
                      {venues.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
                    </Select>
                  </div>
                  <Button variant="secondary" onClick={() => setNewVenue({ name: "", address: "", city: "Itapema", maps_url: "", parking_info: "" })}>+ Novo local</Button>
                </div>
              ) : (
                <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
                  <TextInput label="Nome do local" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} />
                  <TextInput label="Cidade" value={newVenue.city} onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })} />
                  <TextInput label="Endereço" value={newVenue.address} onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })} />
                  <TextInput label="Link do Google Maps (opcional)" value={newVenue.maps_url ?? ""} onChange={(e) => setNewVenue({ ...newVenue, maps_url: e.target.value })} />
                  <TextInput label="Estacionamento (opcional)" value={newVenue.parking_info ?? ""} onChange={(e) => setNewVenue({ ...newVenue, parking_info: e.target.value })} />
                  <div className="flex items-end"><Button variant="ghost" onClick={() => setNewVenue(null)}>Cancelar</Button></div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3">
            <h2 className="font-bold">Datas / turmas <span className="text-sm font-normal text-muted">(horário de Brasília)</span></h2>
            {d.dates.map((x, i) => (
              <div key={x.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_120px_auto]">
                <TextInput label="Nome da turma (opcional)" value={x.label} onChange={(e) => set({ dates: d.dates.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} />
                <TextInput label="Início" type="datetime-local" value={x.starts_at} onChange={(e) => set({ dates: d.dates.map((y, j) => (j === i ? { ...y, starts_at: e.target.value, ends_at: y.ends_at || e.target.value } : y)) })} />
                <TextInput label="Fim" type="datetime-local" value={x.ends_at} onChange={(e) => set({ dates: d.dates.map((y, j) => (j === i ? { ...y, ends_at: e.target.value } : y)) })} />
                <TextInput label="Vagas" type="number" min={1} value={x.capacity} onChange={(e) => set({ dates: d.dates.map((y, j) => (j === i ? { ...y, capacity: e.target.value } : y)) })} />
                <div className="flex items-end">
                  <Button variant="ghost" disabled={d.dates.length === 1 || (hasSales && !!x.id)} onClick={() => set({ dates: d.dates.filter((_, j) => j !== i), types: d.types.map((t) => ({ ...t, lots: t.lots.filter((l) => l.date_key !== x.key) })) })}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                const nk = k();
                set({
                  dates: [...d.dates, { key: nk, label: "", starts_at: "", ends_at: "", capacity: d.dates[0]?.capacity ?? "50" }],
                  types: d.types.map((t) => ({ ...t, lots: [...t.lots, { ...t.lots[0], key: k(), id: undefined, date_key: nk, status: "scheduled" }] })),
                });
              }}
            >
              + Data / turma
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          {d.types.map((t, ti) => {
            const upd = (patch: Partial<TType>) => set({ types: d.types.map((x, j) => (j === ti ? { ...x, ...patch } : x)) });
            const firstLot = t.lots[0];
            return (
              <Card key={t.key} className="flex flex-col gap-5">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <TextInput label="Nome do ingresso" value={t.name} onChange={(e) => upd({ name: e.target.value })} />
                  <TextInput label="Pessoas por ingresso" type="number" min={1} value={t.people_per_ticket} onChange={(e) => upd({ people_per_ticket: e.target.value })} hint="Ex.: pacote imobiliária = 5" />
                  <TextInput label="Limite por pedido" type="number" min={1} value={t.max_per_order} onChange={(e) => upd({ max_per_order: e.target.value })} />
                  <div className="sm:col-span-3">
                    <TextInput label="Descrição (opcional)" value={t.description} onChange={(e) => upd({ description: e.target.value })} />
                  </div>
                  <Checkbox label="Visível na página do evento" checked={t.visible} onChange={(e) => upd({ visible: e.target.checked })} />
                </div>

                <div>
                  <h3 className="mb-2 font-bold">Preço por perfil</h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button key={p.id} type="button" onClick={() => upd({ rules: p.rules })} className="min-h-11 rounded-full border border-line bg-white px-3 text-xs font-semibold hover:bg-tint">
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {TIERS.map((tier) => {
                      const rr = t.rules[tier];
                      const updR = (patch: Partial<Rule>) => upd({ rules: { ...t.rules, [tier]: { ...rr, ...patch } } });
                      return (
                        <div key={tier} className="flex flex-col gap-2 rounded-xl bg-bg p-3">
                          <p className="font-semibold">{TIER_LABEL[tier]}</p>
                          <Select label="Regra" value={rr.mode} onChange={(e) => updR({ mode: e.target.value as PriceMode })}>
                            <option value="free">Gratuito</option>
                            <option value="percent">Desconto %</option>
                            <option value="fixed">Valor fixo</option>
                            <option value="full">Valor do lote</option>
                            <option value="blocked">Não pode comprar</option>
                          </Select>
                          {(rr.mode === "percent" || rr.mode === "fixed") && (
                            <TextInput label={rr.mode === "percent" ? "Desconto (%)" : "Valor (R$)"} type="number" min={0} step="0.01" value={rr.value} onChange={(e) => updR({ value: e.target.value })} />
                          )}
                          {rr.mode !== "blocked" && (
                            <TextInput label="Vagas reservadas (opcional)" type="number" min={0} value={rr.reserved} onChange={(e) => updR({ reserved: e.target.value })} />
                          )}
                          {firstLot && (
                            <p className="text-sm">
                              Paga no 1º lote: <strong>{rr.mode === "blocked" ? "—" : money(tierPrice(Number(firstLot.base_price || 0), rr.mode, Number(rr.value || 0)))}</strong>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 font-bold">Lotes</h3>
                  <div className="flex flex-col gap-3">
                    {t.lots.map((l, li) => {
                      const updL = (patch: Partial<Lot>) => upd({ lots: t.lots.map((x, j) => (j === li ? { ...x, ...patch } : x)) });
                      return (
                        <div key={l.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-6">
                          {d.dates.length > 1 && (
                            <Select label="Data" value={l.date_key} onChange={(e) => updL({ date_key: e.target.value })}>
                              {d.dates.map((x, i) => <option key={x.key} value={x.key}>{x.label || `Data ${i + 1}`}</option>)}
                            </Select>
                          )}
                          <TextInput label="Nome" value={l.name} onChange={(e) => updL({ name: e.target.value })} />
                          <TextInput label="Valor normal (R$)" type="number" min={0} step="0.01" value={l.base_price} onChange={(e) => updL({ base_price: e.target.value })} hint="0 = gratuito" />
                          <TextInput label="Quantidade" type="number" min={1} value={l.quantity} onChange={(e) => updL({ quantity: e.target.value })} />
                          <Select label="Vira para o próximo" value={l.trigger} onChange={(e) => updL({ trigger: e.target.value as Lot["trigger"] })}>
                            <option value="quantity">Ao esgotar</option>
                            <option value="date">Em uma data</option>
                            <option value="manual">Manualmente</option>
                          </Select>
                          {l.trigger === "date" && <TextInput label="Data da virada" type="datetime-local" value={l.trigger_at} onChange={(e) => updL({ trigger_at: e.target.value })} />}
                          <div className="flex items-end gap-2">
                            {l.status !== "scheduled" && <Badge tone={l.status === "active" ? "green" : "gray"}>{l.status === "active" ? "Ativo" : "Encerrado"}</Badge>}
                            <Button variant="ghost" disabled={t.lots.length === 1} onClick={() => upd({ lots: t.lots.filter((_, j) => j !== li) })}>Remover</Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button variant="secondary" onClick={() => upd({ lots: [...t.lots, { ...t.lots[t.lots.length - 1], key: k(), id: undefined, name: `${t.lots.length + 1}º lote`, status: "scheduled" }] })}>
                      + Lote
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" disabled={d.types.length === 1} onClick={() => set({ types: d.types.filter((_, j) => j !== ti) })}>Remover ingresso</Button>
                </div>
              </Card>
            );
          })}
          <Button variant="secondary" onClick={() => set({ types: [...d.types, { ...emptyType(d.kind, d.dates[0].key), name: "Novo ingresso" }] })}>+ Tipo de ingresso</Button>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <h2 className="font-bold">Quem pode se inscrever</h2>
            <Select label="Visibilidade" value={d.visibility} onChange={(e) => set({ visibility: e.target.value as Draft["visibility"] })}>
              <option value="public">Aberto a todos</option>
              <option value="associates">Só associados</option>
              <option value="associates_adepts">Associados e adeptos</option>
              <option value="private">Privado (só com o link)</option>
            </Select>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-bold">Regras do curso</h2>
            {(
              [
                ["free_only_active_associates", "Vagas gratuitas só para associados ativos"],
                ["one_per_cpf", "Uma inscrição por CPF por data"],
                ["confirm_presence_48h", "Pedir confirmação de presença 48h antes"],
                ["release_unconfirmed_24h", "Liberar vagas não confirmadas 24h antes (oferece à lista de espera)"],
                ["require_checkout", "Exigir check-in de saída para emitir certificado"],
                ["register_absence", "Registrar falta de quem não comparecer"],
                ["waitlist_enabled", "Lista de espera quando esgotar"],
              ] as const
            ).map(([key, label]) => (
              <Checkbox key={key} label={label} checked={!!d.rules[key]} onChange={(e) => set({ rules: { ...d.rules, [key]: e.target.checked } })} />
            ))}
            <div className="max-w-56">
              <TextInput label="Prazo para aceitar a vaga (horas)" type="number" min={1} value={String(d.rules.waitlist_accept_hours ?? 4)} onChange={(e) => set({ rules: { ...d.rules, waitlist_accept_hours: Number(e.target.value) } })} />
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-bold">Mensagens automáticas (e-mail e WhatsApp)</h2>
            {(
              [
                ["ticket", "Ingresso após inscrição/pagamento"],
                ["confirm_48h", "Confirmação de presença 48h antes (se a regra estiver ativa)"],
                ["reminder_2h", "Lembrete 2h antes com endereço e mapa"],
                ["certificate", "Certificado no dia seguinte"],
              ] as const
            ).map(([key, label]) => (
              <Checkbox key={key} label={label} checked={d.auto_messages[key] !== false} onChange={(e) => set({ auto_messages: { ...d.auto_messages, [key]: e.target.checked } })} />
            ))}
            <TextArea label="Instruções para participantes (aparecem em Meus ingressos)" value={d.attendee_instructions} onChange={(e) => set({ attendee_instructions: e.target.value })} />
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-bold">Perguntas ao participante</h2>
            {d.questions.map((q, i) => (
              <div key={q.key} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[2fr_1fr_2fr_auto]">
                <TextInput label="Pergunta" value={q.label} onChange={(e) => set({ questions: d.questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <Select label="Tipo" value={q.type} onChange={(e) => set({ questions: d.questions.map((x, j) => (j === i ? { ...x, type: e.target.value as Question["type"] } : x)) })}>
                  <option value="text">Texto</option>
                  <option value="select">Lista de opções</option>
                  <option value="checkbox">Caixa de marcar</option>
                </Select>
                {q.type === "select" ? (
                  <TextInput label="Opções (separadas por vírgula)" value={q.options} onChange={(e) => set({ questions: d.questions.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)) })} />
                ) : (
                  <div />
                )}
                <div className="flex flex-col justify-end gap-2">
                  <Checkbox label="Obrigatória" checked={q.required} onChange={(e) => set({ questions: d.questions.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })} />
                  <Button variant="ghost" onClick={() => set({ questions: d.questions.filter((_, j) => j !== i) })}>Remover</Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={() => set({ questions: [...d.questions, { key: k(), label: "", type: "text", required: false, options: "" }] })}>+ Pergunta</Button>
          </Card>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            {msg ? <span className={msg.tone === "error" ? "font-semibold text-error-fg" : "text-brand"} role="status">{msg.text}</span> : saving ? "Salvando…" : d.id ? "Rascunho salvo automaticamente ao trocar de etapa." : ""}
          </div>
          <div className="flex gap-2">
            {step > 1 && <Button variant="ghost" onClick={() => goStep(step - 1)}>Voltar</Button>}
            <Button variant="secondary" onClick={() => save()} disabled={saving}>Salvar</Button>
            {step < 4 ? (
              <Button onClick={() => goStep(step + 1)}>Próximo</Button>
            ) : d.status === "draft" ? (
              <Button onClick={publish} disabled={saving}>Publicar</Button>
            ) : (
              d.id && <Button onClick={() => save().then((x) => x && router.push(`/admin/evento/?id=${x}`))}>Salvar e voltar</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
