import { describe, expect, it } from "vitest";
import { maskCpfInput, maskPhoneInput } from "./cpf-input";
import { parseCsv, toCsv } from "./csv";
import { slugify, localInputToIso, isoToLocalInput } from "./format";

describe("máscaras", () => {
  it("CPF progressivo", () => {
    expect(maskCpfInput("529")).toBe("529");
    expect(maskCpfInput("5299822")).toBe("529.982.2");
    expect(maskCpfInput("52998224725")).toBe("529.982.247-25");
  });
  it("telefone", () => {
    expect(maskPhoneInput("47999998888")).toBe("(47) 99999-8888");
  });
});

describe("csv", () => {
  it("lê ponto e vírgula, aspas e acentos no cabeçalho", () => {
    const rows = parseCsv('﻿Nome;CPF;Situação\n"Silva; Ana";529.982.247-25;active\n');
    expect(rows).toEqual([{ nome: "Silva; Ana", cpf: "529.982.247-25", situacao: "active" }]);
  });
  it("escreve com escape", () => {
    expect(toCsv([{ a: 'x"y', b: 1 }], [{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe('A;B\n"x""y";1');
  });
});

describe("format", () => {
  it("slug", () => expect(slugify("Curso Lead Milionário 2026!")).toBe("curso-lead-milionario-2026"));
  it("horário de Brasília ida e volta", () => {
    const iso = localInputToIso("2026-11-12T19:00");
    expect(iso).toBe("2026-11-12T22:00:00.000Z");
    expect(isoToLocalInput(iso)).toBe("2026-11-12T19:00");
  });
});
