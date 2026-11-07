import { cleanE2eData, e2eDb } from "./db";

export default async function globalTeardown() {
  const db = e2eDb();
  try {
    await cleanE2eData(db);
  } finally {
    await db.$disconnect();
  }
}
