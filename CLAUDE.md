# CLAUDE.md — Quiz Web

Quiz web de conhecimentos gerais. **A fonte da verdade é o [PRD.md](PRD.md) (v1.3, aprovado).** Leia-o antes de qualquer implementação e não contrarie decisões dele sem perguntar ao usuário.

## Status atual
- PRD aprovado (v1.3). Fase 0 concluída (Supabase dev/prod em São Paulo, GitHub, Vercel).
- **Fase 1 concluída (07/11/2026):** Next.js 15 + shadcn, Prisma 6 (schema + migrações com CHECKs e RLS sem políticas), 200 perguntas no Supabase **dev** (todas revisadas pelo usuário em 07/11/2026, `reviewed: true`), `prod-guard`, Vitest, `vercel.json` (gru1). O prod segue vazio, sem migrações.
- O npm 11 exige aprovar scripts de instalação (`allowScripts` no `package.json`); ao atualizar Prisma/esbuild, rode `npm install-scripts approve <pkg>`.
- O Prisma CLI não lê `.env.local` sozinho: use sempre os scripts `npm run db:*` (usam `dotenv-cli`).
- Plano de desenvolvimento aprovado em 07/11/2026: ver [PLANO.md](PLANO.md) (fases 1–6, arquivos, verificação).
- Decisões do plano: apelido único (case-insensitive) vinculado a cookie assinado; projeto movido para `C:\Projetos\Jornada de Dados\Quiz_Web` (fora do OneDrive). Registradas no PRD v1.2 (§8.7).
- **Fase 2 concluída (07/11/2026):** módulos puros (`scoring`, `draw`, `timing`, `nickname`, `auth`, `rate-limit`), serviço `src/server/quiz.ts`, 6 rotas da API, telas inicial, quiz e resultado (versão inicial). 86 testes de unidade + 18 de integração (`npm run test:integration`, banco dev).
- Próximo: **Fase 3** (resultado completo com posição no ranking, revisão e página de ranking). Só comece cada fase quando o usuário pedir.
- A Vercel ainda não tem variáveis de ambiente (vêm na Fase 5): lá a página inicial mostra "indisponível".

## Regras de negócio (não negociáveis sem aprovação)
- 20 perguntas por sessão, 4 alternativas, 1 correta, alternativas embaralhadas.
- Dificuldade crescente: 1–5 fácil, 6–10 médio, 11–15 difícil, 16–20 avançado (5 de cada).
- Dois modos: **Temas Variados** (sem 2 perguntas seguidas do mesmo tema) e **Por Categoria**.
- 10 categorias: Geografia, História, Ciências, Cinema e TV, Música, Esportes, Artes e Literatura, Tecnologia, Matemática e Lógica, Brasil.
- **Pontuação ponderada:** 0,3 / 0,4 / 0,6 / 0,7 por acerto (fácil → avançado) = 10,0 no máximo. Calcular em décimos inteiros (3, 4, 6, 7) e dividir por 10 só na exibição. Uma casa decimal.
- **Timer de 30 s** por pergunta em todos os níveis; tempo esgotado = erro. Validar no servidor a partir de `shownAt`, com 2 s de tolerância.
- Ranking: geral e por categoria; períodos hoje/semana/mês/sempre; só a melhor nota por jogador; desempate por menor tempo total e depois por quem terminou primeiro.
- Identificação só por apelido (sem senha), com filtro de palavrões.

## Escopo da v1
- **Entra:** feedback com explicação, revisão ao final, tema claro/escuro, animações leves, sons opcionais **desligados por padrão**, botão "reportar pergunta".
- **v2 (não implementar agora):** painel admin, ajudas (eliminar 2 alternativas/pular), conquistas, desafio do dia, PWA, login com Google.
- **Fora:** compartilhar resultado.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Prisma + Supabase (PostgreSQL), Zod, Vitest + Playwright
- Deploy na Vercel (região `gru1`), Supabase em São Paulo

## Segurança (obrigatório)
- A resposta correta **nunca** vai para o navegador antes de o jogador responder. Correção, tempo e nota são calculados **só no servidor**.
- O navegador nunca acessa o Supabase diretamente; tudo passa pela API do Next.js.
- RLS ativado em todas as tabelas, sem políticas públicas.
- `DATABASE_URL` (pooler, porta 6543) para a aplicação; `DIRECT_URL` (porta 5432) para migrações.
- Segredos só em `.env.local` (no `.gitignore`) e nas variáveis da Vercel. Nunca peça ao usuário para colar senhas ou strings de conexão no chat; o próprio usuário as coloca nesses arquivos.
- Testes nunca rodam contra o projeto `quiz-web-prod`.

## Convenções
- Interface e textos em **português do Brasil**; código (nomes de variáveis/funções) em inglês.
- Regras críticas em módulos puros e testados: `src/lib/scoring.ts` (pontuação) e `src/lib/draw.ts` (sorteio).
- Perguntas em JSON por categoria em `prisma/seed/`; perguntas geradas por IA precisam de revisão humana antes de publicar.
- Ao mudar uma decisão do produto, atualize também o `PRD.md` (versão + histórico de mudanças).
