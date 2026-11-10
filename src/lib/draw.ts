// Sorteio das perguntas de uma sessão (PRD §3 e §5).
// - MIXED e CATEGORY: 20 perguntas, 5 por nível, na ordem fácil → avançado, embaralhadas no bloco.
// - LEVEL (PRD v1.8): 10 perguntas de um único nível, de todas as categorias, sem 2 seguidas
//   do mesmo tema e preferindo uma categoria diferente para cada pergunta.
// - MIXED: cada bloco usa 5 categorias diferentes, e o 1º tema de um bloco nunca repete
//   o último do bloco anterior → nunca há 2 perguntas seguidas do mesmo tema.
// - Evita perguntas vistas recentemente enquanto houver estoque.
// - Embaralha as alternativas.

import { LEVEL_MODE_QUESTIONS, LEVELS, QUESTIONS_PER_LEVEL, type Level } from "./scoring";
import { defaultRng, shuffle, type Rng } from "./random";

export interface PoolQuestion {
  id: string;
  categoryId: number;
  level: Level;
  optionIds: string[];
}

export interface DrawnItem {
  position: number; // 1–20 (1–10 no modo LEVEL)
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
    }
  | { mode: "LEVEL"; level: Level; pool: readonly PoolQuestion[]; recentIds?: ReadonlySet<string>; rng?: Rng };

export class InsufficientQuestionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientQuestionsError";
  }
}

/** Embaralha e coloca as perguntas inéditas antes das já vistas. */
function freshFirst(questions: readonly PoolQuestion[], recent: ReadonlySet<string>, rng: Rng): PoolQuestion[] {
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

/**
 * Modo LEVEL: escolhe as perguntas uma a uma. A cada passo, entre as categorias que ainda têm
 * perguntas e que não são a da pergunta anterior, prefere as ainda não usadas na sessão e,
 * entre elas, as que têm perguntas inéditas. Com 10 categorias, cada pergunta é de um tema.
 */
function drawLevelSession(
  questions: readonly PoolQuestion[],
  level: Level,
  recent: ReadonlySet<string>,
  rng: Rng,
): PoolQuestion[] {
  const queues = new Map<number, PoolQuestion[]>();
  for (const q of questions) {
    const list = queues.get(q.categoryId) ?? [];
    list.push(q);
    queues.set(q.categoryId, list);
  }
  for (const [id, list] of queues) queues.set(id, freshFirst(list, recent, rng));
  if (questions.length < LEVEL_MODE_QUESTIONS || queues.size < 2) {
    throw new InsufficientQuestionsError(
      `nível ${level}: só ${questions.length} perguntas em ${queues.size} categorias (mínimo ${LEVEL_MODE_QUESTIONS} em 2)`,
    );
  }

  const used = new Set<number>();
  const picked: PoolQuestion[] = [];
  let previous: number | null = null;
  for (let i = 0; i < LEVEL_MODE_QUESTIONS; i++) {
    const candidates = shuffle(
      [...queues.keys()].filter((id) => id !== previous && queues.get(id)!.length > 0),
      rng,
    );
    if (candidates.length === 0) {
      throw new InsufficientQuestionsError(`nível ${level}: não há como evitar 2 perguntas seguidas do mesmo tema`);
    }
    const rank = (id: number) => (used.has(id) ? 2 : 0) + (recent.has(queues.get(id)![0].id) ? 1 : 0);
    const best = Math.min(...candidates.map(rank));
    const categoryId = candidates.find((id) => rank(id) === best)!;
    picked.push(queues.get(categoryId)!.shift()!);
    used.add(categoryId);
    previous = categoryId;
  }
  return picked;
}

function toItems(questions: readonly PoolQuestion[], rng: Rng, startAt: number): DrawnItem[] {
  return questions.map((q, i) => {
    if (q.optionIds.length !== 4) {
      throw new Error(`pergunta ${q.id} não tem 4 alternativas`);
    }
    return {
      position: startAt + i,
      questionId: q.id,
      categoryId: q.categoryId,
      level: q.level,
      optionOrder: shuffle(q.optionIds, rng),
    };
  });
}

export function drawSession(input: DrawInput): DrawnItem[] {
  const rng = input.rng ?? defaultRng;
  if (input.mode === "LEVEL") {
    const recentIds = input.recentIds ?? new Set<string>();
    const ofLevel = input.pool.filter((q) => q.level === input.level);
    return toItems(drawLevelSession(ofLevel, input.level, recentIds, rng), rng, 1);
  }
  const recent = input.recentIds ?? new Set<string>();
  const pool = input.mode === "CATEGORY" ? input.pool.filter((q) => q.categoryId === input.categoryId) : input.pool;

  const items: DrawnItem[] = [];
  let previousCategoryId: number | null = null;

  for (const level of LEVELS) {
    const ofLevel = pool.filter((q) => q.level === level);
    const block: PoolQuestion[] =
      input.mode === "CATEGORY"
        ? drawCategoryBlock(ofLevel, recent, rng, level)
        : drawMixedBlock(ofLevel, recent, rng, level, previousCategoryId);

    items.push(...toItems(block, rng, items.length + 1));
    previousCategoryId = block[block.length - 1].categoryId;
  }
  return items;
}
