// Ranking contra o banco dev. As sessões de teste terminam em 2099 e o relógio (`now`) é passado
// para 2099: assim os períodos Hoje/Semana/Mês só enxergam os dados criados aqui.
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getRanking, getSessionStandings } from "@/server/ranking";

const createdPlayers: string[] = [];

// Quarta-feira, 10/06/2099, 12:00 em São Paulo. Semana desde 08/06; mês desde 01/06.
const NOW = new Date("2099-06-10T15:00:00Z");
const TODAY = (h: number, m = 0) => new Date(Date.UTC(2099, 5, 10, h, m)); // h em UTC (≥ 3 = hoje em SP)

async function newPlayer(prefix = "rk") {
  const nickname = `${prefix}_${randomBytes(5).toString("hex")}`;
  const player = await prisma.player.create({ data: { nickname, nicknameKey: nickname } });
  createdPlayers.push(player.id);
  return player;
}

async function finished(
  playerId: string,
  scoreTenths: number,
  totalTimeMs: number,
  finishedAt: Date,
  scope: { categoryId?: number } = {},
) {
  return prisma.session.create({
    data: {
      playerId,
      mode: scope.categoryId ? "CATEGORY" : "MIXED",
      categoryId: scope.categoryId ?? null,
      status: "FINISHED",
      startedAt: new Date(finishedAt.getTime() - totalTimeMs),
      finishedAt,
      scoreTenths,
      correctCount: 10,
      totalTimeMs,
    },
    select: { id: true },
  });
}

afterAll(async () => {
  await prisma.session.deleteMany({ where: { playerId: { in: createdPlayers } } });
  await prisma.player.deleteMany({ where: { id: { in: createdPlayers } } });
  await prisma.$disconnect();
});

describe("ranking", () => {
  it("só a melhor sessão de cada jogador; desempate por tempo e depois por quem terminou primeiro", async () => {
    const [a, b, c] = [await newPlayer(), await newPlayer(), await newPlayer()];
    const category = await prisma.category.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });

    await finished(a.id, 80, 300_000, TODAY(10));
    await finished(a.id, 90, 400_000, TODAY(11)); // melhor de A
    await finished(a.id, 100, 100_000, TODAY(12), { categoryId: category.id }); // outro ranking
    await finished(b.id, 90, 350_000, TODAY(13)); // mesma nota de A, mais rápido
    await finished(c.id, 90, 350_000, TODAY(9)); // empate total com B, mas terminou antes
    // sessão não terminada não entra
    await prisma.session.create({ data: { playerId: c.id, mode: "MIXED", status: "IN_PROGRESS", startedAt: TODAY(14) } });

    const ranking = await getRanking({ scope: { mode: "MIXED" }, period: "today", playerIds: [a.id], now: NOW });
    expect(ranking.totalPlayers).toBe(3);
    expect(ranking.top.map((r) => r.nickname)).toEqual([c.nickname, b.nickname, a.nickname]);
    expect(ranking.top.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(ranking.top[2]).toMatchObject({ score: "9,0", scoreTenths: 90, totalTimeMs: 400_000, isMine: true });
    expect(ranking.top[0].isMine).toBe(false);
    expect(ranking.mineOutsideTop).toEqual([]);
    // Nada de ids internos na resposta pública.
    expect(JSON.stringify(ranking)).not.toContain(a.id);

    const byCategory = await getRanking({
      scope: { mode: "CATEGORY", categoryId: category.id },
      period: "today",
      playerIds: [],
      now: NOW,
    });
    expect(byCategory.top).toHaveLength(1);
    expect(byCategory.top[0]).toMatchObject({ nickname: a.nickname, score: "10,0" });
  });

  it("filtra por período no fuso de São Paulo e usa a melhor nota dentro do período", async () => {
    const p = await newPlayer("pd");
    await finished(p.id, 100, 200_000, new Date("2099-06-01T03:00:00Z")); // 01/06 00:00 SP: mês
    await finished(p.id, 70, 200_000, new Date("2099-06-08T03:00:00Z")); // segunda 00:00 SP: semana
    await finished(p.id, 40, 200_000, new Date("2099-06-10T03:00:00Z")); // hoje 00:00 SP
    await finished(p.id, 99, 200_000, new Date("2099-06-10T02:59:00Z")); // 09/06 23:59 SP: ontem

    const scoreIn = async (period: "today" | "week" | "month") => {
      const r = await getRanking({ scope: { mode: "MIXED" }, period, playerIds: [p.id], now: NOW });
      return [...r.top, ...r.mineOutsideTop].find((row) => row.isMine)?.score;
    };
    expect(await scoreIn("today")).toBe("4,0");
    expect(await scoreIn("week")).toBe("9,9");
    expect(await scoreIn("month")).toBe("10,0");
  });

  it("mostra o Top 50 e, à parte, o jogador deste navegador que ficou fora dele", async () => {
    const strong = await Promise.all(Array.from({ length: 51 }, () => newPlayer("tp")));
    for (const [i, player] of strong.entries()) {
      await finished(player.id, 100, 1_000 + i, TODAY(20));
    }
    const weak = await newPlayer("wk");
    await finished(weak.id, 0, 600_000, TODAY(20));

    const ranking = await getRanking({ scope: { mode: "MIXED" }, period: "today", playerIds: [weak.id], now: NOW });
    expect(ranking.top).toHaveLength(50);
    expect(ranking.top.some((r) => r.isMine)).toBe(false);
    expect(ranking.mineOutsideTop).toHaveLength(1);
    expect(ranking.mineOutsideTop[0]).toMatchObject({ nickname: weak.nickname, isMine: true });
    expect(ranking.mineOutsideTop[0].position).toBe(ranking.totalPlayers);
    expect(ranking.totalPlayers).toBeGreaterThan(51);
  });

  it("posição no resultado: só para o dono, e indica se a sessão é a melhor do jogador", async () => {
    const p = await newPlayer("st");
    const best = await finished(p.id, 95, 250_000, TODAY(21));
    const worse = await finished(p.id, 50, 250_000, TODAY(22));

    const forBest = await getSessionStandings(best.id, [p.id], NOW);
    expect(forBest?.scope).toEqual({ mode: "MIXED" });
    expect(forBest?.today?.isBest).toBe(true);
    expect(forBest?.all?.isBest).toBe(true);
    expect(forBest?.today?.position).toBeGreaterThanOrEqual(1);

    const forWorse = await getSessionStandings(worse.id, [p.id], NOW);
    expect(forWorse?.today).toMatchObject({ isBest: false, best: { score: "9,5" } });
    expect(forWorse?.today?.position).toBe(forBest?.today?.position);

    expect(await getSessionStandings(best.id, [], NOW)).toBeNull();
    const other = await newPlayer("ot");
    expect(await getSessionStandings(best.id, [other.id], NOW)).toBeNull();
  });
});
