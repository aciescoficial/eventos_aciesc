import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "./cpf";

describe("cpf", () => {
  it("normaliza removendo pontuação", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });

  it("aceita CPFs válidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejeita dígitos verificadores errados, repetidos e tamanho inválido", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("formata e mascara", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("529.982.247-25")).toBe("***.982.247-**");
    expect(maskCpf("123")).toBe("***.***.***-**");
  });
});
