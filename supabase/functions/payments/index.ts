// Cria a cobrança (Pix ou cartão via checkout do gateway) para um pedido pendente.
// O id do pedido funciona como token; o valor vem sempre do banco, nunca do navegador.
import { adminClient } from "../_shared/admin.ts";
import { cors, json } from "../_shared/http.ts";
import { PaymentNotConfiguredError, paymentProvider } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { order_id } = await req.json().catch(() => ({}));
  if (typeof order_id !== "string") return json({ error: "Pedido inválido." }, 400);

  const db = adminClient();
  const { data: order } = await db
    .from("orders")
    .select("id,total,installments,payment_method,status,buyer_email,expires_at,people:buyer_person_id(full_name,cpf),events(title)")
    .eq("id", order_id)
    .maybeSingle();
  if (!order || order.status !== "pending" || Number(order.total) <= 0) {
    return json({ error: "Pedido não está aguardando pagamento." }, 409);
  }

  const { data: existing } = await db.from("order_payments").select("*").eq("order_id", order_id).maybeSingle();
  if (existing) return json(existing);

  const provider = paymentProvider();
  // deno-lint-ignore no-explicit-any
  const o = order as any;
  const input = {
    id: o.id,
    total: Number(o.total),
    installments: o.installments,
    buyer_email: o.buyer_email,
    buyer_name: o.people?.full_name ?? "",
    buyer_cpf: o.people?.cpf ?? "",
    description: o.events?.title ?? "Ingresso ACIESC",
  };
  try {
    if (o.payment_method === "pix") {
      const pix = await provider.createPixCharge(input);
      const row = {
        order_id, method: "pix", pix_qr_image: pix.qrImage, pix_copy_paste: pix.copyPaste, expires_at: pix.expiresAt,
      };
      await db.from("order_payments").insert(row);
      await db.from("orders").update({ provider: provider.name, provider_ref: pix.providerRef, expires_at: pix.expiresAt })
        .eq("id", order_id);
      return json(row);
    }
    const card = await provider.createCardCharge(input);
    const row = { order_id, method: "card", checkout_url: card.checkoutUrl };
    await db.from("order_payments").insert(row);
    await db.from("orders").update({ provider: provider.name, provider_ref: card.providerRef, expires_at: null })
      .eq("id", order_id);
    return json(row);
  } catch (e) {
    if (e instanceof PaymentNotConfiguredError) {
      return json({ error: "Pagamento online indisponível no momento." }, 503);
    }
    console.error(e);
    return json({ error: "Não foi possível gerar a cobrança. Tente novamente." }, 502);
  }
});
