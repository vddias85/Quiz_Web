// Tabelas do backup, na ordem em que precisam ser restauradas (pais antes dos filhos).
// RateLimit fica de fora: são contadores de 1 minuto, sem valor depois.
import type { PrismaClient } from "@prisma/client";

export const BACKUP_FORMAT = 1;

export interface BackupManifest {
  format: number;
  createdAt: string;
  database: "prod" | "dev";
  migrations: string[]; // migrações aplicadas no banco de origem
  counts: Record<string, number>;
}

type Row = Record<string, unknown>;

export interface TableSpec {
  name: string;
  read: (db: PrismaClient, cursor: string | number | undefined, take: number) => Promise<Row[]>;
  write: (db: PrismaClient, rows: Row[]) => Promise<unknown>;
  idOf: (row: Row) => string | number;
}

// Cada tabela é lida em páginas ordenadas pelo id (memória constante mesmo com muitas sessões).
const page = <T>(cursor: T | undefined, take: number) => ({
  take,
  ...(cursor !== undefined ? { skip: 1, cursor: { id: cursor } } : {}),
  orderBy: { id: "asc" as const },
});

/* eslint-disable @typescript-eslint/no-explicit-any -- as linhas vêm do próprio banco, no mesmo formato */
export const TABLES: TableSpec[] = [
  {
    name: "Category",
    read: (db, c, t) => db.category.findMany(page(c as number | undefined, t)),
    write: (db, rows) => db.category.createMany({ data: rows as any }),
    idOf: (r) => r.id as number,
  },
  {
    name: "Question",
    read: (db, c, t) => db.question.findMany(page(c as string | undefined, t)),
    write: (db, rows) => db.question.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "Option",
    read: (db, c, t) => db.option.findMany(page(c as string | undefined, t)),
    write: (db, rows) => db.option.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "Player",
    read: (db, c, t) => db.player.findMany(page(c as string | undefined, t)),
    write: (db, rows) => db.player.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "Session",
    read: (db, c, t) => db.session.findMany(page(c as string | undefined, t)),
    write: (db, rows) => db.session.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "SessionItem",
    read: (db, c, t) => db.sessionItem.findMany(page(c as string | undefined, t)),
    write: (db, rows) => db.sessionItem.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "QuestionReport",
    read: (db, c, t) => db.questionReport.findMany(page(c as string | undefined, t)),
    write: (db, rows) => db.questionReport.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function appliedMigrations(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name`;
  return rows.map((r) => r.migration_name);
}
