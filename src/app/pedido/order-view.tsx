"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QrCode } from "@/components/qr";
import { Alert, Badge, Button, ButtonLink, Card, Spinner, statusTone } from "@/components/ui";
import { downloadIcs } from "@/lib/calendar";
import { dateLong, errorMessage, money, STATUS_LABEL, time } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Order = {
  id: string;
  status: string;
  total: number;
  payment_method: string;
  installments: number;
  expires_at: string | null;
  event: { title: string; slug: string };
  date: { starts_at: string; ends_at: string };
  payment: { method: string; pix_qr_image: string | null; pix_copy_paste: string | null; checkout_url: string | null; expires_at: string | null } | null;
  tickets: { id: string; name: string; status: string; type: string; qr: string | null }[];
};

export function OrderView() {
  const id = useSearchParams().get("id") ?? "";
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [payError, setPayError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    () =>
      getSupabase()
        .rpc("get_order", { p_order_id: id })
        .then(({ data }) => setOrder((data as unknown as Order) ?? null)),
    [id],
  );

  useEffect(() => {
    getSupabase()
      .rpc("get_order", { p_order_id: id })
      .then(({ data }) => setOrder((data as unknown as Order) ?? null));
  }, [id]);

  // Atualiza sozinho enquanto o pagamento não é confirmado pelo webhook.
  useEffect(() => {
    if (order?.status !== "pending") return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [order?.status, load]);

  async function startPayment() {
    setPayError(null);
    const { error } = await getSupabase().functions.invoke("payments", { body: { order_id: id } });
    if (error) setPayError(errorMessage(error.context?.status === 503 ? { message: "Pagamento online indisponível no momento." } : error));
    load();
  }

  if (order === undefined) return <Spinner />;
  if (order === null) return <Alert>Pedido não encontrado.</Alert>;

  if (order.status === "pending") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Aguardando pagamento</h1>
        <Card>
          <p className="font-bold">{order.event.title}</p>
          <p className="text-sm text-muted">{dateLong(order.date.starts_at)} · {time(order.date.starts_at)}</p>
          <p className="mt-2 text-xl font-extrabold">{money(order.total)}</p>
        </Card>
        {order.payment?.method === "pix" && order.payment.pix_copy_paste ? (
          <Card className="flex flex-col items-center gap-4 text-center">
            {order.payment.pix_qr_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.payment.pix_qr_image.startsWith("data:") || order.payment.pix_qr_image.startsWith("http") ? order.payment.pix_qr_image : `data:image/png;base64,${order.payment.pix_qr_image}`} alt="QR Code Pix" className="size-56" />
            ) : (
              <QrCode value={order.payment.pix_copy_paste} label="QR Code Pix" />
            )}
            <p className="text-sm text-muted">Abra o app do seu banco, escolha Pix e leia o QR Code ou use o copia e cola.</p>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(order.payment!.pix_copy_paste!);
                setCopied(true);
              }}
            >
              {copied ? "Código copiado!" : "Copiar código Pix"}
            </Button>
            {order.payment.expires_at && <p className="text-xs text-muted">Válido até {time(order.payment.expires_at)}.</p>}
            <p className="text-sm font-semibold text-brand" role="status">Esta página atualiza sozinha quando o pagamento for confirmado.</p>
          </Card>
        ) : order.payment?.checkout_url ? (
          <Card className="flex flex-col gap-3">
            <p>Conclua o pagamento com cartão no ambiente seguro do meio de pagamento.</p>
            <a href={order.payment.checkout_url} className="btn-primary">Pagar com cartão</a>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            <p>Gere a cobrança para concluir sua inscrição.</p>
            <Button onClick={startPayment}>Gerar pagamento</Button>
            {payError && <Alert>{payError}</Alert>}
          </Card>
        )}
      </div>
    );
  }

  if (order.status !== "paid") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Pedido {STATUS_LABEL[order.status]?.toLowerCase()}</h1>
        <Alert tone="warn">Este pedido não está ativo. Se precisar de ajuda, fale com a ACIESC.</Alert>
        <ButtonLink href={`/e/${order.event.slug}/`} variant="secondary">Voltar ao evento</ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-hero p-6 text-white">
        <p className="text-sm font-semibold text-accent">Inscrição confirmada</p>
        <h1 className="text-2xl font-black uppercase">{order.event.title}</h1>
        <p className="mt-1 text-white/90">{dateLong(order.date.starts_at)} · {time(order.date.starts_at)}</p>
      </div>
      <Alert tone="info">Enviamos os ingressos por e-mail. Eles também ficam em “Meus ingressos”.</Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        {order.tickets.map((t) => (
          <Card key={t.id} className="flex flex-col items-center gap-2 text-center">
            <p className="font-bold">{t.name}</p>
            <p className="text-sm text-muted">{t.type}</p>
            {t.qr ? <QrCode value={t.qr} label={`QR Code do ingresso de ${t.name}`} /> : <Badge tone={statusTone(t.status)}>{STATUS_LABEL[t.status]}</Badge>}
            {t.qr && <p className="font-mono text-sm tracking-widest">{t.qr.split(".")[0]}</p>}
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => downloadIcs({ title: order.event.title, start: order.date.starts_at, end: order.date.ends_at, url: `${location.origin}/e/${order.event.slug}/` })}
        >
          Adicionar à agenda
        </Button>
        <ButtonLink href="/meus-ingressos/" variant="secondary">Meus ingressos</ButtonLink>
        <Link href="/" className="inline-flex min-h-11 items-center px-3 font-semibold text-brand">Ver mais eventos</Link>
      </div>
    </div>
  );
}
