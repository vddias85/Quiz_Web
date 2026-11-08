// Conferência do RLS (PLANO Fase 5): com a chave PÚBLICA (anon/publishable) do Supabase, ninguém
// pode ler nem gravar nas tabelas pela API REST. O navegador só fala com a API do Next.js.
//   npm run check:rls:prod   → projeto prod (.env.prod.local)
//   npm run check:rls        → projeto dev (.env.local)
// Precisa de SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env correspondente.

const TABLES = ["Category", "Question", "Option", "Player", "Session", "SessionItem", "QuestionReport", "RateLimit"];

async function main() {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!base || !key) throw new Error("Defina SUPABASE_URL e SUPABASE_ANON_KEY (Supabase → Project Settings → API).");
  if (/service_role|sb_secret_/.test(key) || key.includes("c2VydmljZV9yb2xl")) {
    throw new Error("Essa parece ser a chave SECRETA (service_role). Use a chave pública (anon / publishable).");
  }

  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // chave anon antiga (JWT)

  let failures = 0;
  const ok = (msg: string) => console.log(`  ✔ ${msg}`);
  const fail = (msg: string) => {
    failures++;
    console.log(`  ✖ ${msg}`);
  };

  console.log("Leitura com a chave pública (esperado: vazio ou acesso negado)");
  for (const table of TABLES) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, { headers });
    const body = await res.text();
    if (res.ok) {
      const rows = JSON.parse(body) as unknown[];
      if (rows.length === 0) ok(`${table}: 200, nenhuma linha visível`);
      else fail(`${table}: 200 e RETORNOU DADOS — o RLS não está protegendo esta tabela!`);
    } else if ([401, 403, 404].includes(res.status)) {
      ok(`${table}: ${res.status}, acesso negado`);
    } else {
      fail(`${table}: resposta inesperada ${res.status} ${body.slice(0, 120)}`);
    }
  }

  console.log("Gravação com a chave pública (esperado: negada)");
  const probe = `rlscheck${Date.now().toString(36)}`;
  const res = await fetch(`${base}/rest/v1/Player`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ id: probe, nickname: "rls_check", nicknameKey: probe }),
  });
  if ([401, 403, 404].includes(res.status)) {
    ok(`Player: ${res.status}, gravação negada`);
  } else if (res.ok) {
    fail(`Player: GRAVAÇÃO ACEITA (${res.status}) — o RLS não está protegendo! Apague o jogador de id "${probe}".`);
  } else {
    const body = await res.text();
    // Erro de RLS também pode vir como 400 com o código 42501 (insufficient_privilege).
    if (body.includes("42501") || /row-level security|permission denied/i.test(body)) ok(`Player: ${res.status}, gravação negada`);
    else fail(`Player: resposta inesperada ${res.status} ${body.slice(0, 160)}`);
  }

  if (failures > 0) {
    console.log(`\n✖ ${failures} problema(s) encontrado(s).`);
    process.exit(1);
  }
  console.log("\n✔ RLS ok: a chave pública não lê nem grava nada.");
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});

export {}; // arquivo de módulo (escopo próprio)
