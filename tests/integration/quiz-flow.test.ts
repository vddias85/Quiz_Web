// Fluxo do quiz contra o banco dev, com relógio controlado (`now`).
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/server/errors";
import {
  createSession,
  getCurrentQuestion,
  getSessionResult,
  listPlayableCategories,
  listSavedGames,
  reportQuestion,
  resolvePlayer,
  resumeSession,
  saveSession,
  submitAnswer,
  type CurrentQuestionDto,
} from "@/server/quiz";

const createdPlayers: string[] = [];
const rateLimitKeys: string[] = [];

const nick = () => `t_${randomBytes(6).toString("hex")}`;
const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

async function newPlayer() {
  const { player, ownedIds } = await resolvePlayer(nick(), []);
  createdPlayers.push(player.id);
  return { player, ownedIds };
}

async function correctOptionFor(sessionId: string, position: number): Promise<string> {
  const item = await prisma.sessionItem.findUniqueOrThrow({
    where: { sessionId_position: { sessionId, position } },
    select: { question: { select: { options: { where: { isCorrect: true }, select: { id: true } } } } },
  });
  return item.question.options[0].id;
}

function inProgress(q: CurrentQuestionDto) {
  if (q.status !== "in_progress") throw new Error(`esperava pergunta, veio ${q.status}`);
  return q;
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.status === status && e.code === code);
}

afterAll(async () => {
  await prisma.questionReport.deleteMany({ where: { playerId: { in: createdPlayers } } });
  await prisma.session.deleteMany({ where: { playerId: { in: createdPlayers } } });
  await prisma.player.deleteMany({ where: { id: { in: createdPlayers } } });
  await prisma.rateLimit.deleteMany({ where: { key: { in: rateLimitKeys } } });
  await prisma.$disconnect();
});

describe("categorias", () => {
  it("lista as 10 categorias jogáveis", async () => {
    const categories = await listPlayableCategories();
    expect(categories).toHaveLength(10);
    expect(categories[0]).toMatchObject({ slug: "geografia", name: "Geografia" });
  });
});

describe("sessão completa", () => {
  it("Temas Variados: 20 perguntas, sem vazar a resposta, nota calculada no servidor", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const base = new Date();
    const categories: string[] = [];

    for (let position = 1; position <= 20; position++) {
      const shownAt = at(base, position * 60_000 * 0.4); // dentro dos 15 min da sessão
      const q = inProgress(await getCurrentQuestion(sessionId, ownedIds, shownAt));
      expect(q.position).toBe(position);
      expect(q.level).toBe(Math.ceil(position / 5));
      expect(q.options).toHaveLength(4);
      expect(q.remainingMs).toBe(30_000);
      // Segurança: nada que indique a correta.
      const raw = JSON.stringify(q);
      expect(raw).not.toMatch(/isCorrect|correctOptionId|correct"/);
      categories.push(q.category.name);

      // Acerta as fáceis (1–5) e as avançadas (16–20); erra o resto.
      const correctId = await correctOptionFor(sessionId, position);
      const optionId =
        position <= 5 || position >= 16 ? correctId : q.options.find((o) => o.id !== correctId)!.id;
      const r = await submitAnswer(sessionId, ownedIds, { position, optionId }, at(shownAt, 5_000));
      expect(r.correct).toBe(position <= 5 || position >= 16);
      expect(r.correctOptionId).toBe(correctId);
      expect(r.finished).toBe(position === 20);
    }

    for (let i = 1; i < categories.length; i++) expect(categories[i]).not.toBe(categories[i - 1]);
    expect(await getCurrentQuestion(sessionId, ownedIds)).toEqual({ status: "finished" });

    const result = await getSessionResult(sessionId, ownedIds);
    expect(result.scoreTenths).toBe(50); // 1,5 + 3,5
    expect(result.score).toBe("5,0");
    expect(result.correctCount).toBe(10);
    expect(result.totalTimeMs).toBe(20 * 5_000);
    expect(result.levels.map((l) => l.pointsTenths)).toEqual([15, 0, 0, 35]);
    expect(result.review).toHaveLength(20);
  });

  it("Por Categoria: todas as perguntas são da categoria escolhida", async () => {
    const { player, ownedIds } = await newPlayer();
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: "brasil" } });
    const { sessionId } = await createSession({ playerId: player.id, mode: "CATEGORY", categoryId: category.id });
    const items = await prisma.sessionItem.findMany({
      where: { sessionId },
      select: { question: { select: { categoryId: true, level: true } }, position: true },
      orderBy: { position: "asc" },
    });
    expect(items).toHaveLength(20);
    expect(items.every((i) => i.question.categoryId === category.id)).toBe(true);
    expect(items.map((i) => i.question.level)).toEqual(items.map((i) => Math.ceil(i.position / 5)));
    const q = inProgress(await getCurrentQuestion(sessionId, ownedIds));
    expect(q.category.name).toBe("Brasil");
  });
});

