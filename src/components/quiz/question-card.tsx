"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"];

export interface OptionView {
  id: string;
  text: string;
}

export interface Reveal {
  chosenOptionId: string | null;
  correctOptionId: string;
}

/** Enunciado e alternativas. Com `reveal`, mostra a correta (verde) e a escolhida errada (vermelho). */
export function QuestionCard({
  statement,
  options,
  reveal,
  disabled,
  onChoose,
}: {
  statement: string;
  options: OptionView[];
  reveal?: Reveal;
  disabled?: boolean;
  onChoose: (optionId: string) => void;
}) {
  // O componente é recriado a cada pergunta (key = posição): o foco vai para o enunciado,
  // para que o leitor de tela leia a nova pergunta.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="animate-enter space-y-5">
      <h2 ref={heading} tabIndex={-1} className="text-xl leading-snug font-semibold outline-none sm:text-2xl">
        {statement}
      </h2>
      <ul className="grid gap-3" aria-label="Alternativas">
        {options.map((option, index) => {
          const isCorrect = reveal?.correctOptionId === option.id;
          const isWrongChoice = reveal && reveal.chosenOptionId === option.id && !isCorrect;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={disabled || !!reveal}
                onClick={() => onChoose(option.id)}
                aria-keyshortcuts={`${index + 1} ${LETTERS[index]}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  !reveal && "border-border bg-card hover:border-highlight/40 hover:bg-muted disabled:opacity-60",
                  reveal && !isCorrect && !isWrongChoice && "border-border bg-card opacity-60",
                  isCorrect && "animate-pop border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50",
                  isWrongChoice && "animate-shake border-red-500 bg-red-50 dark:bg-red-950/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                    isCorrect
                      ? "bg-emerald-500 text-white"
                      : isWrongChoice
                        ? "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {isCorrect ? "✓" : isWrongChoice ? "✗" : LETTERS[index]}
                </span>
                <span className="flex-1">{option.text}</span>
                {isCorrect && <span className="sr-only">(resposta correta)</span>}
                {isWrongChoice && <span className="sr-only">(sua resposta, incorreta)</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
