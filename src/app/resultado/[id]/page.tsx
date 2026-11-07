// Resultado da partida. Versão inicial da Fase 2; a Fase 3 acrescenta posição no ranking e revisão.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LevelBadge } from "@/components/quiz/level-badge";
import { formatDuration } from "@/lib/format";
import { formatScore } from "@/lib/scoring";
import { ApiError } from "@/server/errors";
import { readOwnedPlayerIds, SESSION_ID_PATTERN } from "@/server/http";
import { getSessionResult, type SessionResultDto } from "@/server/quiz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz Web — Resultado" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SESSION_ID_PATTERN.test(id)) notFound();

  let result: SessionResultDto;
  try {
    result = await getSessionResult(id, await readOwnedPlayerIds());
  } catch (err) {
    if (err instanceof ApiError) notFound();
    throw err;
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-8 px-4 py-10">
      <header className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          {result.mode === "MIXED"
            ? "🎲 Temas Variados"
            : `${result.category?.icon ?? ""} ${result.category?.name ?? ""}`}{" "}
          · {result.nickname}
        </p>
        <h1 className="text-lg font-medium">Sua nota</h1>
        <p className="text-7xl font-extrabold tabular-nums">{result.score}</p>
        <p className="text-muted-foreground">
          {result.correctCount} de 20 acertos · {formatDuration(result.totalTimeMs)}
        </p>
      </header>

      <section aria-labelledby="levels-title" className="rounded-xl border">
        <h2 id="levels-title" className="sr-only">
          Pontos por nível
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Nível</th>
              <th className="px-4 py-2 text-right font-medium">Acertos</th>
              <th className="px-4 py-2 text-right font-medium">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {result.levels.map((l) => (
              <tr key={l.level} className="border-t">
                <td className="px-4 py-2">
                  <LevelBadge level={l.level} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {l.correct}/{l.total}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatScore(l.pointsTenths)} <span className="text-muted-foreground">/ {formatScore(l.maxTenths)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex justify-center">
        <Link href="/" className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base" })}>
          Jogar novamente
        </Link>
      </div>
    </main>
  );
}