describe("tempo e respostas", () => {
  it("resposta depois de 33 s conta como tempo esgotado, mesmo sendo a correta", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const t = new Date();
    inProgress(await getCurrentQuestion(sessionId, ownedIds, t));
    const correctId = await correctOptionFor(sessionId, 1);
    const r = await submitAnswer(sessionId, ownedIds, { position: 1, optionId: correctId }, at(t, 33_000));
    expect(r).toMatchObject({ correct: false, timedOut: true, chosenOptionId: null });
    const item = await prisma.sessionItem.findUniqueOrThrow({
      where: { sessionId_position: { sessionId, position: 1 } },
    });
    expect(item.timeMs).toBe(30_000);
  });

  it("aceita a resposta dentro da tolerância (31,9 s), com tempo limitado a 30 s", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const t = new Date();
    inProgress(await getCurrentQuestion(sessionId, ownedIds, t));
    const correctId = await correctOptionFor(sessionId, 1);
    const r = await submitAnswer(sessionId, ownedIds, { position: 1, optionId: correctId }, at(t, 31_900));
    expect(r).toMatchObject({ correct: true, timedOut: false });
  });

  it("não aceita resposta duplicada", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const t = new Date();
    const q = inProgress(await getCurrentQuestion(sessionId, ownedIds, t));
    await submitAnswer(sessionId, ownedIds, { position: 1, optionId: q.options[0].id }, at(t, 1_000));
    await expectApiError(
      submitAnswer(sessionId, ownedIds, { position: 1, optionId: q.options[1].id }, at(t, 2_000)),
      409,
      "already_answered",
    );
  });

  it("respostas simultâneas: só uma é gravada", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const t = new Date();
    const q = inProgress(await getCurrentQuestion(sessionId, ownedIds, t));
    const results = await Promise.allSettled(
      q.options.map((o) => submitAnswer(sessionId, ownedIds, { position: 1, optionId: o.id }, at(t, 1_000))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("não aceita resposta de pergunta ainda não exibida nem alternativa de outra pergunta", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    inProgress(await getCurrentQuestion(sessionId, ownedIds));
    const otherOption = await correctOptionFor(sessionId, 2);
    await expectApiError(submitAnswer(sessionId, ownedIds, { position: 2, optionId: otherOption }), 409, "not_shown");
    await expectApiError(submitAnswer(sessionId, ownedIds, { position: 1, optionId: otherOption }), 400, "invalid_option");
  });

  it("recarregar a página não reinicia o cronômetro", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const t = new Date();
    const first = inProgress(await getCurrentQuestion(sessionId, ownedIds, t));
    const again = inProgress(await getCurrentQuestion(sessionId, ownedIds, at(t, 10_000)));
    expect(again.position).toBe(first.position);
    expect(again.statement).toBe(first.statement);
    expect(again.options).toEqual(first.options); // mesma ordem embaralhada
    expect(again.remainingMs).toBe(20_000);
  });

  it("pergunta abandonada vira erro por tempo e o quiz avança", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const t = new Date();
    inProgress(await getCurrentQuestion(sessionId, ownedIds, t));
    const next = inProgress(await getCurrentQuestion(sessionId, ownedIds, at(t, 40_000)));
    expect(next.position).toBe(2);
    const item1 = await prisma.sessionItem.findUniqueOrThrow({ where: { sessionId_position: { sessionId, position: 1 } } });
    expect(item1).toMatchObject({ timedOut: true, isCorrect: false, timeMs: 30_000 });
  });

  it("sessão expira depois de 15 minutos", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    const later = at(new Date(), 16 * 60_000);
    expect(await getCurrentQuestion(sessionId, ownedIds, later)).toEqual({ status: "expired" });
    await expectApiError(submitAnswer(sessionId, ownedIds, { position: 1, optionId: null }, later), 410, "session_expired");
    await expectApiError(getSessionResult(sessionId, ownedIds), 409, "not_finished");
  });

  it("nova sessão encerra a anterior em andamento", async () => {
    const { player } = await newPlayer();
    const first = await createSession({ playerId: player.id, mode: "MIXED" });
    await createSession({ playerId: player.id, mode: "MIXED" });
    const s = await prisma.session.findUniqueOrThrow({ where: { id: first.sessionId } });
    expect(s.status).toBe("EXPIRED");
  });

  it("evita repetir perguntas das últimas sessões quando há estoque", async () => {
    const { player } = await newPlayer();
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: "geografia" } });
    // Geografia tem 20 perguntas: a 1ª sessão usa todas; com 5 por nível, a 2ª repete por falta de estoque.
    // Já no modo variado (200 perguntas), a 2ª sessão não repete nenhuma da 1ª.
    const a = await createSession({ playerId: player.id, mode: "MIXED" });
    const b = await createSession({ playerId: player.id, mode: "MIXED" });
    const ids = async (id: string) =>
      new Set((await prisma.sessionItem.findMany({ where: { sessionId: id } })).map((i) => i.questionId));
    const [setA, setB] = [await ids(a.sessionId), await ids(b.sessionId)];
    expect([...setB].filter((id) => setA.has(id))).toHaveLength(0);
    const c = await createSession({ playerId: player.id, mode: "CATEGORY", categoryId: category.id });
    expect((await ids(c.sessionId)).size).toBe(20);
  });
});

