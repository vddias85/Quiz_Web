// Impede que testes e seed rodem contra o projeto quiz-web-prod.
// A checagem é pelo project ref do Supabase, que aparece tanto no host da conexão
// direta (db.<ref>.supabase.co) quanto no usuário do pooler (postgres.<ref>).

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

export type ProdGuardResult =
  | { ok: true; isProd: boolean }
  | { ok: false; reason: string };

export function checkNotProd(
  env: Record<string, string | undefined>,
  options: { allowProd?: boolean } = {},
): ProdGuardResult {
  const prodRef = env.PROD_PROJECT_REF?.trim().toLowerCase();
  if (!prodRef) {
    return {
      ok: false,
      reason:
        "PROD_PROJECT_REF não está definido no .env.local. Sem ele não dá para garantir que o banco não é o de produção.",
    };
  }
  if (!PROJECT_REF_PATTERN.test(prodRef)) {
    return {
      ok: false,
      reason:
        "PROD_PROJECT_REF parece inválido: o esperado são 20 letras minúsculas e números (o código que aparece na URL do painel do Supabase).",
    };
  }

  const urls = [env.DATABASE_URL, env.DIRECT_URL].filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  if (urls.length === 0) {
    return { ok: false, reason: "DATABASE_URL e DIRECT_URL não estão definidos." };
  }

  const isProd = urls.some((u) => u.toLowerCase().includes(prodRef));
  if (isProd && !options.allowProd) {
    return {
      ok: false,
      reason: "As variáveis de conexão apontam para o projeto de PRODUÇÃO. Operação bloqueada.",
    };
  }
  return { ok: true, isProd };
}
