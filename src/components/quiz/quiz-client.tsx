"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, ClientApiError } from "@/lib/api-client";
import type { Level } from "@/lib/scoring";
import type { AnswerResultDto, CurrentQuestionDto } from "@/server/quiz";
import { LevelBadge } from "./level-badge";
import { ProgressBar } from "./progress-bar";
import { QuestionCard } from "./question-card";
import { ReportForm } from "./report-form";
import { Timer } from "./timer";

type Question = Extract<CurrentQuestionDto, { status: "in_progress" }>;

type Phase =
  | { kind: "loading" }
  | { kind: "question"; question: Question; submitting: boolean }
  | { kind: "feedback"; question: Question; result: AnswerResultDto }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const KEY_TO_INDEX: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };

export function QuizClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [reporting, setReporting] = useState(false);
  const nextButton = useRef<HTMLButtonElement>(null);

  const goToResult = useCallback(() => router.replace(`/resultado/${sessionId}`), [router, sessionId]);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    setReporting(false);
    try {
      const current = await api.current(sessionId);
      if (current.status !== "in_progress") {
        return current.status === "finished" ? goToResult() : setPhase({ kind: "expired" });
      }
      setPhase({ kind: "question", question: current, submitting: false });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof ClientApiError ? err.message : "Erro inesperado." });
    }
  }, [sessionId, goToResult]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = useCallback(
    async (optionId: string | null) => {
      if (phase.kind !== "question" || phase.submitting) return;
      const question = phase.question;
      setPhase({ kind: "question", question, submitting: true });
      try {
        const result = await api.answer(sessionId, question.position, optionId);
        setPhase({ kind: "feedback", question, result });
      } catch (err) {
        if (err instanceof ClientApiError && err.status === 410) return setPhase({ kind: "expired" });
        if (err instanceof ClientApiError && err.status === 409) return void load(); // já respondida: sincroniza
        setPhase({ kind: "error", message: err instanceof ClientApiError ? err.message : "Erro inesperado." });
      }
    },
    [phase, sessionId, load],
  );

  const next = useCallback(() => {
    if (phase.kind !== "feedback") return;
    if (phase.result.finished) goToResult();
    else void load();
  }, [phase, goToResult, load]);

  // Foco no botão "Próxima" ao mostrar o feedback (teclado e leitores de tela).
  useEffect(() => {
    if (phase.kind === "feedback") nextButton.current?.focus();
  }, [phase.kind]);

  // Atalhos: 1–4 ou A–D para responder; Enter para avançar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if (phase.kind === "question") {
        const index = KEY_TO_INDEX[e.key.toLowerCase()];
        const option = index !== undefined ? phase.question.options[index] : undefined;
        if (option) {
          e.preventDefault();
          void answer(option.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, answer]);

  if (phase.kind === "loading") {
    return <p className="py-20 text-center text-muted-foreground" role="status">Carregando…</p>;
  }

  if (phase.kind === "expired") {
    return (
      <Message title="Sessão expirada" text="Esta partida passou do tempo limite de 15 minutos e não vale para o ranking." />
    );
  }

  if (phase.kind === "error") {
    return (
      <Message title="Não foi possível continuar" text={phase.message}>
        <Button variant="outline" onClick={() => void load()}>
          Tentar de novo
        </Button>
      </Message>
    );
  }

  const { question } = phase;
  const feedback = phase.kind === "feedback" ? phase.result : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LevelBadge level={question.level as Level} />
          <span className="text-sm text-muted-foreground">
            <span aria-hidden>{question.category.icon}</span> {question.category.name}
          </span>
        </div>
        <ProgressBar position={question.position} total={question.total} />
        {phase.kind === "question" ? (
          <Timer
            key={question.position}
            remainingMs={question.remainingMs}
            running={!phase.submitting}
            onExpire={() => void answer(null)}
          />
        ) : (
          <div className="h-7" aria-hidden />
        )}
      </header>

      <QuestionCard
        statement={question.statement}
        options={question.options}
        disabled={phase.kind === "question" && phase.submitting}
        reveal={feedback ? { chosenOptionId: feedback.chosenOptionId, correctOptionId: feedback.correctOptionId } : undefined}
        onChoose={(id) => void answer(id)}
      />

      {feedback && (
        <section className="space-y-4" aria-live="polite">
          <div
            className={
              feedback.correct
                ? "rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "rounded-xl bg-red-50 p-4 text-red-900 dark:bg-red-950/50 dark:text-red-200"
            }
          >
            <p className="font-semibold">
              {feedback.correct ? "✅ Resposta certa!" : feedback.timedOut ? "⏰ Tempo esgotado" : "❌ Resposta errada"}
            </p>
            {feedback.explanation && <p className="mt-1 text-sm">{feedback.explanation}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button ref={nextButton} size="lg" className="h-11 px-5 text-base" onClick={next}>
              {feedback.finished ? "Ver resultado" : "Próxima pergunta"}
            </Button>
            {!reporting && (
              <Button variant="ghost" onClick={() => setReporting(true)}>
                🚩 Reportar pergunta
              </Button>
            )}
          </div>

          {reporting && (
            <ReportForm sessionId={sessionId} position={question.position} onClose={() => setReporting(false)} />
          )}
        </section>
      )}

      {phase.kind === "question" && (
        <p className="hidden text-center text-xs text-muted-foreground sm:block">
          Dica: responda com as teclas 1–4 ou A–D.
        </p>
      )}
    </div>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
      <div className="flex justify-center gap-3">
        {children}
        <Link href="/" className={buttonVariants()}>
          Jogar de novo
        </Link>
      </div>
    </div>
  );
}
