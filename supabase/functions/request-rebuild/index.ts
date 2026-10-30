// Pede ao GitHub um novo build/deploy do site estático (evento publicado ou alterado).
import { isCron, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: "unauthorized" }, 401);
  const repo = Deno.env.get("GITHUB_REPO"); // "owner/nome"
  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  if (!repo || !token) return json({ skipped: "GITHUB_REPO/GITHUB_DISPATCH_TOKEN ausentes" });

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: "rebuild" }),
  });
  if (res.status !== 204) return json({ error: `GitHub ${res.status}` }, 502);
  return json({ ok: true });
});
