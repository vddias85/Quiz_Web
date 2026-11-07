// Regras do quiz no servidor. Toda correção, tempo e nota são decididos aqui (PRD §8.2).
// As funções recebem `now` para que os testes controlem o relógio.
import { Prisma, type Mode, type Player } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withPlayer } from "@/lib/auth";
import { drawSession, InsufficientQuestionsError } from "@/lib/draw";
import { validateNickname } from "@/lib/nickname";
import type { Rng } from "@/lib/random";
import {
  breakdownByLevel,
  formatScore,
  LEVEL_LABELS,
  LEVELS,
  levelForPosition,
  QUESTIONS_PER_LEVEL,
  QUESTIONS_PER_SESSION,
  scoreTenths,
  type Level,
} from "@/lib/scoring";
import {
  activeMs,
  answerTimeMs,
  isSavedGameExpired,
  isSessionExpired,
  isTimedOut,
  QUESTION_TIME_MS,
  remainingMs,
  SAVED_GAME_TTL_MS,
} from "@/lib/timing";
import { ApiError, notFound } from "./errors";

const RECENT_SESSIONS = 3;

// ---------------------------------------------------------------------------
// Jogador
// ---------------------------------------------------------------------------

/**
 * Encontra ou cria o jogador do apelido. Um apelido existente só pode ser usado pelo
 * navegador que o criou (ids no cookie assinado).
 */
export async function resolvePlayer(
  nicknameInput: unknown,
  ownedIds: readonly string[],
): Promise<{ player: Player; ownedIds: string[] }> {
  const v = validateNickname(nicknameInput);
  if (!v.ok) throw new ApiError(400, "invalid_nickname", v.error);

  const taken = () => new ApiError(409, "nickname_taken", "Esse apelido já está em uso. Escolha outro.");

  const existing = await prisma.player.findUnique({ where: { nicknameKey: v.key } });
  if (existing) {
    if (!ownedIds.includes(existing.id)) throw taken();
    return { player: existing, ownedIds: withPlayer(ownedIds, existing.id) };
  }
  try {
    const player = await prisma.player.create({ data: { nickname: v.nickname, nicknameKey: v.key } });
    return { player, ownedIds: withPlayer(ownedIds, player.id) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw taken();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export interface CategoryDto {
  id: number;
  slug: string;
  name: string;
  icon: string;
}

/** Só as categorias com pelo menos 5 perguntas ativas em cada nível. */
export async function listPlayableCategories(): Promise<CategoryDto[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.question.groupBy({ by: ["categoryId", "level"], where: { active: true }, _count: { _all: true } }),
  ]);
  const count = (categoryId: number, level: number) =>
    counts.find((c) => c.categoryId === categoryId && c.level === level)?._count._all ?? 0;

  return categories
    .filter((c) => LEVELS.every((level) => count(c.id, level) >= QUESTIONS_PER_LEVEL))
    .map(({ id, slug, name, icon }) => ({ id, slug, name, icon }));
}

// ---------------------------------------------------------------------------
// Criação da sessão
// ---------------------------------------------------------------------------

export async function createSession(params: {
  playerId: string;
  mode: Mode;
  categoryId?: number;
  discardSaved?: boolean; // descarta o jogo salvo do jogador, se houver
  rng?: Rng;
  now?: Date;
}): Promise<{ sessionId: string }> {
  const { playerId, mode, rng } = params;
  const now = params.now ?? new Date();
  const categoryId = mode === "CATEGORY" ? params.categoryId : undefined;

  // Um jogo salvo por apelido: começar outro exige descartá-lo de forma explícita.
  if (!params.discardSaved) {
    const saved = await prisma.session.findFirst({
      where: { playerId, status: "SAVED", savedAt: { gte: new Date(now.getTime() - SAVED_GAME_TTL_MS) } },
      select: { id: true },
    });
    if (saved) {
      throw new ApiError(409, "has_saved_game", "Você tem um jogo salvo com este apelido.");
    }
  }

  if (mode === "CATEGORY") {
    if (!categoryId) throw new ApiError(400, "invalid_category", "Escolha uma categoria.");
    const exists = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) throw new ApiError(400, "invalid_category", "Categoria não encontrada.");
  }

  const [recentSessions, questions] = await Promise.all([
    prisma.session.findMany({
      where: { playerId },
      orderBy: { startedAt: "desc" },
      take: RECENT_SESSIONS,
      select: { items: { select: { questionId: true } } },
    }),
    prisma.question.findMany({
      where: { active: true, ...(categoryId ? { categoryId } : {}) },
      select: { id: true, categoryId: true, level: true, options: { select: { id: true }, orderBy: { position: "asc" } } },
    }),
  ]);

  const recentIds = new Set(recentSessions.flatMap((s) => s.items.map((i) => i.questionId)));
  const pool = questions.map((q) => ({
    id: q.id,
    categoryId: q.categoryId,
    level: q.level as Level,
    optionIds: q.options.map((o) => o.id),
  }));

  let drawn;
  try {
    drawn =
      mode === "CATEGORY"
        ? drawSession({ mode, categoryId: categoryId!, pool, recentIds, rng })
        : drawSession({ mode, pool, recentIds, rng });
  } catch (err) {
    if (err instanceof InsufficientQuestionsError) {
      throw new ApiError(409, "insufficient_questions", "Ainda não há perguntas suficientes para este modo.");
    }
    throw err;
  }

  const session = await prisma.$transaction(async (tx) => {
    // Uma partida aberta por jogador: a anterior (em andamento ou salva) deixa de valer.
    await tx.session.updateMany({
      where: { playerId, status: { in: ["IN_PROGRESS", "SAVED"] } },
      data: { status: "EXPIRED" },
    });
    return tx.session.create({
      data: {
        playerId,
        mode,
        categoryId: categoryId ?? null,
        startedAt: now,
        activeSince: now,
        items: {
          create: drawn.map((d) => ({ position: d.position, questionId: d.questionId, optionOrder: d.optionOrder })),
        },
      },
      select: { id: true },
    });
  });
  return { sessionId: session.id };
}

