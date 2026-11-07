// Erro com status HTTP e mensagem em pt-BR para o usuário.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = () => new ApiError(404, "not_found", "Sessão não encontrada.");
