// Revisão ao final (S5): as 20 perguntas, a resposta dada, a correta e a explicação.
// Só o dono da sessão (cookie) vê, e só depois que ela terminou.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { LevelBadge } from "@/components/quiz/level-badge";
import { ReviewReport } from "@/components/review/review-report";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/server/errors";
import { readOwnedPlayerIds, SESSION_ID_PATTERN } from "@/server/http";
import { getSessionResult, type SessionResultDto } from "@/server/quiz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz Web — Revisão" };

const LETTERS = ["A", "B", "C", "D"];

type ReviewItem = SessionResultDto["review"][number];

function Outcome({ item }: { item: ReviewItem }) {
  if (item.isCorrect) {
    return <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Acertou</span>;
  }
  return (
    <span className="text-sm font-semibold text-red-700 dark:text-red-400">
      {item.timedOut ? "⏱ Tempo esgotado" : "✗ Errou"}
    </span>
  );
}

function ReviewQuestion({ item, sessionId }: { item: ReviewItem; sessionId: string }) {
  return (
    <li className="space-y-3 rounded-xl border p-4 sm:p-5" aria-labelledby={`q${item.position}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{item.position}/20</span>
          <LevelBadge level={item.level} />
          <span>
            <span aria-hidden>{item.category.icon}</span> {item.category.name}
          </span>
        </div>
        <Outcome item={item} />
      </div>

      <h2 id={`q${item.position}`} className="font-medium">
        {item.statement}
      </h2>

      <ul className="space-y-2">
        {item.options.map((option, index) => {
          const chosen = item.chosenOptionId === option.id;
          const wrongChoice = chosen && !option.isCorrect;
          return (
            <li
              key={option.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                option.isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50",
                wrongChoice && "border-red-500 bg-red-50 dark:bg-red-950/50",
                !option.isCorrect && !wrongChoice && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  option.isCorrect
                    ? "bg-emerald-600 text-white"
                    : wrongChoice
                      ? "bg-red-600 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {option.isCorrect ? "✓" : wrongChoice ? "✗" : LETTERS[index]}
              </span>
              <span className="pt-0.5">
                {option.text}
                {option.isCorrect && <span className="sr-only"> (resposta correta)</span>}
                {chosen && <span className="ml-1 text-xs font-semibold">(sua resposta)</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {item.explanation && (
        <p className="rounded-lg bg-muted/60 p-3 text-sm">
          <span className="font-semibold">Explicação: </span>
          {item.explanation}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{item.timeMs != null && !item.timedOut ? `Respondida em ${formatDuration(item.timeMs)}` : ""}</span>
        <ReviewReport sessionId={sessionId} position={item.position} />
      </div>
    </li>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
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
    <PageShell width="2xl">
      <div className="space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Revisão das respostas</h1>
          <p className="text-sm text-muted-foreground">
            Nota {result.score} · {result.correctCount} de 20 acertos
          </p>
        </header>

        <ol className="space-y-4">
          {result.review.map((item) => (
            <ReviewQuestion key={item.position} item={item} sessionId={result.sessionId} />
          ))}
        </ol>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/resultado/${result.sessionId}`}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            Voltar ao resultado
          </Link>
          <Link
            href="/"
            className={buttonVariants({
              size: "lg",
              className: "h-11 px-6 text-base",
            })}
          >
            Jogar novamente
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
