import { describe, expect, it } from "vitest";
import { loadSeedFiles } from "../../prisma/seed-loader";
import { CATEGORIES } from "../../prisma/seed-schema";

// Cada sessão por categoria precisa de 5 perguntas de cada nível (PRD §5).
const MIN_PER_LEVEL = 5;

describe("arquivos de perguntas (prisma/seed)", () => {
  const files = loadSeedFiles(); // lança erro se algum arquivo for inválido

  it("tem um arquivo para cada uma das 10 categorias", () => {
    expect([...files.keys()].sort()).toEqual(CATEGORIES.map((c) => c.slug).sort());
  });

  it.each(CATEGORIES.map((c) => c.slug))("%s tem pelo menos 5 perguntas por nível", (slug) => {
    const questions = files.get(slug)!;
    for (const level of [1, 2, 3, 4]) {
      expect(questions.filter((q) => q.level === level).length).toBeGreaterThanOrEqual(MIN_PER_LEVEL);
    }
  });

  it("não repete enunciados", () => {
    const statements = [...files.values()].flat().map((q) => q.statement.toLowerCase());
    expect(new Set(statements).size).toBe(statements.length);
  });
});