describe("apelido e posse da sessão", () => {
  it("apelido é único sem diferenciar maiúsculas e acentos", async () => {
    const name = `Jo${randomBytes(4).toString("hex")}`;
    const first = await resolvePlayer(name, []);
    createdPlayers.push(first.player.id);
    // Outro navegador (sem o cookie) não pode usar.
    await expectApiError(resolvePlayer(name.toUpperCase(), []), 409, "nickname_taken");
    // O mesmo navegador continua usando.
    const again = await resolvePlayer(name.toLowerCase(), first.ownedIds);
    expect(again.player.id).toBe(first.player.id);
  });

  it("rejeita apelido com palavrão", async () => {
    await expectApiError(resolvePlayer("merda_123", []), 400, "invalid_nickname");
  });

  it("sessão de outro jogador responde como inexistente", async () => {
    const owner = await newPlayer();
    const intruder = await newPlayer();
    const { sessionId } = await createSession({ playerId: owner.player.id, mode: "MIXED" });
    await expectApiError(getCurrentQuestion(sessionId, intruder.ownedIds), 404, "not_found");
    await expectApiError(getCurrentQuestion(sessionId, []), 404, "not_found");
    await expectApiError(submitAnswer(sessionId, intruder.ownedIds, { position: 1, optionId: null }), 404, "not_found");
  });
});

describe("reportar pergunta e limite de requisições", () => {
  it("grava o aviso de uma pergunta já exibida", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED" });
    inProgress(await getCurrentQuestion(sessionId, ownedIds));
    await reportQuestion({ sessionId, position: 1, ownedIds, reason: "TYPO", text: "  vírgula sobrando  " });
    const report = await prisma.questionReport.findFirstOrThrow({ where: { sessionId } });
    expect(report).toMatchObject({ reason: "TYPO", text: "vírgula sobrando", playerId: player.id });
    await expectApiError(reportQuestion({ sessionId, position: 2, ownedIds, reason: "OTHER" }), 404, "not_found");
  });

  it("bloqueia depois do limite na mesma janela", async () => {
    const key = `test:${randomBytes(6).toString("hex")}`;
    rateLimitKeys.push(key);
    const rule = { limit: 2, windowMs: 60_000 };
    const now = new Date();
    expect(await consumeRateLimit(key, rule, now)).toBe(true);
    expect(await consumeRateLimit(key, rule, now)).toBe(true);
    expect(await consumeRateLimit(key, rule, now)).toBe(false);
  });
});

