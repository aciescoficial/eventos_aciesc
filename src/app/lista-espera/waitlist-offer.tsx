"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Spinner } from "@/components/ui";
import { dateLong, dateTime, time } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Offer = { status: string; reservation_id: string | null; expires_at: string | null; event_title: string; starts_at: string };

export function WaitlistOffer() {
  const token = useSearchParams().get("t") ?? "";
  const router = useRouter();
  const [o, setO] = useState<Offer | null | undefined>(undefined);

  useEffect(() => {
    getSupabase().rpc("waitlist_offer", { p_token: token }).then(({ data }) => setO((data as unknown as Offer) ?? null));
  }, [token]);

  if (o === undefined) return <Spinner />;
  if (!o) return <Alert>Link inválido.</Alert>;
  if (o.status === "accepted") return <Alert tone="info">Você já garantiu esta vaga. Veja em “Meus ingressos”.</Alert>;
  if (o.status !== "offered" || !o.reservation_id)
    return <Alert tone="warn">Esta oferta não está mais disponível{o.status === "expired" ? " (o prazo expirou)" : ""}.</Alert>;

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-lg font-bold">Abriu uma vaga para você!</p>
      <p>
        <strong>{o.event_title}</strong> — {dateLong(o.starts_at)} às {time(o.starts_at)}
      </p>
      <p className="text-sm text-muted">Garanta até {dateTime(o.expires_at)}.</p>
      <Button onClick={() => router.push(`/checkout/?r=${o.reservation_id}`)}>Garantir minha vaga</Button>
    </Card>
  );
}
