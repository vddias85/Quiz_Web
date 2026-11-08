// Backup dos dados em JSON (PLANO Fase 5), sem precisar instalar o pg_dump.
//   npm run db:prod:backup   → banco de produção (usa .env.prod.local)
//   npm run db:backup        → banco dev
// Gera backups/<banco>-<data>/ com um JSON por tabela e um manifest.json (contagens e migrações).
// A estrutura (tabelas, CHECKs, RLS) vem das migrações; para restaurar, veja scripts/restore.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { checkNotProd } from "../src/lib/prod-guard";
import { appliedMigrations, BACKUP_FORMAT, TABLES, type BackupManifest } from "./backup-tables";

const PAGE = 2_000;

function stamp(d: Date): string {
  // 2026-11-07_2135 no horário de São Paulo
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}`;
}

async function main() {
  const guard = checkNotProd(process.env, { allowProd: process.env.DB_ALLOW_PROD === "1" });
  if (!guard.ok) throw new Error(guard.reason);
  const database = guard.isProd ? "prod" : "dev";

  const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  const now = new Date();
  const dir = join(process.env.BACKUP_DIR ?? "backups", `${database}-${stamp(now)}`);
  mkdirSync(dir, { recursive: true });

  try {
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      createdAt: now.toISOString(),
      database,
      migrations: await appliedMigrations(db),
      counts: {},
    };

    for (const table of TABLES) {
      const rows: Record<string, unknown>[] = [];
      let cursor: string | number | undefined;
      for (;;) {
        const batch = await table.read(db, cursor, PAGE);
        rows.push(...batch);
        if (batch.length < PAGE) break;
        cursor = table.idOf(batch[batch.length - 1]);
      }
      writeFileSync(join(dir, `${table.name}.json`), JSON.stringify(rows));
      manifest.counts[table.name] = rows.length;
      console.log(`  ${table.name.padEnd(16)} ${rows.length}`);
    }

    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`✔ Backup do banco ${database.toUpperCase()} salvo em ${dir}`);
    if (database === "prod") {
      console.log("  Guarde uma cópia fora do computador (ex.: um drive na nuvem). Contém apelidos e partidas.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
