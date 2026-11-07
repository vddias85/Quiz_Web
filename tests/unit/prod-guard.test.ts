import { describe, expect, it } from "vitest";
import { checkNotProd } from "@/lib/prod-guard";

const PROD = "abcdefghijklmnopqrst";
const DEV = "zyxwvutsrqponmlkjihg";
const pooler = (ref: string) =>
  `postgresql://postgres.${ref}:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
const direct = (ref: string) => `postgresql://postgres:senha@db.${ref}.supabase.co:5432/postgres`;

describe("checkNotProd", () => {
  it("aceita o banco dev", () => {
    expect(
      checkNotProd({ PROD_PROJECT_REF: PROD, DATABASE_URL: pooler(DEV), DIRECT_URL: direct(DEV) }),
    ).toEqual({ ok: true, isProd: false });
  });

  it("bloqueia quando a URL do pooler é do prod", () => {
    const r = checkNotProd({ PROD_PROJECT_REF: PROD, DATABASE_URL: pooler(PROD), DIRECT_URL: direct(DEV) });
    expect(r.ok).toBe(false);
  });

  it("bloqueia quando a conexão direta é do prod", () => {
    const r = checkNotProd({ PROD_PROJECT_REF: PROD, DATABASE_URL: pooler(DEV), DIRECT_URL: direct(PROD) });
    expect(r.ok).toBe(false);
  });

  it("libera o prod só com permissão explícita", () => {
    expect(
      checkNotProd({ PROD_PROJECT_REF: PROD, DATABASE_URL: pooler(PROD) }, { allowProd: true }),
    ).toEqual({ ok: true, isProd: true });
  });

  it("falha de forma segura sem PROD_PROJECT_REF", () => {
    expect(checkNotProd({ DATABASE_URL: pooler(DEV) }).ok).toBe(false);
  });

  it("rejeita PROD_PROJECT_REF malformado", () => {
    expect(checkNotProd({ PROD_PROJECT_REF: "https://x", DATABASE_URL: pooler(DEV) }).ok).toBe(false);
  });

  it("falha sem URLs de conexão", () => {
    expect(checkNotProd({ PROD_PROJECT_REF: PROD }).ok).toBe(false);
  });
});
