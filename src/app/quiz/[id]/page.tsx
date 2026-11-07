import type { Metadata } from "next";
import { QuizClient } from "@/components/quiz/quiz-client";

export const metadata: Metadata = { title: "Quiz Web — Partida" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <QuizClient sessionId={id} />
    </main>
  );
}
