// Smoke test do site publicado (PLANO Fase 5). Só leitura: não cria jogadores nem partidas.
//   npm run smoke -- https://seu-site.vercel.app
const base = (process.argv[2] ?? "").replace(/\/+$/, "");

interface Check {
  name: string;
  run: () => Promise<string | true>; // true = ok; texto = motivo da falha
}

async function get(path: string) {
  const res = await fetch(base + path, { redirect: "manual", headers: { "User-Agent": "quiz-web-smoke" } });
  return { res, text: await res.text() };
}

const FAKE_SESSION = "c000000000000000000000000";

const checks: Check[] = [
  {
    name: "Página inicial carrega com as categorias (banco conectado)",
    run: async () => {
      const { res, text } = await get("/");
      if (res.status !== 200) return `status ${res.status}`;
      if (text.includes("indisponível")) return "a página diz que o quiz está indisponível (variáveis de ambiente ou banco)";
      return text.includes("Temas Variados") ? true : "formulário inicial não encontrado";
    },
  },
  {
    name: "Servidor na região de São Paulo (gru1)",
    run: async () => {
      const { res } = await get("/api/categories");
      const id = res.headers.get("x-vercel-id");
      if (!id) return "cabeçalho x-vercel-id ausente (não é a Vercel?)";
      return id.includes("gru1") ? true : `x-vercel-id = ${id}`;
    },
  },
  {
    name: "GET /api/categories retorna as 10 categorias",
    run: async () => {
      const { res, text } = await get("/api/categories");
      if (res.status !== 200) return `status ${res.status}`;
      const n = (JSON.parse(text) as { categories: unknown[] }).categories.length;
      return n === 10 ? true : `${n} categorias jogáveis (esperado 10: o seed foi aplicado?)`;
    },
  },
  {
    name: "GET /api/ranking responde",
    run: async () => {
      const { res, text } = await get("/api/ranking?period=all");
      if (res.status !== 200) return `status ${res.status}`;
      return "totalPlayers" in JSON.parse(text) ? true : "formato inesperado";
    },
  },
  {
    name: "Página de ranking carrega",
    run: async () => {
      const { res, text } = await get("/ranking");
      if (res.status !== 200) return `status ${res.status}`;
      return text.includes("indisponível") ? "a página diz que o ranking está indisponível" : true;
    },
  },
  {
    name: "Sessão de outra pessoa não é revelada (404)",
    run: async () => {
      const [api, page] = await Promise.all([
        get(`/api/sessions/${FAKE_SESSION}/current`),
        get(`/resultado/${FAKE_SESSION}`),
      ]);
      if (api.res.status !== 404) return `API: status ${api.res.status}`;
      return page.res.status === 404 ? true : `página de resultado: status ${page.res.status}`;
    },
  },
  {
    name: "Filtros inválidos do ranking são recusados (400)",
    run: async () => {
      const { res } = await get("/api/ranking?period=ontem");
      return res.status === 400 ? true : `status ${res.status}`;
    },
  },
  {
    name: "Ícone e logo publicados",
    run: async () => {
      const [icon, logo] = await Promise.all([get("/icon.png"), get("/logo-256.webp")]);
      if (icon.res.status !== 200) return `/icon.png: status ${icon.res.status}`;
      return logo.res.status === 200 ? true : `/logo-256.webp: status ${logo.res.status}`;
    },
  },
];

async function main() {
  if (!/^https?:\/\//.test(base)) {
    console.error("Uso: npm run smoke -- https://seu-site.vercel.app");
    process.exit(1);
  }
  console.log(`Smoke test em ${base}\n`);
  let failures = 0;
  for (const check of checks) {
    let result: string | true;
    try {
      result = await check.run();
    } catch (e) {
      result = e instanceof Error ? e.message : String(e);
    }
    if (result === true) console.log(`  ✔ ${check.name}`);
    else {
      failures++;
      console.log(`  ✖ ${check.name}: ${result}`);
    }
  }
  console.log(failures === 0 ? "\n✔ Tudo certo." : `\n✖ ${failures} verificação(ões) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();

export {}; // arquivo de módulo (escopo próprio)
