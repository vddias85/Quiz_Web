// Chamadas à API feitas pelo navegador.
import type { AnswerResultDto, CurrentQuestionDto, ReportReasonCode } from "@/server/quiz";

export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ClientApiError(0, "network", "Sem conexão. Verifique sua internet e tente de novo.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ClientApiError(
      res.status,
      data?.error?.code ?? "unknown",
      data?.error?.message ?? "Algo deu errado. Tente novamente.",
    );
  }
  return data as T;
}

export const api = {
  startSession: (body: {
    nickname: string;
    mode: "MIXED" | "CATEGORY" | "LEVEL";
    categoryId?: number;
    level?: number;
    discardSaved?: boolean;
  }) =>
    request<{ sessionId: string; nickname: string }>("/api/sessions", { method: "POST", body: JSON.stringify(body) }),

  current: (sessionId: string) => request<CurrentQuestionDto>(`/api/sessions/${sessionId}/current`),

  answer: (sessionId: string, position: number, optionId: string | null) =>
    request<AnswerResultDto>(`/api/sessions/${sessionId}/answer`, {
      method: "POST",
      body: JSON.stringify({ position, optionId }),
    }),

  save: (sessionId: string) => request<{ ok: true }>(`/api/sessions/${sessionId}/save`, { method: "POST" }),

  resume: (sessionId: string) => request<{ ok: true }>(`/api/sessions/${sessionId}/resume`, { method: "POST" }),

  report: (body: { sessionId: string; position: number; reason: ReportReasonCode; text?: string }) =>
    request<{ ok: true }>("/api/reports", { method: "POST", body: JSON.stringify(body) }),
};