// ---------------------------------------------------------------------------
// Sessão em andamento
// ---------------------------------------------------------------------------

async function loadOwnedSession(sessionId: string, ownedIds: readonly string[]) {
  if (ownedIds.length === 0) throw notFound();
  const session = await prisma.session.findFirst({
    where: { id: sessionId, playerId: { in: [...ownedIds] } },
    select: { id: true, status: true, playerId: true, activeSince: true, activeMsBefore: true, savedAt: true },
  });
  if (!session) throw notFound(); // não revela se a sessão existe para outro jogador
  return session;
}

async function expireSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, status: { in: ["IN_PROGRESS", "SAVED"] } },
    data: { status: "EXPIRED" },
  });
}

type OwnedSession = Awaited<ReturnType<typeof loadOwnedSession>>;

/** Atualiza o status se o prazo venceu: 15 min de jogo ativo ou 24 h de jogo salvo. */
async function checkExpiry(session: OwnedSession, now: Date): Promise<OwnedSession["status"]> {
  const expired =
    (session.status === "IN_PROGRESS" && isSessionExpired(session, now)) ||
    (session.status === "SAVED" && (!session.savedAt || isSavedGameExpired(session.savedAt, now)));
  if (expired) {
    await expireSession(session.id);
    return "EXPIRED";
  }
  return session.status;
}

/** Fecha a sessão: calcula nota, acertos e tempo total. Idempotente. */
async function finalizeSession(sessionId: string, now: Date) {
  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    select: { position: true, isCorrect: true, timeMs: true },
  });
  const scored = items.map((i) => ({ level: levelForPosition(i.position), isCorrect: i.isCorrect }));
  await prisma.session.updateMany({
    where: { id: sessionId, status: "IN_PROGRESS" },
    data: {
      status: "FINISHED",
      finishedAt: now,
      scoreTenths: scoreTenths(scored),
      correctCount: items.filter((i) => i.isCorrect).length,
      totalTimeMs: items.reduce((sum, i) => sum + (i.timeMs ?? QUESTION_TIME_MS), 0),
    },
  });
}

export type CurrentQuestionDto =
  | {
      status: "in_progress";
      position: number;
      total: number;
      level: Level;
      levelLabel: string;
      category: { name: string; icon: string };
      statement: string;
      options: { id: string; text: string }[];
      remainingMs: number;
    }
  | { status: "finished" | "expired" | "saved" };

/**
 * Entrega a pergunta atual. O `shownAt` é gravado só na primeira entrega, então
 * recarregar a página não reinicia o tempo. A resposta NUNCA inclui qual é a correta.
 */
