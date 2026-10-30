"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Card, Spinner } from "@/components/ui";
import { dateLong, errorMessage, time } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Info = { name: string; event_title: string; starts_at: string; status: string; presence_confirmed: boolean | null; open: boolean };

export function Presence() {
  const token = useSearchParams().get("t") ?? "";
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSupabase().rpc("presence_info", { p_token: token }).then(({ data }) => setInfo((data as unknown as Info) ?? null));
  }, [token]);

  async function answer(going: boolean) {
    setBusy(true);
    const { data, error } = await getSupabase().rpc("confirm_presence", { p_token: token, p_going: going });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setResult(String(data));
  }

  if (info === undefined) return <Spinner />;
  if (!info) return <Alert>Link inválido.</Alert>;
  if (result === "confirmed" || (info.presence_confirmed && !result))
    return <Alert tone="info">Presença confirmada, {info.name}! Até {dateLong(info.starts_at)}.</Alert>;
  if (result === "cancelled") return <Alert tone="info">Tudo bem! Liberamos sua vaga para a lista de espera. Obrigado por avisar.</Alert>;
  if (!info.open) return <Alert tone="warn">Este ingresso não aceita mais confirmação.</Alert>;

  return (
    <Card className="flex flex-col gap-4">
      <p>Olá, <strong>{info.name}</strong>!</p>
      <p>
        Você vai participar de <strong>{info.event_title}</strong> em {dateLong(info.starts_at)} às {time(info.starts_at)}?
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={() => answer(true)} disabled={busy}>Confirmo</Button>
        <Button variant="secondary" onClick={() => answer(false)} disabled={busy}>Não vou poder ir</Button>
      </div>
    </Card>
  );
}
