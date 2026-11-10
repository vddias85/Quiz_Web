// Pontuação (PRD §6). Tudo em décimos inteiros; a divisão por 10 acontece só na exibição
// (formatScore), para evitar erros de arredondamento.
// - Temas Variados e Por Categoria: 20 perguntas, peso por nível (0,3 / 0,4 / 0,6 / 0,7).
// - Por Nível (PRD v1.8): 10 perguntas de um único nível, 1,0 por acerto.

export type Level = 1 | 2 | 3 | 4;

export const LEVELS: readonly Level[] = [1, 2, 3, 4];
export const QUESTIONS_PER_LEVEL = 5;
export const QUESTIONS_PER_SESSION = LEVELS.length * QUESTIONS_PER_LEVEL; // 20

/** Pontos por acerto, em décimos: 0,3 / 0,4 / 0,6 / 0,7. */
export const POINTS_TENTHS: Record<Level, number> = { 1: 3, 2: 4, 3: 6, 4: 7 };

export const MAX_SCORE_TENTHS = LEVELS.reduce((sum, level) => sum + POINTS_TENTHS[level] * QUESTIONS_PER_LEVEL, 0); // 100

export const LEVEL_LABELS: Record<Level, string> = {
  1: "Fácil",
  2: "Médio",
  3: "Difícil",
  4: "Avançado",
};

export function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Posição 1–5 → fácil, 6–10 → médio, 11–15 → difícil, 16–20 → avançado. */
export function levelForPosition(position: number): Level {
  if (!Number.isInteger(position) || position < 1 || position > QUESTIONS_PER_SESSION) {
    throw new RangeError(`posição inválida: ${position}`);
  }
  return Math.ceil(position / QUESTIONS_PER_LEVEL) as Level;
}

// --- Formato da sessão conforme o modo --------------------------------------------------

export type GameMode = "MIXED" | "CATEGORY" | "LEVEL";

/** Modo Por Nível: quantidade de perguntas e pontos por acerto (1,0 = 10 décimos). */
export const LEVEL_MODE_QUESTIONS = 10;
export const LEVEL_MODE_POINTS_TENTHS = 10;

export interface SessionShape {
  mode: GameMode;
  level?: number | null; // obrigatório no modo LEVEL
}

function levelOfShape(shape: SessionShape): Level {
  if (!isLevel(shape.level)) throw new RangeError(`modo LEVEL sem nível válido: ${shape.level}`);
  return shape.level;
}

/** Quantidade de perguntas da sessão: 20, ou 10 no modo Por Nível. */
export function questionsInSession(shape: SessionShape): number {
  return shape.mode === "LEVEL" ? LEVEL_MODE_QUESTIONS : QUESTIONS_PER_SESSION;
}

/** Nível da pergunta na posição: pela posição (modos de 20) ou o nível fixo da sessão. */
export function levelOfItem(shape: SessionShape, position: number): Level {
  if (shape.mode !== "LEVEL") return levelForPosition(position);
  if (!Number.isInteger(position) || position < 1 || position > LEVEL_MODE_QUESTIONS) {
    throw new RangeError(`posição inválida: ${position}`);
  }
  return levelOfShape(shape);
}

/** Pontos, em décimos, de um acerto do nível informado nesta sessão. */
export function pointsPerCorrect(shape: SessionShape, level: Level): number {
  return shape.mode === "LEVEL" ? LEVEL_MODE_POINTS_TENTHS : POINTS_TENTHS[level];
}

const DEFAULT_SHAPE: SessionShape = { mode: "MIXED" };

export interface ScoredItem {
  level: Level;
  isCorrect: boolean | null; // null = não respondida (conta como erro)
}

export function scoreTenths(items: readonly ScoredItem[], shape: SessionShape = DEFAULT_SHAPE): number {
  return items.reduce((sum, item) => sum + (item.isCorrect ? pointsPerCorrect(shape, item.level) : 0), 0);
}

export interface LevelBreakdown {
  level: Level;
  label: string;
  correct: number;
  total: number;
  pointsTenths: number;
  maxTenths: number;
}

/** Acertos e pontos por nível. No modo Por Nível, só aparece o nível da sessão. */
export function breakdownByLevel(items: readonly ScoredItem[], shape: SessionShape = DEFAULT_SHAPE): LevelBreakdown[] {
  const levels = shape.mode === "LEVEL" ? [levelOfShape(shape)] : LEVELS;
  return levels.map((level) => {
    const ofLevel = items.filter((i) => i.level === level);
    const correct = ofLevel.filter((i) => i.isCorrect).length;
    const points = pointsPerCorrect(shape, level);
    return {
      level,
      label: LEVEL_LABELS[level],
      correct,
      total: ofLevel.length,
      pointsTenths: correct * points,
      maxTenths: ofLevel.length * points,
    };
  });
}

/** 74 → "7,4"; 100 → "10,0"; 0 → "0,0". */
export function formatScore(tenths: number): string {
  if (!Number.isInteger(tenths) || tenths < 0) throw new RangeError(`nota inválida: ${tenths}`);
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}
