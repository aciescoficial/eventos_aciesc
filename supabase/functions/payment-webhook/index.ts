// Webhook do gateway: valida assinatura no provider, registra o evento (idempotente) e confirma o pedido.
// Nunca confirmamos pagamento pelo retorno do navegador.
import { adminClient } from "../_shared/admin.ts";
import { json } from "../_shared/http.ts";
import { paymentProvider } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  const provider = paymentProvider();
  const event = await provider.verifyWebhook(req, raw);
  if (!event) return json({ error: "assinatura inválida" }, 401);

  // Confere o status direto no gateway (servidor-servidor) antes de confirmar.
  const remote = await provider.getPayment(event.providerRef).catch(() => null);
  const status = remote?.status ?? event.status;

  const { data, error } = await adminClient().rpc("payment_confirm", {
    p_provider: provider.name,
    p_event_id: event.eventId,
    p_order_id: event.orderId,
    p_provider_ref: event.providerRef,
    p_status: status,
    p_payload: JSON.parse(raw || "{}"),
  });
  if (error) {
    console.error(error);
    return json({ error: "falha ao registrar" }, 500);
  }
  return json({ result: data });
});