export async function getCurrentQuestion(
  sessionId: string,
  ownedIds: readonly string[],
  now = new Date(),
): Promise<CurrentQuestionDto> {
  const session = await loadOwnedSession(sessionId, ownedIds);
  const status = await checkExpiry(session, now);
  if (status === "FINISHED") return { status: "finished" };
  if (status === "EXPIRED") return { status: "expired" };
  if (status === "SAVED") return { status: "saved" }; // é preciso retomar antes

  for (let guard = 0; guard <= QUESTIONS_PER_SESSION; guard++) {
    const item = await prisma.sessionItem.findFirst({
      where: { sessionId, answeredAt: null },
      orderBy: { position: "asc" },
      select: {
        id: true,
        position: true,
        shownAt: true,
        optionOrder: true,
        question: {
          select: {
            statement: true,
            category: { select: { name: true, icon: true } },
            options: { select: { id: true, text: true } },
          },
        },
      },
    });
    if (!item) {
      await finalizeSession(sessionId, now);
      return { status: "finished" };
    }

    let shownAt = item.shownAt;
    if (!shownAt) {
      // Só exibe se a partida continua em andamento (não foi salva nesse meio-tempo).
      const marked = await prisma.sessionItem.updateMany({
        where: { id: item.id, shownAt: null, session: { status: "IN_PROGRESS" } },
        data: { shownAt: now },
      });
      if (marked.count === 1) {
        shownAt = now;
      } else {
        const fresh = await prisma.sessionItem.findUniqueOrThrow({ where: { id: item.id }, select: { shownAt: true } });
        if (!fresh.shownAt) return { status: "saved" };
        shownAt = fresh.shownAt;
      }
    }

    // Tempo esgotado sem resposta (ex.: o jogador fechou a aba): conta como erro e avança.
    if (isTimedOut(shownAt, now)) {
      await prisma.sessionItem.updateMany({
        where: { id: item.id, answeredAt: null },
        data: { timedOut: true, isCorrect: false, answeredAt: now, timeMs: QUESTION_TIME_MS },
      });
      continue;
    }

    const textById = new Map(item.question.options.map((o) => [o.id, o.text]));
    const level = levelForPosition(item.position);
    return {
      status: "in_progress",
      position: item.position,
      total: QUESTIONS_PER_SESSION,
      level,
      levelLabel: LEVEL_LABELS[level],
      category: item.question.category,
      statement: item.question.statement,
      options: item.optionOrder.map((id) => ({ id, text: textById.get(id) ?? "" })),
      remainingMs: remainingMs(shownAt, now),
    };
  }
  throw new Error("loop inesperado em getCurrentQuestion");
}

export interface AnswerResultDto {
  correct: boolean;
  timedOut: boolean;
  chosenOptionId: string | null;
  correctOptionId: string;
  explanation: string | null;
  finished: boolean;
}

/** Corrige a resposta. Só uma resposta por pergunta; o tempo é medido a partir do `shownAt`. */
export async function submitAnswer(
  sessionId: string,
  ownedIds: readonly string[],
  answer: { position: number; optionId: string | null },
  now = new Date(),
): Promise<AnswerResultDto> {
  const session = await loadOwnedSession(sessionId, ownedIds);
  const status = await checkExpiry(session, now);
  if (status === "FINISHED") {
    throw new ApiError(409, "session_finished", "Esta sessão já terminou.");
  }
  if (status === "EXPIRED") {
    throw new ApiError(410, "session_expired", "Esta sessão expirou. Comece uma nova partida.");
  }
  if (status === "SAVED") {
    throw new ApiError(409, "session_saved", "Este jogo está salvo. Continue a partida para responder.");
  }

  const item = await prisma.sessionItem.findUnique({
    where: { sessionId_position: { sessionId, position: answer.position } },
    select: {
      id: true,
      shownAt: true,
      answeredAt: true,
      optionOrder: true,
      question: { select: { explanation: true, options: { select: { id: true, isCorrect: true } } } },
    },
  });
  if (!item) throw new ApiError(404, "not_found", "Pergunta não encontrada.");
  if (!item.shownAt) throw new ApiError(409, "not_shown", "Esta pergunta ainda não foi exibida.");
  if (item.answeredAt) throw new ApiError(409, "already_answered", "Esta pergunta já foi respondida.");
  if (answer.optionId !== null && !item.optionOrder.includes(answer.optionId)) {
    throw new ApiError(400, "invalid_option", "Alternativa inválida.");
  }

  const late = isTimedOut(item.shownAt, now);
  const chosenOptionId = late ? null : answer.optionId;
  const timedOut = chosenOptionId === null;
  const correctOptionId = item.question.options.find((o) => o.isCorrect)!.id;
  const correct = !timedOut && chosenOptionId === correctOptionId;

  // Update condicional: garante uma única resposta mesmo com requisições simultâneas.
  const saved = await prisma.sessionItem.updateMany({
    where: { id: item.id, answeredAt: null },
    data: {
      chosenOptionId,
      isCorrect: correct,
      timedOut,
      answeredAt: now,
      timeMs: timedOut ? QUESTION_TIME_MS : answerTimeMs(item.shownAt, now),
    },
  });
  if (saved.count === 0) throw new ApiError(409, "already_answered", "Esta pergunta já foi respondida.");

  // As perguntas são entregues em ordem (só a 1ª não respondida recebe shownAt),
  // então responder a 20ª significa que todas foram respondidas.
  const finished = answer.position === QUESTIONS_PER_SESSION;
  if (finished) await finalizeSession(sessionId, now);

  return {
    correct,
    timedOut,
    chosenOptionId,
    correctOptionId,
    explanation: item.question.explanation,
    finished,
  };
}

