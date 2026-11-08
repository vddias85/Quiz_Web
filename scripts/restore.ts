// Restaura um backup feito por scripts/backup.ts, para recuperação de desastre.
//   dotenv -e <arquivo .env> -v RESTORE_CONFIRM=<nome da pasta> -- tsx scripts/restore.ts backups/<pasta>
//
// Regras de segurança:
// - O banco de destino precisa estar com as MESMAS migrações do backup (rode as migrações antes).
// - O destino precisa estar VAZIO (sem jogadores nem perguntas): nunca mistura nem apaga dados.
// - RESTORE_CONFIRM precisa repetir o nome da pasta do backup (evita restaurar o backup errado).
// - Restaurar no prod exige também DB_ALLOW_PROD=1.
// Tudo acontece numa transação: se algo falhar, nada é gravado.
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { checkNotProd } from "../src/lib/prod-guard";
import { appliedMigrations, BACKUP_FORMAT, TABLES, type BackupManifest } from "./backup-tables";

const CHUNK = 1_000;

async function main() {
  const dirArg = process.argv[2];
  if (!dirArg) throw new Error("Informe a pasta do backup: tsx scripts/restore.ts backups/<pasta>");
  const dir = resolve(dirArg);
  if (process.env.RESTORE_CONFIRM !== basename(dir)) {
    throw new Error(`Para confirmar, defina RESTORE_CONFIRM=${basename(dir)}`);
  }

  const guard = checkNotProd(process.env, { allowProd: process.env.DB_ALLOW_PROD === "1" });
  if (!guard.ok) throw new Error(guard.reason);

  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT) throw new Error(`Formato de backup não suportado: ${manifest.format}`);

  const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  try {
    const migrations = await appliedMigrations(db);
    if (JSON.stringify(migrations) !== JSON.stringify(manifest.migrations)) {
      throw new Error(
        `As migrações do destino não batem com as do backup.\n  backup:  ${manifest.migrations.join(", ")}\n  destino: ${migrations.join(", ")}`,
      );
    }
    const [players, questions] = await Promise.all([db.player.count(), db.question.count()]);
    if (players > 0 || questions > 0) {
      throw new Error(`O destino não está vazio (${players} jogadores, ${questions} perguntas). Nada foi alterado.`);
    }

    await db.$transaction(
      async (tx) => {
        for (const table of TABLES) {
          const rows = JSON.parse(readFileSync(join(dir, `${table.name}.json`), "utf8")) as Record<string, unknown>[];
          for (let i = 0; i < rows.length; i += CHUNK) {
            await table.write(tx as unknown as PrismaClient, rows.slice(i, i + CHUNK));
          }
          if (rows.length !== manifest.counts[table.name]) {
            throw new Error(`${table.name}: o arquivo tem ${rows.length} linhas, o manifest diz ${manifest.counts[table.name]}`);
          }
          console.log(`  ${table.name.padEnd(16)} ${rows.length}`);
        }
        // Category usa id autoincremento: ajusta a sequência para depois do maior id restaurado.
        await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('"Category"', 'id'), GREATEST((SELECT max(id) FROM "Category"), 1))`;
      },
      { timeout: 10 * 60_000, maxWait: 30_000 },
    );
    console.log(`✔ Backup ${basename(dir)} restaurado.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
