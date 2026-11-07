"use client";

import { useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const TOTAL_MS = 30_000;
const WARNING_MS = 10_000;

/**
 * Cronômetro visual. O prazo vem do servidor (`remainingMs`); o servidor também valida o tempo,
 * então alterar este componente não dá vantagem a ninguém.
 */
export function Timer({
  remainingMs,
  running,
  onExpire,
}: {
  remainingMs: number;
  running: boolean;
  onExpire: () => void;
}) {
  const deadline = useRef(performance.now() + remainingMs);
  const [left, setLeft] = useState(remainingMs);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const ms = Math.max(0, deadline.current - performance.now());
      setLeft(ms);
      if (ms === 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [running]);

  const seconds = Math.ceil(left / 1000);
  const warning = left <= WARNING_MS;

  // Tique nos últimos 5 segundos (só com os sons ligados).
  useEffect(() => {
    if (running && seconds > 0 && seconds <= 5) playSound("tick");
  }, [seconds, running]);

  // Para leitores de tela: avisos só aos 10 s e aos 5 s (anunciar todo segundo seria cansativo).
  const announcement = seconds > 10 ? "" : seconds > 5 ? "Restam 10 segundos" : seconds > 0 ? "Restam 5 segundos" : "";

  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${seconds} segundos restantes`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-200 ease-linear", warning ? "bg-red-500" : "bg-highlight")}
          style={{ width: `${(left / TOTAL_MS) * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "w-10 text-right text-lg font-bold tabular-nums",
          warning ? "text-red-600 dark:text-red-400" : "text-foreground",
        )}
      >
        {seconds}s
      </span>
      <span className="sr-only" aria-live="assertive">
        {announcement}
      </span>
    </div>
  );
}
