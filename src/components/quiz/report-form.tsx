"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ClientApiError } from "@/lib/api-client";
import type { ReportReasonCode } from "@/server/quiz";

const REASONS: { code: ReportReasonCode; label: string }[] = [
  { code: "WRONG_ANSWER", label: "A resposta marcada como correta está errada" },
  { code: "AMBIGUOUS", label: "Mais de uma alternativa pode estar certa" },
  { code: "TYPO", label: "Erro de digitação ou de português" },
  { code: "OUTDATED", label: "Informação desatualizada" },
  { code: "OTHER", label: "Outro problema" },
];

/** Formulário do botão "Reportar pergunta" (S13). */
export function ReportForm({
  sessionId,
  position,
  onClose,
}: {
  sessionId: string;
  position: number;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!reason) return;
    setState("sending");
    setError(null);
    try {
      await api.report({ sessionId, position, reason, text: text.trim() || undefined });
      setState("sent");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Não foi possível enviar.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border bg-muted/50 p-4 text-sm" role="status">
        Obrigado! Vamos revisar esta pergunta.{" "}
        <button type="button" className="font-medium underline underline-offset-4" onClick={onClose}>
          Fechar
        </button>
      </div>
    );
  }

  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">Qual é o problema?</legend>
      <div className="space-y-2">
        {REASONS.map((r) => (
          <label key={r.code} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`report-reason-${position}`}
              value={r.code}
              checked={reason === r.code}
              onChange={() => setReason(r.code)}
              className="size-4 accent-highlight"
            />
            {r.label}
          </label>
        ))}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="Detalhes (opcional)"
        aria-label="Detalhes do problema (opcional)"
        rows={2}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={send} disabled={!reason || state === "sending"}>
          {state === "sending" ? "Enviando…" : "Enviar"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </fieldset>
  );
}
