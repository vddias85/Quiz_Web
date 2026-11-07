import { checkNotProd } from "../../src/lib/prod-guard";

// Carrega o .env.local com a função nativa do Node (sem dependência extra).
process.loadEnvFile(".env.local");

const guard = checkNotProd(process.env);
if (!guard.ok) {
  throw new Error(`Testes de integração bloqueados: ${guard.reason}`);
}

// Fora da Vercel, o pooler de transação (6543) acrescenta ~200 ms por consulta.
// Os testes usam a conexão de sessão (5432): mesma lógica, rede mais rápida.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
