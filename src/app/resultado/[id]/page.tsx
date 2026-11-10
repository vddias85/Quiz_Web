// Resultado da partida: nota, pontos por nível, posição no ranking e atalhos (PRD §2).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { LevelBadge } from "@/components/quiz/level-badge";
import { formatDuration } from "@/lib/format";
import { modeLabel, rankingFilter, rankingName as rankingNameOf } from "@/lib/modes";
import { rankingHref } from "@/lib/ranking";
import { formatScore } from "@/lib/scoring";
import { ApiError } from "@/server/errors";
import { readOwnedPlayerIds, SESSION_ID_PATTERN } from "@/server/http";
import { getSessionResult, type SessionResultDto } from "@/server/quiz";
import { getSessionStandings } from "@/server/ranking";

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

  // A posição no ranking é complementar: se a consulta falhar, o resultado aparece mesmo assim.
  const standings = await getSessionStandings(id, await readOwnedPlayerIds()).catch((err) => {
    console.error("[resultado] falha ao calcular a posição no ranking:", err);
    return null;
  });
  const rankingName = rankingNameOf(result);
  const rankingLink = rankingHref(rankingFilter(result));

  return (
    <PageShell>
      <div className="space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            {modeLabel(result)} · {result.nickname}
          </p>
          <h1 className="text-lg font-medium">Sua nota</h1>
          <p className="animate-pop text-7xl font-extrabold tabular-nums">{result.score}</p>
          <p className="text-muted-foreground">
            {result.correctCount} de {result.total} acertos · {formatDuration(result.totalTimeMs)}
          </p>
        </header>

        {standings?.all && (
          <section
            aria-labelledby="standing-title"
            className="rounded-xl bg-secondary p-4 text-center text-secondary-foreground"
          >
            <h2 id="standing-title" className="sr-only">
              Posição no ranking
            </h2>
            <p className="text-lg">
              <span aria-hidden>🏆 </span>
              <strong className="tabular-nums">{standings.all.position}º</strong> de {standings.all.totalPlayers} no{" "}
              {rankingName}
            </p>
            {standings.today && (
              <p className="text-sm">
                Hoje: <strong className="tabular-nums">{standings.today.position}º</strong> de{" "}
                {standings.today.totalPlayers}
              </p>
            )}
            {!standings.all.isBest && (
              <p className="mt-1 text-sm">
                Vale a sua melhor nota: {standings.all.best.score} ({formatDuration(standings.all.best.totalTimeMs)}).
              </p>
            )}
          </section>
        )}

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
                    {formatScore(l.pointsTenths)}{" "}
                    <span className="text-muted-foreground">/ {formatScore(l.maxTenths)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className={buttonVariants({
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            Jogar novamente
          </Link>
          <Link
            href={rankingLink}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            Ver ranking
          </Link>
          <Link
            href={`/revisao/${result.sessionId}`}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            Revisar respostas
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
