import { RATE_LIMITS } from "@/lib/rate-limit";
import { enforceRateLimit, handle, json, readOwnedPlayerIds, sessionIdFrom } from "@/server/http";
import { resumeSession } from "@/server/quiz";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await enforceRateLimit(req, "resume", RATE_LIMITS.saveResume);
    const sessionId = await sessionIdFrom(params);
    await resumeSession(sessionId, await readOwnedPlayerIds());
    return json({ ok: true });
  });
}
