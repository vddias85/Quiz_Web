// Modo Por Nível (PRD v1.8): sorteio, pontuação e filtros do ranking.
import { describe, expect, it } from "vitest";
import { drawSession, InsufficientQuestionsError, type PoolQuestion } from "@/lib/draw";
import { modeLabel, rankingFilter, rankingName } from "@/lib/modes";
import { seededRng } from "@/lib/random";
import { levelFromSlug, rankingHref } from "@/lib/ranking";
import {
  breakdownByLevel,
  LEVEL_MODE_QUESTIONS,
  LEVELS,
  levelOfItem,
  pointsPerCorrect,
  questionsInSession,
  scoreTenths,
  type Level,
} from "@/lib/scoring";

/** Banco sintético: `perLevel` perguntas por nível em cada uma das `categories` categorias. */
function makePool(categories = 10, perLevel = 15): PoolQuestion[] {
  const pool: PoolQuestion[] = [];
  for (let c = 1; c <= categories; c++) {
    for (const level of [1, 2, 3, 4] as Level[]) {
      for (let i = 0; i < perLevel; i++) {
        const id = `c${c}l${level}q${i}`;
        pool.push({ id, categoryId: c, level, optionIds: [0, 1, 2, 3].map((o) => `${id}o${o}`) });
      }
    }
  }
  return pool;
}

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);

describe("sorteio do modo Por Nível", () => {
  const pool = makePool();

  it("10 perguntas do nível escolhido, sem repetir e com as 4 alternativas embaralhadas", () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS.slice(0, 250)) {
        const items = drawSession({ mode: "LEVEL", level, pool, rng: seededRng(seed) });
        expect(items).toHaveLength(LEVEL_MODE_QUESTIONS);
        expect(items.map((i) => i.position)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
        expect(items.every((i) => i.level === level)).toBe(true);
        expect(new Set(items.map((i) => i.questionId)).size).toBe(10);
        for (const item of items) {
          const original = pool.find((q) => q.id === item.questionId)!.optionIds;
          expect([...item.optionOrder].sort()).toEqual([...original].sort());
        }
      }
    }
  });

  it("nunca duas perguntas seguidas do mesmo tema; com 10 categorias, uma de cada", () => {
    for (const seed of SEEDS) {
      const items = drawSession({ mode: "LEVEL", level: 3, pool, rng: seededRng(seed) });
      for (let i = 1; i < items.length; i++) expect(items[i].categoryId).not.toBe(items[i - 1].categoryId);
      expect(new Set(items.map((i) => i.categoryId)).size).toBe(10);
    }
  });

  it("com poucas categorias, repete tema mas nunca em sequência", () => {
    const small = makePool(3, 15); // 3 categorias × 15 perguntas por nível
    for (const seed of SEEDS.slice(0, 300)) {
      const items = drawSession({ mode: "LEVEL", level: 2, pool: small, rng: seededRng(seed) });
      expect(items).toHaveLength(10);
      for (let i = 1; i < items.length; i++) expect(items[i].categoryId).not.toBe(items[i - 1].categoryId);
    }
  });

  it("prefere perguntas inéditas enquanto houver estoque", () => {
    const first = drawSession({ mode: "LEVEL", level: 1, pool, rng: seededRng(5) });
    const recentIds = new Set(first.map((i) => i.questionId));
    for (const seed of SEEDS.slice(0, 200)) {
      const next = drawSession({ mode: "LEVEL", level: 1, pool, recentIds, rng: seededRng(seed) });
      expect(next.some((i) => recentIds.has(i.questionId))).toBe(false);
    }
  });

  it("é determinístico para a mesma semente", () => {
    const a = drawSession({ mode: "LEVEL", level: 4, pool, rng: seededRng(42) });
    const b = drawSession({ mode: "LEVEL", level: 4, pool, rng: seededRng(42) });
    expect(a).toEqual(b);
  });

  it("recusa estoque insuficiente (menos de 10 perguntas ou uma categoria só)", () => {
    expect(() => drawSession({ mode: "LEVEL", level: 1, pool: makePool(2, 4) })).toThrow(InsufficientQuestionsError);
    expect(() => drawSession({ mode: "LEVEL", level: 1, pool: makePool(1, 15) })).toThrow(InsufficientQuestionsError);
  });

  it("não interfere nos modos de 20 perguntas", () => {
    const items = drawSession({ mode: "MIXED", pool, rng: seededRng(1) });
    expect(items).toHaveLength(20);
  });
});

