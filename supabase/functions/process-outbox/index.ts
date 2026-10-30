// Envia a fila de mensagens (e-mail via Resend; WhatsApp via provider configurado).
// Chamado a cada minuto pelo pg_cron (private.dispatch_http) com x-cron-secret.
import { adminClient } from "../_shared/admin.ts";
import { isCron, json } from "../_shared/http.ts";
import { messagingProvider } from "../_shared/messaging.ts";
import { renderEmail, whatsappVariables } from "../_shared/templates.ts";

type Message = {
  id: number;
  channel: "email" | "whatsapp";
  template: string;
  to_address: string;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
};

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: "unauthorized" }, 401);
  const db = adminClient();
  const { data, error } = await db.rpc("claim_outbox", { p_limit: 50 });
  if (error) return json({ error: error.message }, 500);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") ?? "ACIESC Eventos <eventos@aciesc.com.br>";
  const whatsapp = messagingProvider();
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const m of (data ?? []) as Message[]) {
    try {
      if (m.channel === "email") {
        if (!resendKey) {
          await db.rpc("mark_message", { p_id: m.id, p_status: "skipped", p_error: "RESEND_API_KEY ausente" });
          results.skipped++;
          continue;
        }
        const { subject, html } = renderEmail(m.template, m.payload);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `msg-${m.id}`,
          },
          body: JSON.stringify({ from, to: [m.to_address], subject, html }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      } else {
        if (!whatsapp) {
          await db.rpc("mark_message", { p_id: m.id, p_status: "skipped", p_error: "WhatsApp não configurado" });
          results.skipped++;
          continue;
        }
        await whatsapp.sendTemplate(m.to_address, m.template, whatsappVariables(m.payload));
      }
      await db.rpc("mark_message", { p_id: m.id, p_status: "sent" });
      results.sent++;
    } catch (e) {
      await db.rpc("mark_message", { p_id: m.id, p_status: "failed", p_error: String(e) });
      results.failed++;
    }
  }
  return json(results);
});
