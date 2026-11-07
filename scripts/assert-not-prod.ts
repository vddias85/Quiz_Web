// Uso: tsx scripts/assert-not-prod.ts  (roda antes dos testes que tocam o banco)
// Lê as variáveis já carregadas (ex.: via dotenv -e .env.local).
import { checkNotProd } from "../src/lib/prod-guard";

const result = checkNotProd(process.env);
if (!result.ok) {
  console.error(`\n✖ ${result.reason}\n`);
  process.exit(1);
}
console.log("✔ Banco não é o de produção.");
