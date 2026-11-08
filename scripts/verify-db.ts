// Verificação do banco (somente leitura, exceto o teste de CHECK, que é desfeito).
// No prod: npm run db:prod:verify (DB_ALLOW_PROD=1 libera, já que nada é gravado).
import { PrismaClient } from "@prisma/client";
import { checkNotProd } from "../src/lib/prod-guard";

async function main() {
  const guard = checkNotProd(process.env, { allowProd: process.env.DB_ALLOW_PROD === "1" });
  if (!guard.ok) throw new Error(guard.reason);
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  try {
    const perLevel = await prisma.$queryRaw<{ slug: string; l1: bigint; l2: bigint; l3: bigint; l4: bigint }[]>`
      SELECT c.slug,
        count(*) FILTER (WHERE q.level=1) l1, count(*) FILTER (WHERE q.level=2) l2,
        count(*) FILTER (WHERE q.level=3) l3, count(*) FILTER (WHERE q.level=4) l4
      FROM "Category" c LEFT JOIN "Question" q ON q."categoryId"=c.id AND q.active
      GROUP BY c.slug, c."sortOrder" ORDER BY c."sortOrder"`;
    console.log("Perguntas ativas por nível:");
    for (const r of perLevel) console.log(`  ${r.slug.padEnd(20)} ${r.l1} ${r.l2} ${r.l3} ${r.l4}`);

    const badCorrect = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) n FROM "Question" q
      WHERE (SELECT count(*) FROM "Option" o WHERE o."questionId"=q.id AND o."isCorrect") <> 1
         OR (SELECT count(*) FROM "Option" o WHERE o."questionId"=q.id) <> 4`;
    console.log("Perguntas sem exatamente 4 alternativas e 1 correta:", Number(badCorrect[0].n));

    const rls = await prisma.$queryRaw<{ table: string; rls: boolean; policies: bigint }[]>`
      SELECT c.relname AS table, c.relrowsecurity AS rls,
        (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1`;
    console.log("RLS:");
    for (const r of rls) console.log(`  ${r.table.padEnd(20)} rls=${r.rls} políticas=${r.policies}`);

    // Testa um CHECK dentro de uma transação que é sempre desfeita.
    let checkOk = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "Question" SET level = 5 WHERE id = (SELECT id FROM "Question" LIMIT 1)`;
        throw new Error("CHECK não bloqueou");
      });
    } catch (e) {
      checkOk = String(e).includes("Question_level_check");
    }
    console.log("CHECK de nível bloqueia valor inválido:", checkOk);

    const timeout = await prisma.$queryRaw<{ t: string }[]>`
      SELECT coalesce((SELECT option_value FROM pg_options_to_table(r.rolconfig)
        WHERE option_name = 'idle_in_transaction_session_timeout'), 'não definido') AS t
      FROM pg_roles r WHERE r.rolname = current_user`;
    console.log("Limite para conexões presas (idle in transaction):", timeout[0]?.t);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
