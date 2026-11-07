// Acesso ao banco nos testes E2E: só para preparar e limpar dados, sempre no DEV.
import { PrismaClient } from "@prisma/client";
import { checkNotProd } from "../../src/lib/prod-guard";

/** Prefixo dos apelidos criados pelos testes E2E (apagados no início e no fim). */
export const E2E_PREFIX = "e2e_";

export function e2eDb(): PrismaClient {
  process.loadEnvFile(".env.local");
  const guard = checkNotProd(process.env);
  if (!guard.ok) throw new Error(`Testes E2E bloqueados: ${guard.reason}`);
  return new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
}

/** Remove os jogadores dos testes E2E e os limites de requisição do IP local. */
export async function cleanE2eData(db: PrismaClient): Promise<void> {
  const players = await db.player.findMany({ where: { nickname: { startsWith: E2E_PREFIX } }, select: { id: true } });
  const ids = players.map((p) => p.id);
  await db.questionReport.deleteMany({ where: { playerId: { in: ids } } });
  await db.session.deleteMany({ where: { playerId: { in: ids } } });
  await db.player.deleteMany({ where: { id: { in: ids } } });
  // Sem proxy na frente, o servidor local identifica o cliente como "unknown" (ou loopback).
  // SKIP LOCKED: se o servidor de testes foi encerrado no meio de uma requisição, o pooler pode
  // deixar uma linha bloqueada; a limpeza pula essa linha em vez de travar até o timeout.
  await db.$transaction([
    db.$executeRaw`SET LOCAL lock_timeout = '5s'`,
    db.$executeRaw`
      DELETE FROM "RateLimit" WHERE ctid IN (
        SELECT ctid FROM "RateLimit"
        WHERE "key" LIKE '%:unknown' OR "key" LIKE '%:::1' OR "key" LIKE '%:127.0.0.1'
        FOR UPDATE SKIP LOCKED
      )`,
  ]);
}
