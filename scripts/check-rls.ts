// Conferência do RLS (PLANO Fase 5): com a chave PÚBLICA (anon/publishable) do Supabase, ninguém
// pode ler nem gravar nas tabelas pela API REST. O navegador só fala com a API do Next.js.
//   npm run check:rls:prod   → projeto prod (.env.prod.local)
//   npm run check:rls        → projeto dev (.env.local)
// Precisa de SUPABASE_ANON_KEY no arquivo .env correspondente. O SUPABASE_URL é opcional: sem ele,
// o endereço é montado a partir do project ref que aparece nas variáveis de conexão do mesmo arquivo.

const TABLES = ["Category", "Question", "Option", "Player", "Session", "SessionItem", "QuestionReport", "RateLimit"];

/** Project ref do banco deste arquivo .env: host "db.<ref>.supabase.co" ou usuário "postgres.<ref>". */
function projectRefFromConnection(): string | null {
  for (const url of [process.env.DIRECT_URL, process.env.DATABASE_URL]) {
    const m = url && /(?:db\.|postgres\.)([a-z0-9]{20})(?=[.:@])/i.exec(url);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

function resolveBaseUrl(): string {
  const ref = projectRefFromConnection();
  const given = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!given) {
    if (!ref) throw new Error("Defina SUPABASE_URL (ex.: https://<project-ref>.supabase.co).");
    return `https://${ref}.supabase.co`;
  }
  if (ref && !given.toLowerCase().includes(ref)) {
    throw new Error(
      "O SUPABASE_URL não é do mesmo projeto das variáveis de conexão (o project ref não aparece nele). " +
        "Corrija para https://<project-ref>.supabase.co ou deixe a linha SUPABASE_URL= em branco, que o endereço é montado sozinho.",
    );
  }
  return given;
}

async function main() {
  const base = resolveBaseUrl();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error("Defina SUPABASE_ANON_KEY (Supabase → Project Settings → API Keys: a chave pública).");
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
  const cause = (e as { cause?: { code?: string } }).cause?.code;
  if (cause === "ENOTFOUND") {
    console.error("✖ Endereço do Supabase não encontrado (ENOTFOUND): confira o SUPABASE_URL ou deixe-o em branco.");
  } else {
    console.error("✖", e instanceof Error ? e.message : e, cause ? `(${cause})` : "");
  }
  process.exit(1);
});

export {}; // arquivo de módulo (escopo próprio)
