import { describe, expect, it } from "vitest";
import { isPeriod, periodFromSlug, periodStart, rankingHref } from "@/lib/ranking";

// São Paulo está em UTC-3 (sem horário de verão desde 2019): meia-noite local = 03:00 UTC.
const utc = (iso: string) => new Date(iso);

describe("periodStart (fuso America/Sao_Paulo)", () => {
  it("Sempre não tem início", () => {
    expect(periodStart("all", utc("2026-11-07T15:00:00Z"))).toBeNull();
  });

  it("Hoje começa à meia-noite de São Paulo", () => {
    expect(periodStart("today", utc("2026-11-07T15:00:00Z"))).toEqual(utc("2026-11-07T03:00:00Z"));
  });

  it("entre 0h e 3h UTC ainda é o dia anterior em São Paulo", () => {
    // 01:30 UTC de 08/11 = 22:30 de 07/11 em São Paulo
    expect(periodStart("today", utc("2026-11-08T01:30:00Z"))).toEqual(utc("2026-11-07T03:00:00Z"));
  });

  it("exatamente à meia-noite local já é o novo dia", () => {
    expect(periodStart("today", utc("2026-11-08T03:00:00Z"))).toEqual(utc("2026-11-08T03:00:00Z"));
  });

  it("Semana começa na segunda-feira", () => {
    // 07/11/2026 é sábado → segunda 02/11
    expect(periodStart("week", utc("2026-11-07T15:00:00Z"))).toEqual(utc("2026-11-02T03:00:00Z"));
    // domingo 08/11 ainda é a semana de 02/11
    expect(periodStart("week", utc("2026-11-08T20:00:00Z"))).toEqual(utc("2026-11-02T03:00:00Z"));
    // na própria segunda-feira
    expect(periodStart("week", utc("2026-11-09T12:00:00Z"))).toEqual(utc("2026-11-09T03:00:00Z"));
  });

  it("Semana que começa no mês anterior", () => {
    // quinta 01/10/2026 → segunda 28/09
    expect(periodStart("week", utc("2026-10-01T12:00:00Z"))).toEqual(utc("2026-09-28T03:00:00Z"));
  });

  it("Mês começa no dia 1", () => {
    expect(periodStart("month", utc("2026-11-07T15:00:00Z"))).toEqual(utc("2026-11-01T03:00:00Z"));
  });

  it("virada do ano em São Paulo", () => {
    // 01/01/2027 02:00 UTC = 31/12/2026 23:00 em São Paulo
    const now = utc("2027-01-01T02:00:00Z");
    expect(periodStart("today", now)).toEqual(utc("2026-12-31T03:00:00Z"));
    expect(periodStart("month", now)).toEqual(utc("2026-12-01T03:00:00Z"));
  });

  it("aceita outro fuso (UTC)", () => {
    expect(periodStart("today", utc("2026-11-07T15:00:00Z"), "UTC")).toEqual(utc("2026-11-07T00:00:00Z"));
  });
});

describe("filtros da URL", () => {
  it("converte o período em português e usa Sempre como padrão", () => {
    expect(periodFromSlug("hoje")).toBe("today");
    expect(periodFromSlug("semana")).toBe("week");
    expect(periodFromSlug("mes")).toBe("month");
    expect(periodFromSlug("sempre")).toBe("all");
    expect(periodFromSlug(undefined)).toBe("all");
    expect(periodFromSlug("ontem")).toBe("all");
  });

  it("monta a URL da página de ranking", () => {
    expect(rankingHref(null)).toBe("/ranking");
    expect(rankingHref(null, "week")).toBe("/ranking?periodo=semana");
    expect(rankingHref("geografia", "today")).toBe("/ranking?categoria=geografia&periodo=hoje");
    expect(rankingHref("brasil", "all")).toBe("/ranking?categoria=brasil");
  });

  it("isPeriod", () => {
    expect(isPeriod("week")).toBe(true);
    expect(isPeriod("semana")).toBe(false);
    expect(isPeriod(3)).toBe(false);
  });
});
