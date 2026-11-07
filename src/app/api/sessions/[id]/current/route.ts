import { RATE_LIMITS } from "@/lib/rate-limit";
import { enforceRateLimit, handle, json, readOwnedPlayerIds, sessionIdFrom } from "@/server/http";
import { getCurrentQuestion } from "@/server/quiz";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await enforceRateLimit(req, "current", RATE_LIMITS.current);
    const sessionId = await sessionIdFrom(params);
    return json(await getCurrentQuestion(sessionId, await readOwnedPlayerIds()));
  });
}
