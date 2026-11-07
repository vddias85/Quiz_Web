import { describe, expect, it } from "vitest";
import {
  breakdownByLevel,
  formatScore,
  levelForPosition,
  MAX_SCORE_TENTHS,
  scoreTenths,
  type Level,
  type ScoredItem,
} from "@/lib/scoring";

/** Monta as 20 respostas a partir de quais posições (1–20) foram acertadas. */
function session(correctPositions: number[]): ScoredItem[] {
  return Array.from({ length: 20 }, (_, i) => ({
    level: levelForPosition(i + 1),
    isCorrect: correctPositions.includes(i + 1),
  }));
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("levelForPosition", () => {
  it("segue a escada 1–5, 6–10, 11–15, 16–20", () => {
    const levels = range(1, 20).map(levelForPosition);
    expect(levels).toEqual([...Array(5).fill(1), ...Array(5).fill(2), ...Array(5).fill(3), ...Array(5).fill(4)]);
  });
  it.each([0, 21, 1.5, -1])("rejeita a posição %s", (p) => {
    expect(() => levelForPosition(p)).toThrow(RangeError);
  });
});

describe("scoreTenths", () => {
  it("nota máxima é 10,0", () => {
    expect(MAX_SCORE_TENTHS).toBe(100);
    expect(scoreTenths(session(range(1, 20)))).toBe(100);
  });
  it("nenhum acerto é 0,0", () => {
    expect(scoreTenths(session([]))).toBe(0);
  });
  it("exemplo do PRD: todas as fáceis e médias = 3,5", () => {
    expect(scoreTenths(session(range(1, 10)))).toBe(35);
  });
  it("exemplo do PRD: só as 5 avançadas = 3,5", () => {
    expect(scoreTenths(session(range(16, 20)))).toBe(35);
  });
  it("cada bloco vale 1,5 / 2,0 / 3,0 / 3,5", () => {
    expect(scoreTenths(session(range(1, 5)))).toBe(15);
    expect(scoreTenths(session(range(6, 10)))).toBe(20);
    expect(scoreTenths(session(range(11, 15)))).toBe(30);
    expect(scoreTenths(session(range(16, 20)))).toBe(35);
  });
  it("não respondida (null) conta como erro", () => {
    expect(scoreTenths([{ level: 4, isCorrect: null }])).toBe(0);
  });
  it("todas as 2^4 combinações de 1 acerto por nível somam o esperado", () => {
    const pts: Record<Level, number> = { 1: 3, 2: 4, 3: 6, 4: 7 };
    for (let mask = 0; mask < 16; mask++) {
      const levels = ([1, 2, 3, 4] as Level[]).filter((_, i) => mask & (1 << i));
      const items = levels.map((level) => ({ level, isCorrect: true }));
      expect(scoreTenths(items)).toBe(levels.reduce((s, l) => s + pts[l], 0));
    }
  });
});

describe("breakdownByLevel", () => {
  it("mostra os pontos de cada nível", () => {
    const b = breakdownByLevel(session([1, 2, 6, 11, 16, 17]));
    expect(b.map((x) => [x.label, x.correct, x.pointsTenths, x.maxTenths])).toEqual([
      ["Fácil", 2, 6, 15],
      ["Médio", 1, 4, 20],
      ["Difícil", 1, 6, 30],
      ["Avançado", 2, 14, 35],
    ]);
  });
});

describe("formatScore", () => {
  it.each([
    [0, "0,0"],
    [3, "0,3"],
    [35, "3,5"],
    [74, "7,4"],
    [100, "10,0"],
  ])("%i décimos → %s", (t, s) => {
    expect(formatScore(t)).toBe(s);
  });
  it("rejeita valores inválidos", () => {
    expect(() => formatScore(-1)).toThrow();
    expect(() => formatScore(7.5)).toThrow();
  });
});
