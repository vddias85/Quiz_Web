# Roteiro de publicação (Fase 5)

Passos que **você** executa, porque envolvem segredos e o banco de produção. Nenhuma senha ou string de conexão precisa ser colada no chat. Rode os comandos no terminal, na pasta do projeto. Depois de cada etapa, basta me dizer se deu ✔ ou mostrar a mensagem de erro.

> Os comandos `db:prod:*` sempre começam conferindo que o `.env.prod.local` aponta para o **prod** e mostram `⚠ Alvo: banco de PRODUÇÃO`.

---

## 1. Arquivo `.env.prod.local`
1. Copie `.env.prod.example` para `.env.prod.local`. Ele fica fora do Git, como o `.env.local`.
2. Preencha com os valores do projeto **quiz-web-prod**, seguindo as instruções do próprio arquivo: `DATABASE_URL`, `DIRECT_URL`, `PROD_PROJECT_REF`, `SUPABASE_URL` e `SUPABASE_ANON_KEY` (a chave **pública**, nunca a `service_role`).
3. Confira:
   ```
   npm run db:prod:check
   ```
   Esperado: `⚠ Alvo: banco de PRODUÇÃO (xxxx…xxxx)`.

## 2. Estrutura do banco (migrações)
```
npm run db:prod:status
npm run db:prod:migrate
```
Esperado: 4 migrações aplicadas (`init`, `constraints_and_rls`, `save_game`, `idle_transaction_timeout`).

## 3. Perguntas (só as revisadas)
```
npm run db:prod:seed
npm run db:prod:verify
```
O `verify` deve mostrar:
- 10 categorias com `5 5 5 5`;
- `0` perguntas com problema;
- todas as tabelas com `rls=true políticas=0`;
- `CHECK ... true`;
- limite para conexões presas de `60s`.

## 4. RLS pela API pública
```
npm run check:rls:prod
```
Esperado: `✔ RLS ok: a chave pública não lê nem grava nada.`

*Opcional:* o site nunca usa a API REST do Supabase. Para fechar essa porta de vez, desative a **Data API** em Supabase (prod) → Project Settings → Data API. Se fizer isso, rode o `check:rls:prod` de novo: ele deve continuar ✔, mostrando "acesso negado".

## 5. Variáveis na Vercel
Abra Vercel → projeto → **Settings → Environment Variables**.

| Variável | Production (prod) | Preview (dev) |
|---|---|---|
| `DATABASE_URL` | pooler do **prod** (porta 6543), com `?pgbouncer=true&connection_limit=1` | a mesma do `.env.local` |
| `DIRECT_URL` | conexão direta do **prod** | a mesma do `.env.local` |
| `SESSION_SECRET` | um texto **novo**, diferente do dev (veja abaixo) | o mesmo do `.env.local` |

- Para gerar o `SESSION_SECRET` de prod, rode o comando abaixo e cole o resultado **direto na Vercel**, sem salvar em outro lugar:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- Marque as variáveis como **Sensitive**.
- Não coloque na Vercel: `PROD_PROJECT_REF`, `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Elas só servem para os scripts locais.

## 6. Novo deploy
As variáveis só valem num deploy novo. Em Vercel → **Deployments**, abra o deploy de produção mais recente, clique em **⋯** e depois em **Redeploy**.

## 7. Smoke test
```
npm run smoke -- https://SEU-ENDERECO.vercel.app
```
Esperado: 8 ✔, incluindo "Servidor na região de São Paulo (gru1)".

## 8. Teste manual
- Jogue uma partida inteira no celular e outra no computador, nos dois temas.
- Confira o resultado, a revisão e o ranking.
- Use um apelido que você não se importe de ver no ranking público, porque essas partidas ficam valendo.

## 9. Primeiro backup
```
npm run db:prod:backup
```
- O backup é salvo em `backups/prod-<data>/`, uma pasta fora do Git.
- **Guarde uma cópia fora do computador.**
- Sugestão de rotina: uma vez por semana e antes de cada mudança no banco.
- Para restaurar (só num banco vazio e com as mesmas migrações), siga as instruções no topo de `scripts/restore.ts`.

---

Quando terminar, me mande o resultado de cada etapa. Com isso, eu marco os critérios de aceite do PRD (§13) e atualizo a documentação.
