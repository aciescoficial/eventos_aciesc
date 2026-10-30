import { describe, expect, it } from "vitest";
import { tierPrice } from "./pricing";

describe("tierPrice (prévia)", () => {
  it("modos", () => {
    expect(tierPrice(199.99, "free", 0)).toBe(0);
    expect(tierPrice(199.99, "full", 0)).toBe(199.99);
    expect(tierPrice(199.99, "fixed", 50)).toBe(50);
    expect(tierPrice(199.99, "percent", 50)).toBe(100);
    expect(tierPrice(10.05, "percent", 50)).toBe(5.03);
    expect(tierPrice(100, "blocked", 0)).toBeNull();
  });
  it("nunca negativo", () => {
    expect(tierPrice(100, "percent", 150)).toBe(0);
    expect(tierPrice(100, "fixed", -5)).toBe(0);
  });
});