describe("salvar e continuar depois", () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  /** Cria a partida em `base` e responde a 1ª pergunta. */
  async function startAndAnswerFirst(base: Date) {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED", now: base });
    const q = inProgress(await getCurrentQuestion(sessionId, ownedIds, at(base, 1_000)));
    await submitAnswer(sessionId, ownedIds, { position: 1, optionId: q.options[0].id }, at(base, 5_000));
    return { player, ownedIds, sessionId };
  }

  it("só salva entre perguntas, nunca com uma pergunta aberta na tela", async () => {
    const base = new Date();
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "MIXED", now: base });
    const q = inProgress(await getCurrentQuestion(sessionId, ownedIds, at(base, 1_000)));
    await expectApiError(saveSession(sessionId, ownedIds, at(base, 2_000)), 409, "question_open");

    await submitAnswer(sessionId, ownedIds, { position: 1, optionId: q.options[0].id }, at(base, 3_000));
    await saveSession(sessionId, ownedIds, at(base, 4_000));
    const s = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(s).toMatchObject({ status: "SAVED", activeMsBefore: 4_000 });

    // Salvo: não entrega pergunta nem aceita resposta.
    expect(await getCurrentQuestion(sessionId, ownedIds, at(base, 5_000))).toEqual({ status: "saved" });
    await expectApiError(
      submitAnswer(sessionId, ownedIds, { position: 2, optionId: null }, at(base, 5_000)),
      409,
      "session_saved",
    );
    const saved = await listSavedGames(ownedIds, at(base, 6_000));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ sessionId, answered: 1, nickname: player.nickname });
  });

  it("ao retomar, a próxima pergunta é inédita, com 30 s, e o período salvo não conta nos 15 min", async () => {
    const base = new Date();
    const { ownedIds, sessionId } = await startAndAnswerFirst(base);
    await saveSession(sessionId, ownedIds, at(base, 10 * MIN)); // 10 min de jogo ativo

    const back = at(base, 5 * HOUR);
    await resumeSession(sessionId, ownedIds, back);
    const item2Before = await prisma.sessionItem.findUniqueOrThrow({ where: { sessionId_position: { sessionId, position: 2 } } });
    expect(item2Before.shownAt).toBeNull(); // a pergunta 2 nunca foi vista antes de salvar

    const q2 = inProgress(await getCurrentQuestion(sessionId, ownedIds, back));
    expect(q2.position).toBe(2);
    expect(q2.remainingMs).toBe(30_000);
    const r = await submitAnswer(sessionId, ownedIds, { position: 2, optionId: q2.options[0].id }, at(back, 5_000));
    expect(r.timedOut).toBe(false);

    // 10 min antes + 4 min agora = 14 min: continua valendo.
    expect((await getCurrentQuestion(sessionId, ownedIds, at(back, 4 * MIN))).status).toBe("in_progress");
    // 10 + 6 = 16 min de jogo ativo: expira.
    expect(await getCurrentQuestion(sessionId, ownedIds, at(back, 6 * MIN))).toEqual({ status: "expired" });
  });

  it("jogo salvo expira depois de 24 horas", async () => {
    const base = new Date();
    const { ownedIds, sessionId } = await startAndAnswerFirst(base);
    await saveSession(sessionId, ownedIds, at(base, 10_000));
    const late = at(base, 25 * HOUR);
    expect(await listSavedGames(ownedIds, late)).toHaveLength(0);
    await expectApiError(resumeSession(sessionId, ownedIds, late), 410, "session_expired");
  });

  it("começar outro jogo exige descartar o salvo", async () => {
    const base = new Date();
    const { player, ownedIds, sessionId } = await startAndAnswerFirst(base);
    await saveSession(sessionId, ownedIds, at(base, 10_000));
    await expectApiError(createSession({ playerId: player.id, mode: "MIXED", now: at(base, 20_000) }), 409, "has_saved_game");
    await createSession({ playerId: player.id, mode: "MIXED", discardSaved: true, now: at(base, 30_000) });
    const old = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(old.status).toBe("EXPIRED");
  });

  it("outro navegador não retoma nem salva a partida", async () => {
    const base = new Date();
    const { ownedIds, sessionId } = await startAndAnswerFirst(base);
    const intruder = await newPlayer();
    await expectApiError(saveSession(sessionId, intruder.ownedIds, at(base, 10_000)), 404, "not_found");
    await saveSession(sessionId, ownedIds, at(base, 10_000));
    await expectApiError(resumeSession(sessionId, intruder.ownedIds, at(base, 20_000)), 404, "not_found");
  });
});
