// Uso: npm run db:prod:check (roda antes de todo comando db:prod:*).
// Confirma que o .env.prod.local aponta mesmo para o projeto de PRODUÇÃO, para que um arquivo
// trocado não aplique em outro banco o que era para o prod (ou vice-versa).
import { checkNotProd } from "../src/lib/prod-guard";

const result = checkNotProd(process.env, { allowProd: true });
if (!result.ok) {
  console.error(`\n✖ ${result.reason}\n`);
  process.exit(1);
}
if (!result.isProd) {
  console.error("\n✖ O .env.prod.local não aponta para o projeto de PRODUÇÃO (PROD_PROJECT_REF não aparece nas URLs).\n");
  process.exit(1);
}
const ref = process.env.PROD_PROJECT_REF!.trim().toLowerCase();
console.log(`⚠ Alvo: banco de PRODUÇÃO (${ref.slice(0, 4)}…${ref.slice(-4)}).`);
