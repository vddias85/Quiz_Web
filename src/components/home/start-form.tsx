"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ClientApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CategoryDto } from "@/server/quiz";

const NICKNAME_STORAGE_KEY = "qw_nickname";

type Mode = "MIXED" | "CATEGORY";

export function StartForm({ categories }: { categories: CategoryDto[] }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<Mode>("MIXED");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Lembra o último apelido usado neste navegador (conveniência; o servidor confere pelo cookie).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
      if (saved) setNickname(saved);
    } catch {}
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "CATEGORY" && !categoryId) {
      setError("Escolha uma categoria.");
      return;
    }
    setSubmitting(true);
    try {
      const { sessionId, nickname: saved } = await api.startSession({
        nickname: nickname.trim(),
        mode,
        categoryId: mode === "CATEGORY" ? categoryId! : undefined,
      });
      try {
        localStorage.setItem(NICKNAME_STORAGE_KEY, saved);
      } catch {}
      router.push(`/quiz/${sessionId}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Não foi possível começar. Tente de novo.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={start} className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="nickname">Seu apelido</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Ex.: ana_quiz"
          autoComplete="nickname"
          minLength={3}
          maxLength={20}
          required
          className="h-11 text-base"
          aria-describedby="nickname-help"
        />
        <p id="nickname-help" className="text-xs text-muted-foreground">
          De 3 a 20 caracteres: letras, números, _ e -. É o nome que aparece no ranking.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Modo de jogo</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            selected={mode === "MIXED"}
            onSelect={() => setMode("MIXED")}
            icon="🎲"
            title="Temas Variados"
            text="Perguntas de todas as categorias, misturadas."
          />
          <ModeCard
            selected={mode === "CATEGORY"}
            onSelect={() => setMode("CATEGORY")}
            icon="🎯"
            title="Por Categoria"
            text="Todas as 20 perguntas de um tema só."
          />
        </div>
      </fieldset>

      {mode === "CATEGORY" && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Categoria</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  categoryId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <span aria-hidden className="text-lg">
                  {c.icon}
                </span>
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full text-base">
        {submitting ? "Preparando perguntas…" : "Começar"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        20 perguntas · 30 s cada · do fácil ao avançado · nota de 0 a 10
      </p>
    </form>
  );
}

function ModeCard(props: { selected: boolean; onSelect: () => void; icon: string; title: string; text: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onSelect}
      className={cn(
        "rounded-xl border-2 p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        props.selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
      )}
    >
      <div className="text-2xl" aria-hidden>
        {props.icon}
      </div>
      <div className="mt-1 font-semibold">{props.title}</div>
      <div className="text-sm text-muted-foreground">{props.text}</div>
    </button>
  );
}
