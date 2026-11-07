// Sorteio das 20 perguntas de uma sessão (PRD §3 e §5).
// - 5 perguntas por nível, na ordem fácil → avançado, embaralhadas dentro do bloco.
// - MIXED: cada bloco usa 5 categorias diferentes, e o 1º tema de um bloco nunca repete
//   o último do bloco anterior → nunca há 2 perguntas seguidas do mesmo tema.
// - Evita perguntas vistas recentemente enquanto houver estoque.
// - Embaralha as alternativas.

import { LEVELS, QUESTIONS_PER_LEVEL, type Level } from "./scoring";
import { defaultRng, shuffle, type Rng } from "./random";

export interface PoolQuestion {
  id: string;
  categoryId: number;
  level: Level;
  optionIds: string[];
}

export interface DrawnItem {
  position: number; // 1–20
  questionId: string;
  categoryId: number;
  level: Level;
  optionOrder: string[];
}

export type DrawInput =
  | { mode: "MIXED"; pool: readonly PoolQuestion[]; recentIds?: ReadonlySet<string>; rng?: Rng }
  | {
      mode: "CATEGORY";
      categoryId: number;
      pool: readonly PoolQuestion[];
      recentIds?: ReadonlySet<string>;
      rng?: Rng;
    };

export class InsufficientQuestionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientQuestionsError";
  }
}

/** Embaralha e coloca as perguntas inéditas antes das já vistas. */
function freshFirst(
  questions: readonly PoolQuestion[],
  recent: ReadonlySet<string>,
  rng: Rng,
): PoolQuestion[] {
  const shuffled = shuffle(questions, rng);
  return [...shuffled.filter((q) => !recent.has(q.id)), ...shuffled.filter((q) => recent.has(q.id))];
}

function drawCategoryBlock(
  questions: readonly PoolQuestion[],
  recent: ReadonlySet<string>,
  rng: Rng,
  level: Level,
): PoolQuestion[] {
  const picked = freshFirst(questions, recent, rng).slice(0, QUESTIONS_PER_LEVEL);
  if (picked.length < QUESTIONS_PER_LEVEL) {
    throw new InsufficientQuestionsError(`nível ${level}: só ${picked.length} perguntas disponíveis`);
  }
  return shuffle(picked, rng);
}

function drawMixedBlock(
  questions: readonly PoolQuestion[],
  recent: ReadonlySet<string>,
  rng: Rng,
  level: Level,
  previousCategoryId: number | null,
): PoolQuestion[] {
  const byCategory = new Map<number, PoolQuestion[]>();
  for (const q of questions) {
    const list = byCategory.get(q.categoryId) ?? [];
    list.push(q);
    byCategory.set(q.categoryId, list);
  }
  if (byCategory.size < QUESTIONS_PER_LEVEL) {
    throw new InsufficientQuestionsError(
      `nível ${level}: só ${byCategory.size} categorias com perguntas (mínimo ${QUESTIONS_PER_LEVEL})`,
    );
  }

  // Categorias com perguntas inéditas têm prioridade; entre elas, a ordem é aleatória.
  const hasFresh = (id: number) => byCategory.get(id)!.some((q) => !recent.has(q.id));
  const categoryIds = shuffle([...byCategory.keys()], rng);
  const chosen = [...categoryIds.filter(hasFresh), ...categoryIds.filter((id) => !hasFresh(id))].slice(
    0,
    QUESTIONS_PER_LEVEL,
  );

  // Ordem aleatória dentro do bloco, sem começar pelo tema que fechou o bloco anterior.
  const order = shuffle(chosen, rng);
  if (previousCategoryId !== null && order[0] === previousCategoryId) {
    const swapWith = 1 + Math.floor(rng() * (order.length - 1));
    [order[0], order[swapWith]] = [order[swapWith], order[0]];
  }

  return order.map((categoryId) => freshFirst(byCategory.get(categoryId)!, recent, rng)[0]);
}

export function drawSession(input: DrawInput): DrawnItem[] {
  const rng = input.rng ?? defaultRng;
  const recent = input.recentIds ?? new Set<string>();
  const pool =
    input.mode === "CATEGORY" ? input.pool.filter((q) => q.categoryId === input.categoryId) : input.pool;

  const items: DrawnItem[] = [];
  let previousCategoryId: number | null = null;

  for (const level of LEVELS) {
    const ofLevel = pool.filter((q) => q.level === level);
    const block: PoolQuestion[] =
      input.mode === "CATEGORY"
        ? drawCategoryBlock(ofLevel, recent, rng, level)
        : drawMixedBlock(ofLevel, recent, rng, level, previousCategoryId);

    for (const q of block) {
      if (q.optionIds.length !== 4) {
        throw new Error(`pergunta ${q.id} não tem 4 alternativas`);
      }
      items.push({
        position: items.length + 1,
        questionId: q.id,
        categoryId: q.categoryId,
        level,
        optionOrder: shuffle(q.optionIds, rng),
      });
    }
    previousCategoryId = block[block.length - 1].categoryId;
  }
  return items;
}
