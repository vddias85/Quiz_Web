import { z } from "zod";

// As 10 categorias do PRD §4, na ordem de exibição. O slug é também o nome do arquivo em prisma/seed/.
export const CATEGORIES = [
  { slug: "geografia", name: "Geografia", icon: "🌎" },
  { slug: "historia", name: "História", icon: "🏛️" },
  { slug: "ciencias", name: "Ciências", icon: "🔬" },
  { slug: "cinema-e-tv", name: "Cinema e TV", icon: "🎬" },
  { slug: "musica", name: "Música", icon: "🎵" },
  { slug: "esportes", name: "Esportes", icon: "⚽" },
  { slug: "artes-e-literatura", name: "Artes e Literatura", icon: "📚" },
  { slug: "tecnologia", name: "Tecnologia", icon: "💻" },
  { slug: "matematica-e-logica", name: "Matemática e Lógica", icon: "🧮" },
  { slug: "brasil", name: "Brasil", icon: "🇧🇷" },
] as const;

export const QuestionSeedSchema = z
  .object({
    key: z.string().regex(/^[a-z-]+-\d{3}$/, "key deve ser '<slug>-NNN'"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    statement: z.string().trim().min(10).max(300),
    options: z.array(z.string().trim().min(1).max(120)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10).max(400).optional(),
    reviewed: z.boolean(),
  })
  .strict()
  .refine(
    (q) => new Set(q.options.map((o) => o.toLocaleLowerCase("pt-BR"))).size === 4,
    { message: "as 4 alternativas precisam ser diferentes", path: ["options"] },
  );

export const CategoryFileSchema = z.array(QuestionSeedSchema);

export type QuestionSeed = z.infer<typeof QuestionSeedSchema>;
