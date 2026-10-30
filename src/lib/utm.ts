"use client";

const KEY = "aciesc_utm";

// Guarda a origem da visita (UTM) para registrar no pedido.
export function captureUtm() {
  try {
    const p = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign"].map((k) => [k, p.get(k)]).filter(([, v]) => v),
    );
    if (Object.keys(utm).length) sessionStorage.setItem(KEY, JSON.stringify(utm));
  } catch {}
}

export function currentUtm(): Record<string, string> {
  let utm: Record<string, string> = {};
  try {
    utm = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {}
  const device = /Mobi|Android|iPhone/i.test(navigator.userAgent)
    ? "celular"
    : /iPad|Tablet/i.test(navigator.userAgent)
      ? "tablet"
      : "computador";
  return { ...utm, device };
}
