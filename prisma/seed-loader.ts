import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, CategoryFileSchema, type QuestionSeed } from "./seed-schema";

export const SEED_DIR = join(__dirname, "seed");

/** Lê e valida todos os arquivos de perguntas. Lança erro descritivo no primeiro problema. */
export function loadSeedFiles(dir = SEED_DIR): Map<string, QuestionSeed[]> {
  const result = new Map<string, QuestionSeed[]>();
  const allKeys = new Set<string>();

  for (const cat of CATEGORIES) {
    const file = join(dir, `${cat.slug}.json`);
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    const parsed = CategoryFileSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`${cat.slug}.json → [${issue.path.join(".")}] ${issue.message}`);
    }
    for (const q of parsed.data) {
      if (!q.key.startsWith(`${cat.slug}-`)) {
        throw new Error(`${cat.slug}.json → key "${q.key}" não começa com "${cat.slug}-"`);
      }
      if (allKeys.has(q.key)) throw new Error(`key duplicada: ${q.key}`);
      allKeys.add(q.key);
    }
    result.set(cat.slug, parsed.data);
  }
  return result;
}
