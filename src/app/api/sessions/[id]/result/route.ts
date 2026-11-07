import { RATE_LIMITS } from "@/lib/rate-limit";
import { enforceRateLimit, handle, json, readOwnedPlayerIds, sessionIdFrom } from "@/server/http";
import { getSessionResult } from "@/server/quiz";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await enforceRateLimit(req, "result", RATE_LIMITS.result);
    const sessionId = await sessionIdFrom(params);
    return json(await getSessionResult(sessionId, await readOwnedPlayerIds()));
  });
}
