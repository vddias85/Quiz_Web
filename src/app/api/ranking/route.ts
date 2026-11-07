// GET /api/ranking?scope=mixed|category&categoryId=&period=today|week|month|all (PRD §8.4)
import { z } from "zod";
import { PERIODS, type RankingScope } from "@/lib/ranking";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ApiError } from "@/server/errors";
import { enforceRateLimit, handle, json, readOwnedPlayerIds } from "@/server/http";
import { getRanking } from "@/server/ranking";

export const dynamic = "force-dynamic";

const querySchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("mixed"),
    period: z.enum(PERIODS).default("all"),
  }),
  z.object({
    scope: z.literal("category"),
    categoryId: z.coerce.number().int().positive(),
    period: z.enum(PERIODS).default("all"),
  }),
]);

export async function GET(req: Request) {
  return handle(async () => {
    await enforceRateLimit(req, "ranking", RATE_LIMITS.ranking);
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse({ scope: "mixed", ...params });
    if (!parsed.success) throw new ApiError(400, "invalid_query", "Filtros do ranking inválidos.");

    const q = parsed.data;
    const scope: RankingScope =
      q.scope === "category" ? { mode: "CATEGORY", categoryId: q.categoryId } : { mode: "MIXED" };
    return json(
      await getRanking({
        scope,
        period: q.period,
        playerIds: await readOwnedPlayerIds(),
      }),
    );
  });
}
