// Pontuação ponderada por nível (PRD §6.1). Tudo em décimos inteiros; a divisão por 10
// acontece só na exibição (formatScore), para evitar erros de arredondamento.

export type Level = 1 | 2 | 3 | 4;

export const LEVELS: readonly Level[] = [1, 2, 3, 4];
export const QUESTIONS_PER_LEVEL = 5;
export const QUESTIONS_PER_SESSION = LEVELS.length * QUESTIONS_PER_LEVEL; // 20

/** Pontos por acerto, em décimos: 0,3 / 0,4 / 0,6 / 0,7. */
export const POINTS_TENTHS: Record<Level, number> = { 1: 3, 2: 4, 3: 6, 4: 7 };

export const MAX_SCORE_TENTHS = LEVELS.reduce(
  (sum, level) => sum + POINTS_TENTHS[level] * QUESTIONS_PER_LEVEL,
  0,
); // 100

export const LEVEL_LABELS: Record<Level, string> = {
  1: "Fácil",
  2: "Médio",
  3: "Difícil",
  4: "Avançado",
};

/** Posição 1–5 → fácil, 6–10 → médio, 11–15 → difícil, 16–20 → avançado. */
export function levelForPosition(position: number): Level {
  if (!Number.isInteger(position) || position < 1 || position > QUESTIONS_PER_SESSION) {
    throw new RangeError(`posição inválida: ${position}`);
  }
  return (Math.ceil(position / QUESTIONS_PER_LEVEL) as Level);
}

export interface ScoredItem {
  level: Level;
  isCorrect: boolean | null; // null = não respondida (conta como erro)
}

export function scoreTenths(items: readonly ScoredItem[]): number {
  return items.reduce((sum, item) => sum + (item.isCorrect ? POINTS_TENTHS[item.level] : 0), 0);
}

export interface LevelBreakdown {
  level: Level;
  label: string;
  correct: number;
  total: number;
  pointsTenths: number;
  maxTenths: number;
}

export function breakdownByLevel(items: readonly ScoredItem[]): LevelBreakdown[] {
  return LEVELS.map((level) => {
    const ofLevel = items.filter((i) => i.level === level);
    const correct = ofLevel.filter((i) => i.isCorrect).length;
    return {
      level,
      label: LEVEL_LABELS[level],
      correct,
      total: ofLevel.length,
      pointsTenths: correct * POINTS_TENTHS[level],
      maxTenths: ofLevel.length * POINTS_TENTHS[level],
    };
  });
}

/** 74 → "7,4"; 100 → "10,0"; 0 → "0,0". */
export function formatScore(tenths: number): string {
  if (!Number.isInteger(tenths) || tenths < 0) throw new RangeError(`nota inválida: ${tenths}`);
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}
