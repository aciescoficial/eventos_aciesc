"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, Checkbox, Select, Spinner, TextInput, cx } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";
import { maskCpfInput, maskPhoneInput } from "@/lib/cpf-input";
import { dateLong, errorMessage, money, moneyPlain, time, TIER_LABEL } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth";

type Tier = "associate" | "adept" | "other";
type Reservation = {
  id: string;
  status: string;
  expires_at: string;
  order_id: string | null;
  event: { id: string; slug: string; title: string; visibility: string; kind: string; cover_url: string | null };
  date: { starts_at: string; ends_at: string; label: string | null };
  items: {
    ticket_type_id: string;
    name: string;
    people_per_ticket: number;
    quantity: number;
    lot_name: string;
    base_price: number;
    prices: Record<Tier, { price: number | null; blocked: boolean }>;
  }[];
  questions: { id: string; label: string; type: "text" | "select" | "checkbox"; required: boolean; options: string[] }[];
};
type Person = { full_name: string; cpf: string; email: string; phone: string; creci: string };
const EMPTY: Person = { full_name: "", cpf: "", email: "", phone: "", creci: "" };

export function CheckoutForm() {
  const params = useSearchParams();
  const router = useRouter();
  const auth = useCurrentUser();
  const resId = params.get("r") ?? "";
  const [res, setRes] = useState<Reservation | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [buyer, setBuyer] = useState<Person & { company: string; city: string }>({ ...EMPTY, company: "", city: "" });
  const [buyerTier, setBuyerTier] = useState<{ tier: Tier; registered: boolean } | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [becomeAdept, setBecomeAdept] = useState(false);
  const [units, setUnits] = useState<{ ticket_type_id: string; people: Person[] }[]>([]);
  const [tiers, setTiers] = useState<Record<string, Tier>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [installments, setInstallments] = useState(1);
  const [terms, setTerms] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [coupon] = useState(params.get("cupom") ?? "");
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getSupabase();
    db.rpc("get_reservation", { p_reservation_id: resId }).then(({ data, error }) => {
      if (error || !data) return setRes(null);
      const r = data as unknown as Reservation;
      setRes(r);
      setUnits(
        r.items.flatMap((it) =>
          Array.from({ length: it.quantity }, () => ({
            ticket_type_id: it.ticket_type_id,
            people: Array.from({ length: it.people_per_ticket }, () => ({ ...EMPTY })),
          })),
        ),
      );
    });
    db.from("app_settings").select("key,value").then(({ data }) =>
      setSettings(Object.fromEntries((data ?? []).map((s) => [s.key, s.value]))),
    );
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resId]);

  // Pré-preenche com o perfil logado.
  useEffect(() => {
    if (auth.status !== "ready") return;
    getSupabase().rpc("my_profile").then(({ data }) => {
      const p = (data as { full_name: string; email: string }[] | null)?.[0];
      setBuyer((b) => ({ ...b, full_name: b.full_name || p?.full_name || "", email: b.email || p?.email || auth.user.email || "" }));
    });
  }, [auth]);

  const itemByType = useMemo(() => Object.fromEntries((res?.items ?? []).map((i) => [i.ticket_type_id, i])), [res]);

  async function lookup(cpf: string): Promise<{ tier: Tier; registered: boolean } | null> {
    const { data, error } = await getSupabase().rpc("lookup_tier", { p_cpf: normalizeCpf(cpf) });
    if (error) throw error;
    return (data as { tier: Tier; registered: boolean }[])[0] ?? null;
  }

  async function onBuyerCpf() {
    setTierError(null);
    setBuyerTier(null);
    if (!isValidCpf(buyer.cpf)) {
      if (buyer.cpf) setTierError("CPF inválido.");
      return;
    }
    try {
      const t = await lookup(buyer.cpf);
      setBuyerTier(t);
      if (t) setTiers((s) => ({ ...s, [normalizeCpf(buyer.cpf)]: t.tier }));
    } catch (e) {
      setTierError(errorMessage(e));
    }
  }

  async function onAttendeeCpf(cpf: string) {
    const d = normalizeCpf(cpf);
    if (!isValidCpf(d) || tiers[d]) return;
    try {
      const t = await lookup(d);
      if (t) setTiers((s) => ({ ...s, [d]: t.tier }));
    } catch {}
  }

  const adeptApplies = settings.adept_signup_applies_price !== false;
  function effectiveTier(cpf: string): Tier {
    const d = normalizeCpf(cpf);
    const t = tiers[d] ?? "other";
    if (t === "other" && becomeAdept && d === normalizeCpf(buyer.cpf) && adeptApplies) return "adept";
    return t;
  }
  const buyerEffective: Tier =
    buyerTier?.tier === "other" && becomeAdept && adeptApplies ? "adept" : (buyerTier?.tier ?? "other");

  const lines = units.map((u) => {
    const it = itemByType[u.ticket_type_id];
    const tier = it?.people_per_ticket === 1 ? effectiveTier(u.people[0]?.cpf ?? "") : buyerEffective;
    const p = it?.prices[tier];
    return { it, tier, price: Number(p?.price ?? 0), blocked: !!p?.blocked };
  });
  const total = lines.reduce((s, l) => s + l.price, 0);
  const paymentsEnabled = settings.payments_enabled === true;
  const maxInst = Number(settings.max_installments ?? 12);
  const freeInst = Number(settings.interest_free_installments ?? 1);

  if (res === undefined) return <Spinner />;
  if (res === null)
    return (
      <Alert>
        Reserva não encontrada. <Link href="/" className="font-semibold underline">Voltar à agenda</Link>
      </Alert>
    );

  const left = Math.max(0, Math.floor((new Date(res.expires_at).getTime() - now) / 1000));
  if (res.order_id) {
    router.replace(`/pedido/?id=${res.order_id}`);
    return <Spinner />;
  }
  if (res.status !== "open" || left === 0)
    return (
      <Alert>
        Sua reserva expirou e os ingressos foram liberados.{" "}
        <Link href={`/e/${res.event.slug}/`} className="font-semibold underline">Escolher novamente</Link>
      </Alert>
    );

  function setPerson(ui: number, pi: number, patch: Partial<Person>) {
    setUnits((s) => s.map((u, i) => (i !== ui ? u : { ...u, people: u.people.map((p, j) => (j !== pi ? p : { ...p, ...patch })) })));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidCpf(buyer.cpf)) return setError("Informe um CPF válido para o comprador.");
    for (const u of units) for (const p of u.people) if (!isValidCpf(p.cpf)) return setError(`CPF inválido para o participante ${p.full_name || ""}.`);
    setBusy(true);
    const answerList = Object.entries(answers).map(([k, value]) => {
      const [unit, person, question_id] = k.split(":");
      return { unit: Number(unit), person: Number(person), question_id, value };
    });
    const { data, error } = await getSupabase().rpc("checkout", {
      p_reservation_id: res!.id,
      p_data: {
        buyer: { ...buyer, cpf: normalizeCpf(buyer.cpf) },
        become_adept: becomeAdept,
        accept_terms: terms,
        whatsapp_opt_in: optIn,
        coupon,
        payment_method: method,
        installments: method === "card" ? installments : 1,
        units: units.map((u) => ({ ...u, people: u.people.map((p) => ({ ...p, cpf: normalizeCpf(p.cpf) })) })),
        answers: answerList,
      },
    });
    if (error) {
      setBusy(false);
      return setError(errorMessage(error));
    }
    const out = data as { order_id: string; requires_payment: boolean };
    if (out.requires_payment) {
      await getSupabase().functions.invoke("payments", { body: { order_id: out.order_id } }).catch(() => {});
    }
    router.replace(`/pedido/?id=${out.order_id}`);
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <div className={cx("sticky top-0 z-10 rounded-xl p-3 text-center text-sm font-semibold", left < 120 ? "bg-error-bg text-error-fg" : "bg-pending-bg text-pending-fg")} role="timer" aria-live="off">
          Seus ingressos estão reservados por {mm}:{ss}
        </div>

        <Card>
          <h2 className="mb-4 text-lg font-extrabold">Seus dados</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="CPF"
              required
              inputMode="numeric"
              value={buyer.cpf}
              onChange={(e) => setBuyer({ ...buyer, cpf: maskCpfInput(e.target.value) })}
              onBlur={onBuyerCpf}
              error={tierError}
              hint="Usado para identificar seu vínculo com a ACIESC."
            />
            <TextInput label="Nome completo" required autoComplete="name" value={buyer.full_name} onChange={(e) => setBuyer({ ...buyer, full_name: e.target.value })} />
            <TextInput label="E-mail" type="email" required autoComplete="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} hint="Enviaremos os ingressos para este e-mail." />
            <TextInput label="WhatsApp" type="tel" required autoComplete="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: maskPhoneInput(e.target.value) })} />
            <TextInput label="CRECI (opcional)" value={buyer.creci} onChange={(e) => setBuyer({ ...buyer, creci: e.target.value })} />
            <TextInput label="Cidade (opcional)" autoComplete="address-level2" value={buyer.city} onChange={(e) => setBuyer({ ...buyer, city: e.target.value })} />
          </div>
          {buyerTier && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm">
                Vínculo identificado: <Badge tone={buyerTier.tier === "other" ? "gray" : "green"}>{TIER_LABEL[buyerTier.tier]}</Badge>
              </p>
              {buyerTier.tier === "other" && (
                <div className="rounded-xl border-2 border-accent bg-tint p-4">
                  <Checkbox
                    checked={becomeAdept}
                    onChange={(e) => setBecomeAdept(e.target.checked)}
                    label={<strong>Quero ser Adepto ACIESC — gratuito</strong>}
                    hint={
                      adeptApplies
                        ? "Adepto é a forma gratuita de fazer parte da ACIESC. Você já paga o preço de adepto nesta inscrição."
                        : "Adepto é a forma gratuita de fazer parte da ACIESC."
                    }
                  />
                </div>
              )}
            </div>
          )}
        </Card>

        {units.map((u, ui) => {
          const it = itemByType[u.ticket_type_id];
          return (
            <Card key={ui}>
              <h2 className="mb-1 text-lg font-extrabold">
                {it?.name} {units.length > 1 && <span className="text-muted">#{ui + 1}</span>}
              </h2>
              <p className="mb-4 text-sm text-muted">{it?.people_per_ticket > 1 ? "Informe cada participante." : "Quem vai participar?"}</p>
              {u.people.map((p, pi) => (
                <fieldset key={pi} className="mb-4 grid gap-4 border-t border-line pt-4 first-of-type:border-0 first-of-type:pt-0 sm:grid-cols-2">
                  <legend className="sr-only">Participante {pi + 1}</legend>
                  {ui === 0 && pi === 0 && (
                    <div className="sm:col-span-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setPerson(0, 0, { full_name: buyer.full_name, cpf: buyer.cpf, email: buyer.email, phone: buyer.phone, creci: buyer.creci });
                        }}
                      >
                        Sou eu — usar meus dados
                      </Button>
                    </div>
                  )}
                  <TextInput label="Nome no certificado" required value={p.full_name} onChange={(e) => setPerson(ui, pi, { full_name: e.target.value })} />
                  <TextInput
                    label="CPF"
                    required
                    inputMode="numeric"
                    value={p.cpf}
                    onChange={(e) => setPerson(ui, pi, { cpf: maskCpfInput(e.target.value) })}
                    onBlur={() => onAttendeeCpf(p.cpf)}
                    hint={tiers[normalizeCpf(p.cpf)] ? `Vínculo: ${TIER_LABEL[effectiveTier(p.cpf)]}` : undefined}
                  />
                  <TextInput label="E-mail" type="email" required value={p.email} onChange={(e) => setPerson(ui, pi, { email: e.target.value })} />
                  <TextInput label="WhatsApp (opcional)" type="tel" value={p.phone} onChange={(e) => setPerson(ui, pi, { phone: maskPhoneInput(e.target.value) })} />
                  <TextInput label="CRECI (opcional)" value={p.creci} onChange={(e) => setPerson(ui, pi, { creci: e.target.value })} />
                  {res.questions.map((q) => {
                    const key = `${ui}:${pi}:${q.id}`;
                    const label = `${q.label}${q.required ? "" : " (opcional)"}`;
                    if (q.type === "select")
                      return (
                        <Select key={q.id} label={label} required={q.required} value={answers[key] ?? ""} onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })}>
                          <option value="">Selecione…</option>
                          {q.options.map((o) => <option key={o}>{o}</option>)}
                        </Select>
                      );
                    if (q.type === "checkbox")
                      return (
                        <div key={q.id} className="sm:col-span-2">
                          <Checkbox label={label} checked={answers[key] === "sim"} onChange={(e) => setAnswers({ ...answers, [key]: e.target.checked ? "sim" : "" })} required={q.required} />
                        </div>
                      );
                    return <TextInput key={q.id} label={label} required={q.required} value={answers[key] ?? ""} onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })} />;
                  })}
                </fieldset>
              ))}
            </Card>
          );
        })}

        {buyerTier && total > 0 && (
          <Card>
            <h2 className="mb-4 text-lg font-extrabold">Pagamento</h2>
            {!paymentsEnabled ? (
              <Alert tone="warn">O pagamento online ainda não está disponível. Fale com a ACIESC para concluir sua inscrição.</Alert>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["pix", "card"] as const).map((m) => (
                    <label key={m} className={cx("flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 font-semibold", method === m ? "border-brand bg-tint" : "border-line")}>
                      <input type="radio" name="method" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                      {m === "pix" ? "Pix" : "Cartão de crédito"}
                    </label>
                  ))}
                </div>
                {method === "card" && (
                  <Select label="Parcelas" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                    {Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x de {moneyPlain(total / n)} {n <= freeInst ? "sem juros" : "(juros do cartão conforme o gateway)"}
                      </option>
                    ))}
                  </Select>
                )}
                <p className="text-xs text-muted">
                  {method === "pix"
                    ? "Você verá o QR Code Pix na próxima tela. A confirmação é automática."
                    : "Você será levado ao ambiente seguro do meio de pagamento. Seus dados de cartão não passam pela ACIESC."}
                </p>
              </div>
            )}
          </Card>
        )}

        <Card>
          <div className="flex flex-col gap-3">
            <Checkbox
              required
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              label={
                <>
                  Li e aceito os <Link href="/termos/" target="_blank" className="font-semibold underline">termos de uso</Link> e a{" "}
                  <Link href="/privacidade/" target="_blank" className="font-semibold underline">política de privacidade</Link>.
                </>
              }
            />
            <Checkbox checked={optIn} onChange={(e) => setOptIn(e.target.checked)} label="Quero receber pelo WhatsApp a divulgação de novos eventos da ACIESC." hint="Opcional. Mensagens sobre esta inscrição são enviadas de qualquer forma." />
          </div>
        </Card>
      </div>

      <aside className="md:sticky md:top-4 md:self-start">
        <Card>
          {res.event.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={res.event.cover_url} alt="" className="mb-3 aspect-[16/9] w-full rounded-xl object-cover" />
          )}
          <p className="font-extrabold">{res.event.title}</p>
          <p className="text-sm text-muted">
            {dateLong(res.date.starts_at)} · {time(res.date.starts_at)}
          </p>
          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {l.it?.name} <span className="text-muted">· {TIER_LABEL[l.tier]}</span>
                </span>
                <span className={l.blocked ? "text-error-fg" : ""}>{!buyerTier ? "—" : l.blocked ? "Indisponível" : money(l.price)}</span>
              </li>
            ))}
          </ul>
          {coupon && <p className="mt-2 text-xs text-muted">Cupom {coupon} será aplicado se válido.</p>}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="font-semibold">Total estimado</span>
            <strong className="text-xl">{buyerTier ? money(total) : "—"}</strong>
          </div>
          <p className="mt-1 text-xs text-muted">{buyerTier ? "Valor final confirmado pelo CPF. Sem taxa de serviço." : "Informe seu CPF para ver o valor."}</p>
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          <Button type="submit" className="mt-4 w-full" disabled={busy || !buyerTier || (total > 0 && !paymentsEnabled)}>
            {busy ? "Confirmando…" : total > 0 ? "Ir para o pagamento" : "Confirmar inscrição"}
          </Button>
        </Card>
      </aside>
    </form>
  );
}
