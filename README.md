# Quiz Web

Quiz de conhecimentos gerais: 20 perguntas com dificuldade crescente, nota de 0,0 a 10,0 e ranking.

- Produto: [PRD.md](PRD.md)
- Plano de desenvolvimento: [PLANO.md](PLANO.md)

## Como rodar localmente

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha com os dados do projeto **quiz-web-dev**.
3. `npm run db:migrate` (aplica as migrações)
4. `npm run db:seed:dev` (carrega as perguntas, inclusive as ainda não revisadas)
5. `npm run dev` e abra http://localhost:3000

## Scripts

Os scripts `db:*` leem o `.env.local` e se recusam a rodar contra o projeto de produção.


| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes de unidade (Vitest) |
| `npm run test:integration` | Testes de integração contra o banco **dev** (recusa o prod) |
| `npm run db:migrate` | Aplica as migrações no banco do `.env.local` |
| `npm run db:seed` | Carrega só as perguntas revisadas |
| `npm run db:seed:dev` | Carrega também as perguntas não revisadas (só dev) |
| `npm run db:verify` | Confere perguntas por nível, alternativas, RLS e CHECKs |
| `npm run db:studio` | Abre o Prisma Studio |
