const TZ = "America/Sao_Paulo";

export function money(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  if (n === 0) return "Grátis";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function moneyPlain(v: number | string | null | undefined) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateLong(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
}

export function dateShort(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).format(new Date(iso));
}

export function time(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(new Date(iso));
}

// "2026-11-12T19:00" (horário de Brasília) → ISO UTC
export function localInputToIso(v: string) {
  if (!v) return "";
  return new Date(`${v}:00-03:00`).toISOString();
}

// ISO → valor para <input type="datetime-local"> em horário de Brasília
export function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const TIER_LABEL: Record<string, string> = {
  associate: "Associado",
  adept: "Adepto",
  other: "Sem vínculo",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  closed: "Encerrado",
  cancelled: "Cancelado",
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  valid: "Válido",
  used: "Utilizado",
  transferred: "Transferido",
  waiting: "Aguardando",
  offered: "Vaga oferecida",
  accepted: "Aceitou",
  expired: "Expirou",
  removed: "Removido",
};

// Mensagem amigável de erro do Supabase/PostgREST.
export function errorMessage(e: unknown) {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão. Verifique sua internet e tente novamente.";
  if (/JWT|not authenticated/i.test(m)) return "Sua sessão expirou. Entre novamente.";
  return m;
}

export function whatsappLink(digits: string, text?: string) {
  return `https://wa.me/${digits.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
