"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { currentUtm } from "@/lib/utm";
import { dateShort, errorMessage, money, moneyPlain, time, TIER_LABEL, whatsappLink } from "@/lib/format";
import { Alert, Button, cx, Spinner, TextInput } from "./ui";

type Tier = "associate" | "adept" | "other";
type Offer = {
  status: string;
  min_price: number | null;
  max_price: number | null;
  rules: Record<string, unknown>;
  dates: {
    id: string;
    label: string | null;
    starts_at: string;
    ends_at: string;
    remaining: number;
    capacity: number;
    sales_open: boolean;
    ticket_types: {
      id: string;
      name: string;
      description: string | null;
      people_per_ticket: number;
      max_per_order: number;
      lot: { id: string; name: string; base_price: number; quantity: number; used: number } | null;
      prices: Partial<Record<Tier, { price: number | null; blocked: boolean }>>;
      next_lot: { name: string; base_price: number } | null;
    }[];
  }[];
};

export function TicketBox({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateId, setDateId] = useState<string>("");
  const [tier, setTier] = useState<Tier>("associate");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState("");

  useEffect(() => {
    const db = getSupabase();
    db.rpc("event_offer", { p_event_id: eventId }).then(({ data, error }) => {
      if (error) return setLoadError(errorMessage(error));
      const o = data as unknown as Offer | null;
      setOffer(o);
      const open = o?.dates.find((d) => d.sales_open) ?? o?.dates[0];
      if (open) setDateId(open.id);
    });
    db.from("app_settings").select("value").eq("key", "support_whatsapp").maybeSingle()
      .then(({ data }) => setSupport(String(data?.value ?? "")));
  }, [eventId]);

  const date = offer?.dates.find((d) => d.id === dateId);
  const items = useMemo(
    () => (date?.ticket_types ?? []).map((t) => ({ t, q: qty[`${dateId}:${t.id}`] ?? 0 })),
    [date, qty, dateId],
  );
  const subtotal = items.reduce((s, { t, q }) => s + q * Number(t.prices[tier]?.price ?? 0), 0);
  const peopleSelected = items.reduce((s, { t, q }) => s + q * t.people_per_ticket, 0);
  const soldOut = date ? date.remaining <= 0 || date.ticket_types.every((t) => !t.lot || t.lot.used >= t.lot.quantity) : false;

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!offer) return <div className="rounded-2xl border border-line bg-white p-5"><Spinner /></div>;
  if (!offer.dates.length) return null;

  function setQ(id: string, v: number) {
    setQty((s) => ({ ...s, [`${dateId}:${id}`]: v }));
  }

  async function checkCoupon() {
    setCouponMsg(null);
    const { data, error } = await getSupabase().rpc("check_coupon", { p_event_id: eventId, p_code: coupon });
    if (error) return setCouponMsg(errorMessage(error));
    const r = (data as { valid: boolean; kind: string; value: number }[])[0];
    setCouponMsg(
      r?.valid
        ? `Cupom válido: ${r.kind === "percent" ? `${Number(r.value)}%` : moneyPlain(r.value)} de desconto, aplicado no checkout.`
        : "Cupom inválido ou esgotado.",
    );
  }

  async function reserve() {
    setBusy(true);
    setError(null);
    const p_items = items.filter((i) => i.q > 0).map((i) => ({ ticket_type_id: i.t.id, quantity: i.q }));
    const { data, error } = await getSupabase().rpc("create_reservation", {
      p_event_date_id: dateId,
      p_items,
      p_utm: currentUtm(),
    });
    if (error) {
      setBusy(false);
      return setError(errorMessage(error));
    }
    const q = new URLSearchParams({ r: String(data) });
    if (coupon.trim()) q.set("cupom", coupon.trim().toUpperCase());
    q.set("perfil", tier);
    router.push(`/checkout/?${q}`);
  }

  const range =
    offer.min_price === null
      ? null
      : Number(offer.min_price) === Number(offer.max_price)
        ? money(offer.min_price)
        : `${money(offer.min_price)} e ${moneyPlain(offer.max_price)}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      {range && (
        <p className="text-sm text-muted">
          Ingressos {range.includes(" e ") ? "entre" : ":"} <strong className="text-ink">{range}</strong>
        </p>
      )}

      {offer.dates.length > 1 && (
        <div role="tablist" aria-label="Datas" className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {offer.dates.map((d) => (
            <button
              key={d.id}
              role="tab"
              type="button"
              aria-selected={d.id === dateId}
              onClick={() => setDateId(d.id)}
              className={cx(
                "min-h-11 shrink-0 rounded-xl border px-3 text-left text-sm",
                d.id === dateId ? "border-brand bg-tint font-bold" : "border-line",
              )}
            >
              {d.label ?? dateShort(d.starts_at)} · {time(d.starts_at)}
            </button>
          ))}
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Ver preços para</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
          {(["associate", "adept", "other"] as Tier[]).map((t) => (
            <label
              key={t}
              className={cx(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-center text-xs font-semibold sm:text-sm",
                tier === t ? "bg-white shadow" : "text-muted",
              )}
            >
              <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} className="sr-only" />
              {TIER_LABEL[t]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Seu perfil é confirmado pelo CPF na inscrição.</p>
      </fieldset>

      {date && !date.sales_open && <Alert tone="info">Inscrições encerradas para esta data.</Alert>}

      {date?.sales_open && (
        <ul className="flex flex-col gap-3">
          {items.map(({ t, q }) => {
            const p = t.prices[tier];
            const remaining = t.lot ? t.lot.quantity - t.lot.used : 0;
            const max = Math.min(t.max_per_order, remaining, Math.floor(date.remaining / t.people_per_ticket));
            const unavailable = !t.lot || p?.blocked || max <= 0;
            const pct = t.lot ? Math.min(100, Math.round((t.lot.used / t.lot.quantity) * 100)) : 100;
            return (
              <li key={t.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{t.name}</p>
                    {t.people_per_ticket > 1 && <p className="text-xs text-muted">{t.people_per_ticket} pessoas por ingresso</p>}
                    {t.lot && <p className="text-xs text-muted">{t.lot.name}</p>}
                    <p className="mt-1">
                      {p?.blocked ? (
                        <span className="text-sm text-muted">Indisponível para {TIER_LABEL[tier].toLowerCase()}</span>
                      ) : (
                        <>
                          {t.lot && Number(p?.price) < Number(t.lot.base_price) && (
                            <s className="mr-2 text-sm text-muted">{moneyPlain(t.lot.base_price)}</s>
                          )}
                          <strong className="text-lg">{money(p?.price)}</strong>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" aria-label={`Quantidade de ${t.name}`}>
                    <button
                      type="button"
                      aria-label="Diminuir"
                      disabled={q <= 0}
                      onClick={() => setQ(t.id, q - 1)}
                      className="size-11 rounded-full border border-line text-xl font-bold disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold" aria-live="polite">{q}</span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      disabled={unavailable || q >= max}
                      onClick={() => setQ(t.id, q + 1)}
                      className="size-11 rounded-full bg-green-800 text-xl font-bold text-white disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
                {t.lot && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg" aria-hidden>
                      <div className="h-full bg-accent-strong" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {remaining <= 0 ? "Lote esgotado" : remaining <= 10 ? `Últimas ${remaining} unidades neste lote` : `${pct}% vendido`}
                      {t.next_lot && ` · Próximo: ${t.next_lot.name} (${moneyPlain(t.next_lot.base_price)})`}
                    </p>
                  </div>
                )}
                {t.description && (
                  <button type="button" onClick={() => setDetails(details === t.id ? null : t.id)} className="mt-1 min-h-11 text-sm font-semibold text-brand">
                    {details === t.id ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>
                )}
                {details === t.id && <p className="text-sm text-muted whitespace-pre-line">{t.description}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {date?.sales_open && !soldOut && (
        <>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput label="Cupom de desconto" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} autoComplete="off" />
            </div>
            <Button variant="secondary" onClick={checkCoupon} disabled={!coupon.trim()}>Aplicar</Button>
          </div>
          {couponMsg && <p className="text-sm" role="status">{couponMsg}</p>}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">Subtotal ({TIER_LABEL[tier].toLowerCase()})</span>
            <strong className="text-xl">{peopleSelected ? money(subtotal) : "—"}</strong>
          </div>
          {error && <Alert>{error}</Alert>}
          <Button onClick={reserve} disabled={busy || peopleSelected === 0} className="w-full">
            {busy ? "Reservando…" : "Continuar"}
          </Button>
          <p className="text-center text-xs text-muted">Sem taxa de serviço. Reservamos seus ingressos por 15 minutos.</p>
        </>
      )}

      {date?.sales_open && soldOut && offer.rules.waitlist_enabled !== false && (
        <WaitlistForm dateId={date.id} />
      )}
      {date?.sales_open && soldOut && offer.rules.waitlist_enabled === false && <Alert tone="info">Ingressos esgotados.</Alert>}

      {support && (
        <a
          href={whatsappLink(support, `Olá! Tenho uma dúvida sobre o evento ${eventTitle}.`)}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line font-semibold text-brand hover:bg-tint"
        >
          Dúvidas? Fale com a ACIESC no WhatsApp
        </a>
      )}
    </div>
  );
}

function WaitlistForm({ dateId }: { dateId: string }) {
  const [form, setForm] = useState({ full_name: "", cpf: "", email: "", phone: "" });
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabase().rpc("join_waitlist", { p_event_date_id: dateId, p_person: form });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setDone((data as { position: number }).position);
  }

  if (done !== null) {
    return (
      <Alert tone="info">
        Você entrou na lista de espera (posição {done}). Se abrir uma vaga, avisaremos por e-mail e WhatsApp.
      </Alert>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Alert tone="warn">Vagas esgotadas. Entre na lista de espera e avisamos se abrir uma vaga.</Alert>
      <TextInput label="Nome completo" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="name" />
      <TextInput label="CPF" required inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
      <TextInput label="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
      <TextInput label="WhatsApp" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
      {error && <Alert>{error}</Alert>}
      <Button type="submit" disabled={busy}>{busy ? "Enviando…" : "Entrar na lista de espera"}</Button>
    </form>
  );
}
