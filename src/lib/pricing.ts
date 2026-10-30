// Espelho da regra do servidor (private.tier_price) apenas para PRÉVIA no painel.
// O preço cobrado é sempre calculado no banco.
export type PriceMode = "free" | "percent" | "fixed" | "full" | "blocked";

export function tierPrice(base: number, mode: PriceMode, value: number): number | null {
  switch (mode) {
    case "free":
      return 0;
    case "full":
      return base;
    case "fixed":
      return Math.max(value, 0);
    case "percent":
      return Math.max(roundHalfUp(base * (1 - value / 100)), 0);
    default:
      return null;
  }
}

export function roundHalfUp(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
