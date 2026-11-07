import { z } from "zod";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { enforceRateLimit, handle, json, parseBody, readOwnedPlayerIds, sessionIdFrom } from "@/server/http";
import { submitAnswer } from "@/server/quiz";

export const dynamic = "force-dynamic";

const Body = z.object({
  position: z.number().int().min(1).max(20),
  optionId: z.string().regex(/^[a-z0-9]{20,32}$/).nullable(), // null = tempo esgotado
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await enforceRateLimit(req, "answer", RATE_LIMITS.answer);
    const sessionId = await sessionIdFrom(params);
    const body = await parseBody(req, Body);
    return json(await submitAnswer(sessionId, await readOwnedPlayerIds(), body));
  });
}
