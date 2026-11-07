import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { QuizClient } from "@/components/quiz/quiz-client";

export const metadata: Metadata = { title: "Quiz Web — Partida" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // Sem link no logo: um clique acidental no meio da pergunta tiraria o jogador da partida.
    <PageShell width="2xl" linkHome={false}>
      <QuizClient sessionId={id} />
    </PageShell>
  );
}