// ---------------------------------------------------------------------------
// Salvar e continuar depois (PRD §2.2)
// ---------------------------------------------------------------------------

/**
 * Salva a partida. Só é permitido ENTRE perguntas: depois de responder e antes de a próxima
 * ser exibida. Assim nenhuma pergunta fica vista e sem resposta, e salvar não vira um "pular".
 */
export async function saveSession(sessionId: string, ownedIds: readonly string[], now = new Date()): Promise<void> {
  const session = await loadOwnedSession(sessionId, ownedIds);
  const status = await checkExpiry(session, now);
  if (status === "SAVED") return; // idempotente
  if (status === "FINISHED") throw new ApiError(409, "session_finished", "Esta sessão já terminou.");
  if (status === "EXPIRED") {
    throw new ApiError(410, "session_expired", "Esta sessão expirou. Comece uma nova partida.");
  }

  const saved = await prisma.session.updateMany({
    where: {
      id: sessionId,
      status: "IN_PROGRESS",
      // nenhuma pergunta exibida e ainda sem resposta
      items: { none: { answeredAt: null, shownAt: { not: null } } },
    },
    data: { status: "SAVED", savedAt: now, activeMsBefore: activeMs(session, now) },
  });
  if (saved.count === 0) {
    const open = await prisma.sessionItem.count({ where: { sessionId, answeredAt: null, shownAt: { not: null } } });
    if (open > 0) {
      throw new ApiError(409, "question_open", "Responda a pergunta atual antes de salvar.");
    }
    throw new ApiError(409, "conflict", "Não foi possível salvar agora. Tente de novo.");
  }
}

/** Retoma um jogo salvo. A próxima pergunta é inédita e o cronômetro começa do zero. */
export async function resumeSession(sessionId: string, ownedIds: readonly string[], now = new Date()): Promise<void> {
  const session = await loadOwnedSession(sessionId, ownedIds);
  const status = await checkExpiry(session, now);
  if (status === "IN_PROGRESS") return; // já retomado
  if (status === "FINISHED") throw new ApiError(409, "session_finished", "Esta sessão já terminou.");
  if (status === "EXPIRED") {
    throw new ApiError(410, "session_expired", "Este jogo salvo expirou (validade de 24 horas).");
  }

  await prisma.$transaction([
    // Uma partida aberta por jogador.
    prisma.session.updateMany({
      where: { playerId: session.playerId, status: "IN_PROGRESS", id: { not: sessionId } },
      data: { status: "EXPIRED" },
    }),
    prisma.session.updateMany({
      where: { id: sessionId, status: "SAVED" },
      data: { status: "IN_PROGRESS", activeSince: now, savedAt: null },
    }),
  ]);
}

export interface SavedGameDto {
  sessionId: string;
  nickname: string;
  mode: Mode;
  category: { name: string; icon: string } | null;
  answered: number;
  savedAt: string;
  expiresAt: string;
}

