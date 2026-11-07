import { z } from "zod";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { enforceRateLimit, handle, json, parseBody, readOwnedPlayerIds, SESSION_ID_PATTERN } from "@/server/http";
import { REPORT_REASONS, reportQuestion } from "@/server/quiz";

export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.string().regex(SESSION_ID_PATTERN),
  position: z.number().int().min(1).max(20),
  reason: z.enum(REPORT_REASONS),
  text: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    await enforceRateLimit(req, "report", RATE_LIMITS.report);
    const body = await parseBody(req, Body);
    await reportQuestion({ ...body, ownedIds: await readOwnedPlayerIds() });
    return json({ ok: true }, { status: 201 });
  });
}