describe("pontuação do modo Por Nível", () => {
  const shape = { mode: "LEVEL" as const, level: 3 };

  it("10 perguntas, todas do nível da sessão", () => {
    expect(questionsInSession(shape)).toBe(10);
    expect(questionsInSession({ mode: "MIXED" })).toBe(20);
    expect(levelOfItem(shape, 1)).toBe(3);
    expect(levelOfItem(shape, 10)).toBe(3);
    expect(() => levelOfItem(shape, 11)).toThrow(RangeError);
    expect(() => levelOfItem({ mode: "LEVEL", level: 7 }, 1)).toThrow(RangeError);
    expect(levelOfItem({ mode: "CATEGORY" }, 20)).toBe(4);
  });

  it("cada acerto vale 1,0 (10 décimos), em qualquer nível", () => {
    for (const level of LEVELS) expect(pointsPerCorrect({ mode: "LEVEL", level }, level)).toBe(10);
    expect(pointsPerCorrect({ mode: "MIXED" }, 1)).toBe(3);
  });

  it("10 acertos = 10,0; 7 acertos = 7,0; nenhum = 0,0", () => {
    const items = (hits: number) => Array.from({ length: 10 }, (_, i) => ({ level: 3 as Level, isCorrect: i < hits }));
    expect(scoreTenths(items(10), shape)).toBe(100);
    expect(scoreTenths(items(7), shape)).toBe(70);
    expect(scoreTenths(items(0), shape)).toBe(0);
  });

  it("o resumo por nível mostra só o nível da sessão", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ level: 3 as Level, isCorrect: i < 6 }));
    expect(breakdownByLevel(items, shape)).toEqual([
      { level: 3, label: "Difícil", correct: 6, total: 10, pointsTenths: 60, maxTenths: 100 },
    ]);
  });
});

describe("textos e filtros do modo Por Nível", () => {
  it("nomes do modo e do ranking", () => {
    expect(modeLabel({ mode: "LEVEL", level: 2 })).toBe("📶 Nível Médio");
    expect(modeLabel({ mode: "MIXED" })).toBe("🎲 Temas Variados");
    expect(modeLabel({ mode: "CATEGORY", category: { icon: "🌎", name: "Geografia" } })).toBe("🌎 Geografia");
    expect(rankingName({ mode: "LEVEL", level: 4 })).toBe("ranking do nível Avançado");
    expect(rankingName({ mode: "MIXED" })).toBe("ranking Geral");
  });

  it("URL do ranking por nível", () => {
    expect(rankingHref({ nivel: 3 })).toBe("/ranking?nivel=dificil");
    expect(rankingHref({ nivel: 1 }, "week")).toBe("/ranking?nivel=facil&periodo=semana");
    expect(rankingHref(rankingFilter({ mode: "LEVEL", level: 4 }))).toBe("/ranking?nivel=avancado");
    expect(rankingHref(rankingFilter({ mode: "CATEGORY", category: { icon: "", name: "", slug: "brasil" } }))).toBe(
      "/ranking?categoria=brasil",
    );
    expect(rankingHref(rankingFilter({ mode: "MIXED" }))).toBe("/ranking");
  });

  it("lê o nível da URL", () => {
    expect(levelFromSlug("facil")).toBe(1);
    expect(levelFromSlug("avancado")).toBe(4);
    expect(levelFromSlug("impossivel")).toBeNull();
    expect(levelFromSlug(undefined)).toBeNull();
  });
});
