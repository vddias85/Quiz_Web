# CLAUDE.md — Quiz Web

Quiz web de conhecimentos gerais. **A fonte da verdade é o [PRD.md](PRD.md) (v1.7, aprovado).** Leia-o antes de qualquer implementação e não contrarie decisões dele sem perguntar ao usuário.

## Status atual
- PRD aprovado (v1.7). Fase 0 concluída (Supabase dev/prod em São Paulo, GitHub, Vercel).
- **Fase 1 concluída (07/11/2026):** Next.js 15 + shadcn, Prisma 6 (schema + migrações com CHECKs e RLS sem políticas), 200 perguntas no Supabase **dev** (todas revisadas pelo usuário em 07/11/2026, `reviewed: true`), `prod-guard`, Vitest, `vercel.json` (gru1). (O prod recebeu migrações e seed na Fase 5.)
- O npm 11 exige aprovar scripts de instalação (`allowScripts` no `package.json`); ao atualizar Prisma/esbuild, rode `npm install-scripts approve <pkg>`.
- O Prisma CLI não lê `.env.local` sozinho: use sempre os scripts `npm run db:*` (usam `dotenv-cli`).
- Plano de desenvolvimento aprovado em 07/11/2026: ver [PLANO.md](PLANO.md) (fases 1–6, arquivos, verificação).
- Decisões do plano: apelido único (case-insensitive) vinculado a cookie assinado; projeto movido para `C:\Projetos\Jornada de Dados\Quiz_Web` (fora do OneDrive). Registradas no PRD v1.2 (§8.7).
- **Fase 2 concluída (07/11/2026):** módulos puros (`scoring`, `draw`, `timing`, `nickname`, `auth`, `rate-limit`), serviço `src/server/quiz.ts`, 6 rotas da API, telas inicial, quiz e resultado (versão inicial). 86 testes de unidade + 18 de integração (`npm run test:integration`, banco dev).
- **Salvar e continuar depois (PRD v1.4, §2.2) implementado** em 07/11/2026: status `SAVED`, rotas `save`/`resume`, aviso na tela inicial.
- **Logo e Tema Azul (PRD v1.5/v1.6, §10.1)** aplicados em 07/11/2026: `PageShell` com logo "Quiz Web" em todas as páginas, cores em `globals.css`, ícones gerados de `logo/logo.jpg` com `npm run logo:build`. Botões em `#0369A1` (`primary`, contraste AA); destaques sem texto em `#0284C7` (`highlight`).
- **Fase 3 concluída (07/11/2026):** períodos do ranking em `src/lib/ranking.ts` (puro, fuso de São Paulo) e consulta SQL em `src/server/ranking.ts` (`DISTINCT ON` + `ROW_NUMBER`, Top 50 + apelidos do navegador fora dele); `GET /api/ranking`; páginas `/ranking` (filtros na URL: `?categoria=<slug>&periodo=hoje|semana|mes`), `/resultado/[id]` (posição em Sempre e Hoje) e `/revisao/[id]` (com "Reportar pergunta"). 100 testes de unidade + 27 de integração.
- **Fase 4 concluída (07/11/2026):** tema escuro com `next-themes` (paleta no `.dark` de `globals.css`; token `link` para texto azul), sons em `src/lib/sound.ts` (Web Audio, desligados por padrão), animações `animate-enter/pop/shake` (desligadas com "reduzir movimento"), botões de tema e som no `PageShell`, foco no enunciado e anúncios para leitores de tela. **Playwright** em `tests/e2e/` (`npm run test:e2e`, sobe `next dev` na porta 3200, banco dev): 11 testes, inclusive axe WCAG AA nos dois temas e celular (Pixel 7). Apelidos de teste usam o prefixo `e2e_` e são apagados no início e no fim.
- Se a limpeza do E2E ou do banco dev travar: procure conexões `idle in transaction` em `pg_stat_activity` (o pooler pode deixá-las quando o servidor é encerrado no meio de uma requisição).
- **Fase 5 concluída (08/11/2026):** site no ar em **https://quiz-web-beta-nine.vercel.app** (Vercel `gru1`, banco **prod** com as 4 migrações e as 200 perguntas revisadas). RLS conferido pela API pública (`check:rls:prod`), smoke test 8/8, teste manual ok, primeiro backup feito (`db:prod:backup`). Critérios de aceite do PRD §13 todos marcados. Comandos de prod usam o `.env.prod.local` (modelo `.env.prod.example`); passo a passo em [PUBLICACAO.md](PUBLICACAO.md).
- Vercel: variáveis `DATABASE_URL`, `DIRECT_URL` e `SESSION_SECRET` em Production (prod) e Preview (dev). A `DATABASE_URL` precisa terminar exatamente em `?pgbouncer=true&connection_limit=1` (o Supabase já entrega com `?pgbouncer=true`). A senha do banco prod foi trocada em 08/11/2026.
- Para conferir valores dos arquivos `.env`, use scripts que mostram só o formato; nunca peça para o usuário selecionar ou colar linhas desses arquivos (a seleção no editor chega ao chat).
- **Fase 6 em andamento** (conteúdo: 15 perguntas por nível por categoria, 600 no total). Fluxo por categoria: rascunho com `reviewed: false` → `db:seed:dev` → revisão do usuário no chat → `reviewed: true` → testes → commit → usuário roda `npm run db:prod:seed`. Evitar temas já presentes em outras categorias (checar com busca nos JSON).
  - **Brasil:** 60 perguntas (15 por nível), lote 021–060 revisado em 08/11/2026; publicado no prod.
  - **Geografia:** 60 perguntas (15 por nível, foco em geografia mundial; a do Brasil fica na categoria Brasil), lote 021–060 revisado em 08/11/2026.
  - Faltam: História, Ciências, Cinema e TV, Música, Esportes, Artes e Literatura, Tecnologia, Matemática e Lógica (ainda com 5 por nível; no modo Por Categoria todos recebem as mesmas 20 perguntas).

## Regras de negócio (não negociáveis sem aprovação)
- 20 perguntas por sessão, 4 alternativas, 1 correta, alternativas embaralhadas.
- Dificuldade crescente: 1–5 fácil, 6–10 médio, 11–15 difícil, 16–20 avançado (5 de cada).
- Dois modos: **Temas Variados** (sem 2 perguntas seguidas do mesmo tema) e **Por Categoria**.
- 10 categorias: Geografia, História, Ciências, Cinema e TV, Música, Esportes, Artes e Literatura, Tecnologia, Matemática e Lógica, Brasil.
- **Pontuação ponderada:** 0,3 / 0,4 / 0,6 / 0,7 por acerto (fácil → avançado) = 10,0 no máximo. Calcular em décimos inteiros (3, 4, 6, 7) e dividir por 10 só na exibição. Uma casa decimal.
- **Timer de 30 s** por pergunta em todos os níveis; tempo esgotado = erro. Validar no servidor a partir de `shownAt`, com 2 s de tolerância.
- Ranking: geral e por categoria; períodos hoje/semana/mês/sempre; só a melhor nota por jogador; desempate por menor tempo total e depois por quem terminou primeiro.
- Identificação só por apelido (sem senha), com filtro de palavrões.
- **Salvar jogo:** só entre perguntas (nunca com pergunta aberta), vale 24 h, um por apelido, entra no ranking. Sessão expira após 15 min de jogo **ativo** (tempo salvo não conta).

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
