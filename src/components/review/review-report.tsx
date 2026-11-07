"use client";

import { useState } from "react";
import { ReportForm } from "@/components/quiz/report-form";

/** Botão "Reportar pergunta" (S13) na revisão: abre o mesmo formulário usado durante o quiz. */
export function ReviewReport({ sessionId, position }: { sessionId: string; position: number }) {
  const [open, setOpen] = useState(false);
  if (open) return <ReportForm sessionId={sessionId} position={position} onClose={() => setOpen(false)} />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      Reportar pergunta
    </button>
  );
}
