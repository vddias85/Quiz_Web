// Modo Por Nível (PRD v1.8) contra o banco dev: partida completa, nota, ranking e regras do banco.
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ApiError } from "@/server/errors";
import {
  createSession,
  getCurrentQuestion,
  getSessionResult,
  listSavedGames,
  resolvePlayer,
  saveSession,
  submitAnswer,
} from "@/server/quiz";
import { getRanking, getSessionStandings } from "@/server/ranking";

const createdPlayers: string[] = [];
const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

async function newPlayer() {
  const { player, ownedIds } = await resolvePlayer(`lv_${randomBytes(5).toString("hex")}`, []);
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

afterAll(async () => {
  await prisma.session.deleteMany({ where: { playerId: { in: createdPlayers } } });
  await prisma.player.deleteMany({ where: { id: { in: createdPlayers } } });
  await prisma.$disconnect();
});

describe("modo Por Nível", () => {
  it("partida de 10 perguntas do mesmo nível, 1,0 por acerto, e entra no ranking do nível", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "LEVEL", level: 2 });
    const base = new Date();
    const categories: string[] = [];

    for (let position = 1; position <= 10; position++) {
      const now = at(base, position * 20_000);
      const q = await getCurrentQuestion(sessionId, ownedIds, now);
      if (q.status !== "in_progress") throw new Error(`esperava pergunta, veio ${q.status}`);
      expect(q).toMatchObject({ position, total: 10, level: 2, levelLabel: "Médio" });
      expect(JSON.stringify(q)).not.toContain("isCorrect");
      categories.push(q.category.name);

      // 7 acertos e 3 erros
      const correct = await correctOptionFor(sessionId, position);
      const wrong = q.options.find((o) => o.id !== correct)!.id;
      const result = await submitAnswer(
        sessionId,
        ownedIds,
        { position, optionId: position <= 7 ? correct : wrong },
        at(now, 4_000),
      );
      expect(result.finished).toBe(position === 10);
    }
    for (let i = 1; i < categories.length; i++) expect(categories[i]).not.toBe(categories[i - 1]);

    const result = await getSessionResult(sessionId, ownedIds);
    expect(result).toMatchObject({
      mode: "LEVEL",
      level: 2,
      total: 10,
      correctCount: 7,
      scoreTenths: 70,
      score: "7,0",
    });
    expect(result.levels).toEqual([
      { level: 2, label: "Médio", correct: 7, total: 10, pointsTenths: 70, maxTenths: 100 },
    ]);
    expect(result.review).toHaveLength(10);
    expect(result.review.every((r) => r.level === 2)).toBe(true);

    const standings = await getSessionStandings(sessionId, ownedIds);
    expect(standings?.scope).toEqual({ mode: "LEVEL", level: 2 });
    expect(standings?.all?.isBest).toBe(true);

    const ranking = await getRanking({ scope: { mode: "LEVEL", level: 2 }, period: "today", playerIds: ownedIds });
    expect([...ranking.top, ...ranking.mineOutsideTop].find((r) => r.isMine)).toMatchObject({ score: "7,0" });
    // Não aparece no ranking de outro nível nem no Geral.
    for (const scope of [{ mode: "LEVEL" as const, level: 3 as const }, { mode: "MIXED" as const }]) {
      const other = await getRanking({ scope, period: "today", playerIds: ownedIds });
      expect([...other.top, ...other.mineOutsideTop].some((r) => r.isMine)).toBe(false);
    }
  });

  it("jogo salvo mostra o total de 10 perguntas", async () => {
    const { player, ownedIds } = await newPlayer();
    const { sessionId } = await createSession({ playerId: player.id, mode: "LEVEL", level: 4 });
    const now = new Date();
    const q = await getCurrentQuestion(sessionId, ownedIds, now);
    if (q.status !== "in_progress") throw new Error("esperava pergunta");
    await submitAnswer(sessionId, ownedIds, { position: 1, optionId: q.options[0].id }, at(now, 3_000));
    await saveSession(sessionId, ownedIds, at(now, 5_000));
    const [saved] = await listSavedGames(ownedIds, at(now, 6_000));
    expect(saved).toMatchObject({ sessionId, mode: "LEVEL", level: 4, answered: 1, total: 10 });
  });

  it("exige um nível válido", async () => {
    const { player } = await newPlayer();
    await expect(createSession({ playerId: player.id, mode: "LEVEL" })).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.code === "invalid_level",
    );
    await expect(createSession({ playerId: player.id, mode: "LEVEL", level: 5 })).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.code === "invalid_level",
    );
  });

  it("o banco recusa combinações incoerentes de modo, categoria e nível", async () => {
    const { player } = await newPlayer();
    const bad = [
      { mode: "LEVEL" as const, level: null, categoryId: null },
      { mode: "LEVEL" as const, level: 9, categoryId: null },
      { mode: "MIXED" as const, level: 2, categoryId: null },
    ];
    for (const data of bad) {
      await expect(prisma.session.create({ data: { playerId: player.id, ...data } })).rejects.toThrow(
        /Session_mode_scope_check/,
      );
    }
  });
});
