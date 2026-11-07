// Seed idempotente das categorias e perguntas.
//   npm run db:seed       → só perguntas revisadas (reviewed: true)
//   npm run db:seed:dev   → inclui as não revisadas (SEED_ALLOW_UNREVIEWED=1); bloqueado em prod
// Rodar contra prod exige SEED_ALLOW_PROD=1 e nunca aceita perguntas não revisadas.
import { PrismaClient } from "@prisma/client";
import { checkNotProd } from "../src/lib/prod-guard";
import { CATEGORIES } from "./seed-schema";
import { loadSeedFiles } from "./seed-loader";

async function main() {
  const allowProd = process.env.SEED_ALLOW_PROD === "1";
  const guard = checkNotProd(process.env, { allowProd });
  if (!guard.ok) throw new Error(guard.reason);

  const allowUnreviewed = process.env.SEED_ALLOW_UNREVIEWED === "1";
  if (guard.isProd && allowUnreviewed) {
    throw new Error("Perguntas não revisadas nunca vão para produção (remova SEED_ALLOW_UNREVIEWED).");
  }

  const files = loadSeedFiles();
  // Conexão direta: o seed faz muitas operações seguidas e não precisa do pooler.
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });

  try {
    const seededKeys: string[] = [];
    let skipped = 0;

    for (const [index, cat] of CATEGORIES.entries()) {
      const category = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: { name: cat.name, icon: cat.icon, sortOrder: index },
        create: { slug: cat.slug, name: cat.name, icon: cat.icon, sortOrder: index },
      });

      for (const q of files.get(cat.slug) ?? []) {
        if (!q.reviewed && !allowUnreviewed) {
          skipped++;
          continue;
        }
        await prisma.$transaction(async (tx) => {
          const data = {
            categoryId: category.id,
            level: q.level,
            statement: q.statement,
            explanation: q.explanation ?? null,
            reviewed: q.reviewed,
            active: true,
          };
          const question = await tx.question.upsert({
            where: { key: q.key },
            update: data,
            create: { key: q.key, ...data },
          });
          // Zera as corretas antes, para o índice "1 correta por pergunta" não falhar
          // quando a resposta certa muda de posição.
          await tx.option.updateMany({ where: { questionId: question.id }, data: { isCorrect: false } });
          for (const [position, text] of q.options.entries()) {
            const isCorrect = position === q.correctIndex;
            await tx.option.upsert({
              where: { questionId_position: { questionId: question.id, position } },
              update: { text, isCorrect },
              create: { questionId: question.id, position, text, isCorrect },
            });
          }
        });
        seededKeys.push(q.key);
      }
    }

    // Perguntas que saíram dos arquivos (ou não revisadas, fora do modo dev) ficam inativas.
    // Não apagamos, porque sessões antigas podem apontar para elas.
    const deactivated = await prisma.question.updateMany({
      where: { key: { notIn: seededKeys }, active: true },
      data: { active: false },
    });

    console.log(
      `✔ Seed concluído (${guard.isProd ? "PROD" : "dev"}): ${seededKeys.length} perguntas ativas, ` +
        `${skipped} não revisadas ignoradas, ${deactivated.count} desativadas.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
