"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ClientApiError } from "@/lib/api-client";
import type { SavedGameDto } from "@/server/quiz";

export interface SavedGameView extends SavedGameDto {
  hoursLeft: number;
}

export function describeMode(game: Pick<SavedGameDto, "mode" | "category">): string {
  return game.mode === "MIXED" ? "🎲 Temas Variados" : `${game.category?.icon ?? ""} ${game.category?.name ?? ""}`;
}

/** Lista os jogos salvos deste navegador com o botão "Continuar". */
export function SavedGames({ games, justSaved }: { games: SavedGameView[]; justSaved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resume(sessionId: string) {
    setBusy(sessionId);
    setError(null);
    try {
      await api.resume(sessionId);
      router.push(`/quiz/${sessionId}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Não foi possível continuar.");
      setBusy(null);
      router.refresh();
    }
  }

  if (games.length === 0) return null;

  return (
    <section aria-labelledby="saved-title" className="mb-8 space-y-3">
      {justSaved && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200" role="status">
          Jogo salvo! Você tem 24 horas para continuar de onde parou.
        </p>
      )}
      <h2 id="saved-title" className="text-sm font-medium">
        💾 Jogo salvo
      </h2>
      {games.map((g) => (
        <div key={g.sessionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
          <div className="text-sm">
            <div className="font-semibold">
              {g.nickname} · {describeMode(g)}
            </div>
            <div className="text-muted-foreground">
              {g.answered} de 20 respondidas · expira em {g.hoursLeft} h
            </div>
          </div>
          <Button onClick={() => void resume(g.sessionId)} disabled={busy !== null}>
            {busy === g.sessionId ? "Abrindo…" : "Continuar"}
          </Button>
        </div>
      ))}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
