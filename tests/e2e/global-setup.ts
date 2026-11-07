import { cleanE2eData, e2eDb } from "./db";

// Antes de tudo: confirma que o banco é o DEV (e2eDb recusa o prod) e limpa restos de execuções anteriores.
export default async function globalSetup() {
  const db = e2eDb();
  try {
    await cleanE2eData(db);
  } finally {
    await db.$disconnect();
  }
}
