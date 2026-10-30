export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Chamadas internas (pg_cron) autenticadas por segredo compartilhado.
export function isCron(req: Request) {
  const secret = Deno.env.get("CRON_SECRET");
  return !!secret && req.headers.get("x-cron-secret") === secret;
}