/** Jogos salvos dos apelidos deste navegador (no máximo um por apelido). */
export async function listSavedGames(ownedIds: readonly string[], now = new Date()): Promise<SavedGameDto[]> {
  if (ownedIds.length === 0) return [];
  const cutoff = new Date(now.getTime() - SAVED_GAME_TTL_MS);
  await prisma.session.updateMany({
    where: { playerId: { in: [...ownedIds] }, status: "SAVED", savedAt: { lt: cutoff } },
    data: { status: "EXPIRED" },
  });
  const sessions = await prisma.session.findMany({
    where: { playerId: { in: [...ownedIds] }, status: "SAVED" },
    orderBy: { savedAt: "desc" },
    select: {
      id: true,
      mode: true,
      savedAt: true,
      player: { select: { nickname: true } },
      category: { select: { name: true, icon: true } },
      _count: { select: { items: { where: { answeredAt: { not: null } } } } },
    },
  });
  return sessions.map((s) => ({
    sessionId: s.id,
    nickname: s.player.nickname,
    mode: s.mode,
    category: s.category,
    answered: s._count.items,
    savedAt: s.savedAt!.toISOString(),
    expiresAt: new Date(s.savedAt!.getTime() + SAVED_GAME_TTL_MS).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Resultado e revisão
// ---------------------------------------------------------------------------

export async function getSessionResult(sessionId: string, ownedIds: readonly string[]) {
  const owned = await loadOwnedSession(sessionId, ownedIds);
  if (owned.status !== "FINISHED") {
    throw new ApiError(409, "not_finished", "Esta sessão ainda não terminou.");
  }
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      id: true,
      mode: true,
      scoreTenths: true,
      correctCount: true,
      totalTimeMs: true,
      finishedAt: true,
      category: { select: { id: true, slug: true, name: true, icon: true } },
      player: { select: { nickname: true } },
      items: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          optionOrder: true,
          chosenOptionId: true,
          isCorrect: true,
          timedOut: true,
          timeMs: true,
          question: {
            select: {
              statement: true,
              explanation: true,
              category: { select: { name: true, icon: true } },
              options: { select: { id: true, text: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });

  const scored = session.items.map((i) => ({ level: levelForPosition(i.position), isCorrect: i.isCorrect }));
  return {
    sessionId: session.id,
    mode: session.mode,
    category: session.category,
    nickname: session.player.nickname,
    scoreTenths: session.scoreTenths ?? 0,
    score: formatScore(session.scoreTenths ?? 0),
    correctCount: session.correctCount ?? 0,
    totalTimeMs: session.totalTimeMs ?? 0,
    finishedAt: session.finishedAt,
    levels: breakdownByLevel(scored),
    review: session.items.map((i) => {
      const byId = new Map(i.question.options.map((o) => [o.id, o]));
      return {
        position: i.position,
        level: levelForPosition(i.position),
        category: i.question.category,
        statement: i.question.statement,
        explanation: i.question.explanation,
        options: i.optionOrder.map((id) => ({ id, text: byId.get(id)?.text ?? "", isCorrect: !!byId.get(id)?.isCorrect })),
        chosenOptionId: i.chosenOptionId,
        isCorrect: !!i.isCorrect,
        timedOut: i.timedOut,
        timeMs: i.timeMs,
      };
    }),
  };
}

export type SessionResultDto = Awaited<ReturnType<typeof getSessionResult>>;

// ---------------------------------------------------------------------------
// Reportar pergunta (S13)
// ---------------------------------------------------------------------------

export const REPORT_REASONS = ["WRONG_ANSWER", "AMBIGUOUS", "TYPO", "OUTDATED", "OTHER"] as const;
export type ReportReasonCode = (typeof REPORT_REASONS)[number];

export async function reportQuestion(params: {
  sessionId: string;
  position: number;
  ownedIds: readonly string[];
  reason: ReportReasonCode;
  text?: string;
}): Promise<void> {
  const session = await loadOwnedSession(params.sessionId, params.ownedIds);
  const item = await prisma.sessionItem.findUnique({
    where: { sessionId_position: { sessionId: session.id, position: params.position } },
    select: { questionId: true, shownAt: true },
  });
  // Só dá para reportar uma pergunta que o jogador já viu.
  if (!item?.shownAt) throw new ApiError(404, "not_found", "Pergunta não encontrada.");
  await prisma.questionReport.create({
    data: {
      questionId: item.questionId,
      playerId: session.playerId,
      sessionId: session.id,
      reason: params.reason,
      text: params.text?.trim() || null,
    },
  });
}
