// Consulta do ranking (PRD §6.3 e §7). Só sessões FINISHED entram; cada jogador aparece
// uma vez, com a melhor sessão do período: maior nota → menor tempo → quem terminou primeiro.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { periodStart, RANKING_TOP, type Period, type RankingScope } from "@/lib/ranking";
import { formatScore, isLevel } from "@/lib/scoring";

export interface RankingRowDto {
  position: number;
  nickname: string;
  scoreTenths: number;
  score: string;
  totalTimeMs: number;
  finishedAt: string;
  isMine: boolean; // apelido criado por este navegador
}

export interface RankingDto {
  period: Period;
  totalPlayers: number;
  top: RankingRowDto[];
  /** Linhas dos apelidos deste navegador que ficaram fora do Top 50. */
  mineOutsideTop: RankingRowDto[];
}

interface RawRow {
  sessionId: string;
  playerId: string;
  nickname: string;
  scoreTenths: number;
  totalTimeMs: number;
  finishedAt: Date;
  position: number;
  total: number;
}

/**
 * Melhor sessão de cada jogador no escopo e período, já numerada.
 * Retorna as linhas com posição ≤ `limit` e as dos jogadores em `playerIds`.
 */
async function rankedRows(params: {
  scope: RankingScope;
  since: Date | null;
  limit: number;
  playerIds: readonly string[];
}): Promise<RawRow[]> {
  const { scope, since, limit, playerIds } = params;
  const scopeFilter =
    scope.mode === "CATEGORY"
      ? Prisma.sql`s."mode" = 'CATEGORY'::"Mode" AND s."categoryId" = ${scope.categoryId}`
      : scope.mode === "LEVEL"
        ? Prisma.sql`s."mode" = 'LEVEL'::"Mode" AND s."level" = ${scope.level}`
        : Prisma.sql`s."mode" = 'MIXED'::"Mode"`;
  const periodFilter = since ? Prisma.sql`AND s."finishedAt" >= ${since}` : Prisma.empty;
  const mine = playerIds.length > 0 ? Prisma.sql`OR r."playerId" IN (${Prisma.join([...playerIds])})` : Prisma.empty;

  return prisma.$queryRaw<RawRow[]>`
    WITH best AS (
      SELECT DISTINCT ON (s."playerId")
        s."id", s."playerId", s."scoreTenths", s."totalTimeMs", s."finishedAt"
      FROM "Session" s
      WHERE s."status" = 'FINISHED'::"SessionStatus"
        AND s."scoreTenths" IS NOT NULL
        AND ${scopeFilter}
        ${periodFilter}
      ORDER BY s."playerId", s."scoreTenths" DESC, s."totalTimeMs" ASC, s."finishedAt" ASC, s."id" ASC
    ),
    ranked AS (
      SELECT b.*,
        ROW_NUMBER() OVER (ORDER BY b."scoreTenths" DESC, b."totalTimeMs" ASC, b."finishedAt" ASC, b."id" ASC)::int AS "position",
        COUNT(*) OVER ()::int AS "total"
      FROM best b
    )
    SELECT r."id" AS "sessionId", r."playerId", p."nickname", r."scoreTenths", r."totalTimeMs", r."finishedAt",
      r."position", r."total"
    FROM ranked r
    JOIN "Player" p ON p."id" = r."playerId"
    WHERE r."position" <= ${limit} ${mine}
    ORDER BY r."position"
  `;
}

function toDto(row: RawRow, playerIds: readonly string[]): RankingRowDto {
  return {
    position: row.position,
    nickname: row.nickname,
    scoreTenths: row.scoreTenths,
    score: formatScore(row.scoreTenths),
    totalTimeMs: row.totalTimeMs,
    finishedAt: row.finishedAt.toISOString(),
    isMine: playerIds.includes(row.playerId),
  };
}

/** Top 50 do escopo e período, mais as linhas dos apelidos deste navegador fora do Top 50. */
export async function getRanking(params: {
  scope: RankingScope;
  period: Period;
  playerIds: readonly string[];
  now?: Date;
}): Promise<RankingDto> {
  const { scope, period, playerIds } = params;
  const rows = await rankedRows({
    scope,
    since: periodStart(period, params.now ?? new Date()),
    limit: RANKING_TOP,
    playerIds,
  });
  return {
    period,
    totalPlayers: rows[0]?.total ?? 0, // `total` vem em todas as linhas

    top: rows.filter((r) => r.position <= RANKING_TOP).map((r) => toDto(r, playerIds)),
    mineOutsideTop: rows.filter((r) => r.position > RANKING_TOP).map((r) => toDto(r, playerIds)),
  };
}

export interface PlayerStandingDto {
  position: number;
  totalPlayers: number;
  /** A sessão consultada é a melhor do jogador neste período (é ela que está no ranking). */
  isBest: boolean;
  best: { score: string; totalTimeMs: number };
}

/** Posição do jogador no escopo e período; null se ele ainda não aparece no ranking. */
export async function getPlayerStanding(params: {
  scope: RankingScope;
  period: Period;
  playerId: string;
  sessionId: string;
  now?: Date;
}): Promise<PlayerStandingDto | null> {
  const rows = await rankedRows({
    scope: params.scope,
    since: periodStart(params.period, params.now ?? new Date()),
    limit: 0,
    playerIds: [params.playerId],
  });
  const row = rows[0];
  if (!row) return null;
  return {
    position: row.position,
    totalPlayers: row.total,
    isBest: row.sessionId === params.sessionId,
    best: { score: formatScore(row.scoreTenths), totalTimeMs: row.totalTimeMs },
  };
}

/**
 * Posição da sessão terminada no ranking do seu escopo: em "Sempre" e "Hoje".
 * Só para o dono da sessão (cookie); sessões alheias ou não terminadas retornam null.
 */
export async function getSessionStandings(
  sessionId: string,
  ownedIds: readonly string[],
  now = new Date(),
): Promise<{
  scope: RankingScope;
  all: PlayerStandingDto | null;
  today: PlayerStandingDto | null;
} | null> {
  if (ownedIds.length === 0) return null;
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      playerId: { in: [...ownedIds] },
      status: "FINISHED",
    },
    select: { playerId: true, mode: true, categoryId: true, level: true },
  });
  if (!session) return null;
  const scope: RankingScope =
    session.mode === "CATEGORY" && session.categoryId
      ? { mode: "CATEGORY", categoryId: session.categoryId }
      : session.mode === "LEVEL" && isLevel(session.level)
        ? { mode: "LEVEL", level: session.level }
        : { mode: "MIXED" };
  const [all, today] = await Promise.all(
    (["all", "today"] as const).map((period) =>
      getPlayerStanding({
        scope,
        period,
        playerId: session.playerId,
        sessionId,
        now,
      }),
    ),
  );
  return { scope, all, today };
}
