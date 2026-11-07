import { describe, expect, it } from "vitest";
import { drawSession, InsufficientQuestionsError, type PoolQuestion } from "@/lib/draw";
import { seededRng } from "@/lib/random";
import type { Level } from "@/lib/scoring";

/** Banco sintético: `perLevel` perguntas por nível em cada uma das `categories` categorias. */
function makePool(categories = 10, perLevel = 5): PoolQuestion[] {
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

describe("drawSession — regras gerais", () => {
  const pool = makePool();

  it("sempre 20 perguntas, 5 por nível, na ordem fácil → avançado, sem repetir", () => {
    for (const seed of SEEDS) {
      for (const items of [
        drawSession({ mode: "MIXED", pool, rng: seededRng(seed) }),
        drawSession({ mode: "CATEGORY", categoryId: 3, pool, rng: seededRng(seed) }),
      ]) {
        expect(items).toHaveLength(20);
        expect(items.map((i) => i.position)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
        expect(items.map((i) => i.level)).toEqual(
          [1, 2, 3, 4].flatMap((l) => Array(5).fill(l)),
        );
        expect(new Set(items.map((i) => i.questionId)).size).toBe(20);
      }
    }
  });

  it("alternativas: sempre as 4 da pergunta, em ordem embaralhada", () => {
    const items = drawSession({ mode: "MIXED", pool, rng: seededRng(7) });
    let reordered = 0;
    for (const item of items) {
      const original = pool.find((q) => q.id === item.questionId)!.optionIds;
      expect([...item.optionOrder].sort()).toEqual([...original].sort());
      if (item.optionOrder.join() !== original.join()) reordered++;
    }
    expect(reordered).toBeGreaterThan(10); // a maioria sai fora da ordem original
  });

  it("é determinístico para a mesma semente", () => {
    const a = drawSession({ mode: "MIXED", pool, rng: seededRng(42) });
    const b = drawSession({ mode: "MIXED", pool, rng: seededRng(42) });
    expect(a).toEqual(b);
  });
});

describe("drawSession — Temas Variados", () => {
  const pool = makePool();

  it("1000 sorteios sem 2 perguntas seguidas do mesmo tema", () => {
    for (const seed of SEEDS) {
      const items = drawSession({ mode: "MIXED", pool, rng: seededRng(seed) });
      for (let i = 1; i < items.length; i++) {
        expect(items[i].categoryId).not.toBe(items[i - 1].categoryId);
      }
    }
  });

  it("cada bloco usa 5 categorias diferentes", () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const items = drawSession({ mode: "MIXED", pool, rng: seededRng(seed) });
      for (let b = 0; b < 4; b++) {
        expect(new Set(items.slice(b * 5, b * 5 + 5).map((i) => i.categoryId)).size).toBe(5);
      }
    }
  });

  it("funciona com o mínimo de 5 categorias", () => {
    const small = makePool(5, 1);
    for (const seed of SEEDS.slice(0, 200)) {
      const items = drawSession({ mode: "MIXED", pool: small, rng: seededRng(seed) });
      for (let i = 1; i < items.length; i++) {
        expect(items[i].categoryId).not.toBe(items[i - 1].categoryId);
      }
    }
  });

  it("falha com menos de 5 categorias num nível", () => {
    expect(() => drawSession({ mode: "MIXED", pool: makePool(4, 5) })).toThrow(InsufficientQuestionsError);
  });
});

describe("drawSession — Por Categoria", () => {
  it("só usa perguntas da categoria escolhida", () => {
    const items = drawSession({ mode: "CATEGORY", categoryId: 2, pool: makePool(), rng: seededRng(1) });
    expect(items.every((i) => i.categoryId === 2)).toBe(true);
  });

  it("falha se a categoria não tiver 5 perguntas em algum nível", () => {
    const pool = makePool().filter((q) => !(q.categoryId === 2 && q.level === 3 && q.id.endsWith("q4")));
    expect(() => drawSession({ mode: "CATEGORY", categoryId: 2, pool })).toThrow(InsufficientQuestionsError);
  });
});

describe("drawSession — evita perguntas recentes", () => {
  it("com estoque, não repete nenhuma pergunta recente", () => {
    const pool = makePool(10, 10);
    for (const seed of SEEDS.slice(0, 100)) {
      const first = drawSession({ mode: "CATEGORY", categoryId: 1, pool, rng: seededRng(seed) });
      const recent = new Set(first.map((i) => i.questionId));
      const second = drawSession({ mode: "CATEGORY", categoryId: 1, pool, recentIds: recent, rng: seededRng(seed + 1) });
      expect(second.some((i) => recent.has(i.questionId))).toBe(false);
    }
  });

  it("sem estoque, completa com perguntas já vistas", () => {
    const pool = makePool(10, 6); // 6 por nível: só 1 inédita por nível depois da 1ª sessão
    const first = drawSession({ mode: "CATEGORY", categoryId: 1, pool, rng: seededRng(5) });
    const recent = new Set(first.map((i) => i.questionId));
    const second = drawSession({ mode: "CATEGORY", categoryId: 1, pool, recentIds: recent, rng: seededRng(6) });
    expect(second).toHaveLength(20);
    expect(second.filter((i) => !recent.has(i.questionId))).toHaveLength(4); // a inédita de cada nível
  });

  it("no modo variado, prefere inéditas em cada categoria", () => {
    const pool = makePool(10, 3);
    const recent = new Set(pool.filter((q) => !q.id.endsWith("q2")).map((q) => q.id)); // só q2 é inédita
    for (const seed of SEEDS.slice(0, 100)) {
      const items = drawSession({ mode: "MIXED", pool, recentIds: recent, rng: seededRng(seed) });
      expect(items.every((i) => !recent.has(i.questionId))).toBe(true);
    }
  });
});
