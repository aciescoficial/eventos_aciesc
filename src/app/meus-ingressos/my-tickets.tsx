"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QrCode } from "@/components/qr";
import { Alert, Badge, Button, ButtonLink, Card, Empty, Spinner, Stat, Tabs, statusTone } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { downloadIcs } from "@/lib/calendar";
import { dateLong, errorMessage, STATUS_LABEL, time, TIER_LABEL } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  name: string;
  status: string;
  code: string;
  qr: string | null;
  presence_confirmed: boolean | null;
  presence_token: string;
  type: string;
  order_id: string;
  order_status: string;
  event: { title: string; slug: string; cover_url: string | null; format: string; certificate_hours: number };
  date: { starts_at: string; ends_at: string; label: string | null };
  venue: { name: string; address: string; city: string; maps_url: string | null; parking_info: string | null } | null;
  online_url: string | null;
  instructions: string | null;
  checked_in_at: string | null;
  certificate: { code: string; hours: number; issued_at: string } | null;
};
type Profile = { full_name: string; email: string; cpf_masked: string; tier: string; membership_status: string; valid_until: string | null };

export function MyTickets() {
  const auth = useCurrentUser();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"next" | "past" | "certs">("next");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/entrar/?next=/meus-ingressos/");
    if (auth.status !== "ready") return;
    const db = getSupabase();
    db.rpc("my_tickets").then(({ data, error }) => {
      if (error) return setError(errorMessage(error));
      setTickets(data as unknown as Ticket[]);
      db.rpc("my_profile").then(({ data }) => setProfile((data as Profile[] | null)?.[0] ?? null));
    });
  }, [auth.status, router]);

  if (error) return <Alert>{error}</Alert>;
  if (auth.status !== "ready" || !tickets) return <Spinner />;

  const upcoming = tickets.filter((t) => new Date(t.date.ends_at).getTime() > now && t.status !== "cancelled").reverse();
  const past = tickets.filter((t) => new Date(t.date.ends_at).getTime() <= now || t.status === "cancelled");
  const certs = tickets.filter((t) => t.certificate);
  const hours = certs.reduce((s, t) => s + Number(t.certificate!.hours), 0);
  const list = tab === "next" ? upcoming : tab === "past" ? past : certs;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{profile?.full_name ?? auth.user.email}</p>
          {profile && (
            <p className="text-sm text-muted">
              CPF {profile.cpf_masked} · <Badge tone={profile.tier === "other" ? "gray" : "green"}>{TIER_LABEL[profile.tier]}</Badge>
            </p>
          )}
        </div>
        <Button variant="ghost" onClick={() => getSupabase().auth.signOut().then(() => router.replace("/"))}>Sair</Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Próximos" value={upcoming.length} />
        <Stat label="Certificados" value={certs.length} />
        <Stat label="Horas" value={`${hours}h`} />
      </div>
      <Tabs
        tabs={[
          { id: "next", label: "Próximos" },
          { id: "past", label: "Anteriores" },
          { id: "certs", label: "Certificados" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!tickets.length && (
        <Empty>
          Nenhum ingresso encontrado para {auth.user.email}. Use o mesmo e-mail da inscrição.{" "}
          <Link href="/" className="font-semibold text-brand underline">Ver eventos</Link>
        </Empty>
      )}
      {!!tickets.length && !list.length && <Empty>Nada por aqui.</Empty>}
      <ul className="flex flex-col gap-4">
        {list.map((t) => (
          <li key={t.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-brand">
                    {dateLong(t.date.starts_at)} · {time(t.date.starts_at)}
                  </p>
                  <Link href={`/e/${t.event.slug}/`} className="font-extrabold hover:text-brand">{t.event.title}</Link>
                  <p className="text-sm text-muted">{t.name} · {t.type}</p>
                </div>
                <Badge tone={statusTone(t.order_status === "pending" ? "pending" : t.status)}>
                  {t.order_status === "pending" ? "Aguardando pagamento" : STATUS_LABEL[t.status]}
                </Badge>
              </div>

              {tab === "certs" && t.certificate ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={`/certificado/?c=${t.certificate.code}`}>Baixar certificado ({Number(t.certificate.hours)}h)</ButtonLink>
                  <ButtonLink href={`/validar/?c=${t.certificate.code}`} variant="secondary">Link de validação</ButtonLink>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {t.order_status === "pending" && <ButtonLink href={`/pedido/?id=${t.order_id}`}>Concluir pagamento</ButtonLink>}
                  {t.qr && t.status === "valid" && (
                    <Button onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? "Ocultar QR Code" : "Mostrar QR Code"}</Button>
                  )}
                  {t.status === "valid" && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        downloadIcs({
                          title: t.event.title,
                          start: t.date.starts_at,
                          end: t.date.ends_at,
                          location: t.venue ? `${t.venue.name}, ${t.venue.address}, ${t.venue.city}` : undefined,
                          url: `${location.origin}/e/${t.event.slug}/`,
                        })
                      }
                    >
                      Adicionar à agenda
                    </Button>
                  )}
                  {t.status === "valid" && t.presence_confirmed === null && (
                    <ButtonLink href={`/presenca/?t=${t.presence_token}`} variant="secondary">Confirmar presença</ButtonLink>
                  )}
                  {t.online_url && <a href={t.online_url} target="_blank" rel="noopener" className="btn-primary">Acessar transmissão</a>}
                  {t.venue?.maps_url && (
                    <a href={t.venue.maps_url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">
                      Como chegar
                    </a>
                  )}
                </div>
              )}
              {t.instructions && t.status === "valid" && <p className="mt-3 whitespace-pre-line text-sm text-muted">{t.instructions}</p>}
              {open === t.id && t.qr && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-bg p-4">
                  <QrCode value={t.qr} size={260} label={`QR Code do ingresso de ${t.name}`} />
                  <p className="font-mono tracking-widest">{t.code}</p>
                  <p className="text-xs text-muted">Apresente na entrada. Aumente o brilho da tela.</p>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Transferência de titularidade e cancelamento: fale com a ACIESC (política em definição).
      </p>
    </div>
  );
}
