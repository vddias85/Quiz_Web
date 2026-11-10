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

/**
 * Lê uma página da tabela com SQL direto, ordenada pelo id (memória constante mesmo com muitas
 * sessões). SQL direto, e não o cliente do Prisma, porque o cliente segue o schema do código:
 * se o código já tiver uma coluna nova que o banco ainda não tem (backup ANTES de uma migração),
 * o Prisma falharia. Com SELECT *, o backup copia exatamente as colunas que existem no banco.
 * O nome da tabela vem só da lista fixa abaixo, nunca de entrada externa.
 */
function readPage(table: string) {
  return (db: PrismaClient, cursor: string | number | undefined, take: number): Promise<Row[]> =>
    cursor === undefined
      ? db.$queryRawUnsafe<Row[]>(`SELECT * FROM "${table}" ORDER BY "id" LIMIT ${Number(take)}`)
      : db.$queryRawUnsafe<Row[]>(`SELECT * FROM "${table}" WHERE "id" > $1 ORDER BY "id" LIMIT ${Number(take)}`, cursor);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- as linhas vêm do próprio banco, no mesmo formato */
export const TABLES: TableSpec[] = [
  {
    name: "Category",
    read: readPage("Category"),
    write: (db, rows) => db.category.createMany({ data: rows as any }),
    idOf: (r) => r.id as number,
  },
  {
    name: "Question",
    read: readPage("Question"),
    write: (db, rows) => db.question.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "Option",
    read: readPage("Option"),
    write: (db, rows) => db.option.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "Player",
    read: readPage("Player"),
    write: (db, rows) => db.player.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "Session",
    read: readPage("Session"),
    write: (db, rows) => db.session.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "SessionItem",
    read: readPage("SessionItem"),
    write: (db, rows) => db.sessionItem.createMany({ data: rows as any }),
    idOf: (r) => r.id as string,
  },
  {
    name: "QuestionReport",
    read: readPage("QuestionReport"),
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
