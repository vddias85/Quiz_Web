// Limite de requisições por IP e rota, em janela fixa, guardado no banco
// (memória local não funciona em serverless: cada instância teria seu próprio contador).
import { prisma } from "./db";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  createSession: { limit: 10, windowMs: 60_000 },
  current: { limit: 120, windowMs: 60_000 },
  answer: { limit: 60, windowMs: 60_000 },
  result: { limit: 60, windowMs: 60_000 },
  report: { limit: 5, windowMs: 10 * 60_000 },
} satisfies Record<string, RateLimitRule>;

const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_AGE_MS = 24 * 60 * 60_000;

/** Conta mais uma requisição e diz se ela está dentro do limite. */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now = new Date(),
): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;

  // Limpeza ocasional das janelas antigas, sem atrasar a resposta.
  if (Math.random() < CLEANUP_PROBABILITY) {
    prisma.rateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - CLEANUP_AGE_MS) } } })
      .catch(() => {});
  }
  return Number(rows[0]?.count ?? 0) <= rule.limit;
}
