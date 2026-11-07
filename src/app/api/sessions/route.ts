import { z } from "zod";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { enforceRateLimit, handle, json, parseBody, readOwnedPlayerIds, writeOwnedPlayerIds } from "@/server/http";
import { createSession, resolvePlayer } from "@/server/quiz";

export const dynamic = "force-dynamic";

const Body = z.object({
  nickname: z.string().max(100),
  mode: z.enum(["MIXED", "CATEGORY"]),
  categoryId: z.number().int().positive().optional(),
  discardSaved: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    await enforceRateLimit(req, "sessions", RATE_LIMITS.createSession);
    const body = await parseBody(req, Body);
    const { player, ownedIds } = await resolvePlayer(body.nickname, await readOwnedPlayerIds());
    const { sessionId } = await createSession({
      playerId: player.id,
      mode: body.mode,
      categoryId: body.categoryId,
      discardSaved: body.discardSaved,
    });
    await writeOwnedPlayerIds(ownedIds);
    return json({ sessionId, nickname: player.nickname }, { status: 201 });
  });
}
