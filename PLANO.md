# Plano de desenvolvimento — Quiz Web (PRD v1.1)

## Contexto
O PRD v1.1 está aprovado e ainda não há código; a pasta tem só `PRD.md` e `CLAUDE.md`. Este plano transforma as fases 1 a 6 do PRD (§12) em entregas concretas, com arquivos, decisões técnicas e verificação. A Fase 0 (contas no Supabase, GitHub e Vercel) é feita pelo usuário e é pré-requisito.

**Decisões tomadas agora:**
- **Apelido único** (sem diferenciar maiúsculas e minúsculas) e vinculado a um cookie assinado. O navegador que tem o cookie continua jogando com o apelido; outro navegador recebe o aviso "apelido em uso".
- **A pasta foi movida para `C:\Projetos\Jornada de Dados\Quiz_Web`** (fora do OneDrive) antes da Fase 1.

**Complementos técnicos.** O PRD não detalha estes pontos; eles serão registrados no PRD como **v1.2**:
- Nova tabela `QuestionReport` para o S13 ("reportar pergunta").
- Nova tabela `RateLimit` para o limite de requisições por IP. Memória local não serve em serverless.
- `Player.nickname` único, mais `nicknameKey` (minúsculas e sem acento) para checar duplicados.
- A nota é guardada como `scoreTenths Int` (0–100), em décimos.
- Campo `reviewed` nas perguntas do seed. **Só perguntas revisadas vão para produção.**
- Os períodos do ranking usam o fuso `America/Sao_Paulo`: Hoje = dia corrente, Semana = desde segunda-feira, Mês = desde o dia 1.
- Versões fixadas: `next@15` (conforme o PRD) e `prisma@6` (evita a mudança de configuração do Prisma 7).

---

## Fase 1 — Base
1. `git init`, `.gitignore` (inclui `.env*.local`) e `.env.example` só com as chaves das variáveis.
2. Criar o projeto com `create-next-app@15` (TypeScript, App Router, Tailwind, ESLint, pasta `src/`) e iniciar o shadcn/ui.
3. Dependências: `prisma@6`, `@prisma/client@6`, `zod`, `vitest`, `@playwright/test`, `next-themes`.
4. **`prisma/schema.prisma`**, seguindo o modelo do PRD §8.3 mais os complementos:
   - `datasource`: `url = env("DATABASE_URL")` (pooler 6543, com `?pgbouncer=true&connection_limit=1`) e `directUrl = env("DIRECT_URL")`.
   - Enums `Mode { MIXED CATEGORY }` e `SessionStatus { IN_PROGRESS FINISHED EXPIRED }`.
   - `SessionItem`: `optionOrder String[]`, `shownAt DateTime?`, `@@unique([sessionId, position])`.
   - Índices para o ranking: `Session(mode, categoryId, status, finishedAt)`.
5. **Migração de RLS** (`prisma/migrations/xxx_enable_rls/migration.sql`): `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em todas as tabelas, sem políticas. O Prisma conecta como `postgres`, que é dono das tabelas e por isso não é bloqueado pelo RLS.
6. `src/lib/db.ts`: singleton do PrismaClient (evita várias conexões durante o hot reload).
7. **Seed:**
   - `prisma/seed/<slug>.json`: um arquivo por categoria. Cada pergunta tem `{ level, statement, options[4], correctIndex, explanation, reviewed }`.
   - `prisma/seed.ts`: faz upsert idempotente, valida cada arquivo com Zod (exatamente 4 alternativas e 1 correta) e só aceita `reviewed: false` quando `SEED_ALLOW_UNREVIEWED=1`.
   - **Conteúdo inicial:** eu redijo 200 perguntas (5 por nível × 4 níveis × 10 categorias), marcadas como `reviewed: false` para a sua revisão.
8. Proteção: `scripts/assert-not-prod.ts` aborta testes e seed sem permissão se a `DATABASE_URL` apontar para o projeto prod. A checagem é pelo *project ref*, que você coloca em `PROD_PROJECT_REF`.
9. Primeiro push para o GitHub. **Você** importa o projeto na Vercel e configura a região `gru1`.

**Você faz:** cria o `.env.local` com as URLs do `quiz-web-dev` e o `SESSION_SECRET`. Eu nunca vejo esses valores.

## Fase 2 — Quiz (núcleo e segurança)
**Módulos puros (com testes no Vitest):**
- `src/lib/scoring.ts`: `POINTS = {1:3, 2:4, 3:6, 4:7}`, `scoreTenths(items)` e `formatScore(t)` (gera "7,4"). Também calcula os pontos de cada nível.
- `src/lib/draw.ts`: `drawSession({mode, categoryId, pool, recentIds, rng})` retorna 20 perguntas, 5 por nível, com a ordem embaralhada dentro de cada bloco.
  - No modo **MIXED**, cada bloco usa 5 categorias diferentes. Além disso, a 1ª pergunta de um bloco não pode ter a mesma categoria da última do bloco anterior, para que nunca haja 2 seguidas do mesmo tema.
  - Exclui as perguntas vistas nas últimas 3 sessões do jogador enquanto houver estoque; quando falta estoque, completa com perguntas já vistas.
  - Embaralha as alternativas (`optionOrder`).
  - O `rng` é injetável, para que os testes sejam determinísticos.
- `src/lib/timing.ts`: `isTimedOut(shownAt, now)`, com limite de 30 s + 2 s de tolerância. O `timeMs` gravado fica limitado a 30 000.
- `src/lib/nickname.ts`: normaliza o apelido (3–20 caracteres, letras, números, `_` e `-`) e aplica o filtro de palavrões em pt-BR. O filtro remove acentos, troca leetspeak (`4→a`, `3→e`, `0→o`, `1→i`) e compara com uma lista em `src/lib/profanity-pt.ts`.
- `src/lib/auth.ts`: cookie `qw_player`, `httpOnly`, assinado com HMAC-SHA256 usando o `SESSION_SECRET`.
- `src/lib/rate-limit.ts`: janela fixa por IP e rota, guardada na tabela `RateLimit`.

**API** (`src/app/api/...`). Todas as rotas validam a entrada com Zod e conferem se a sessão pertence ao jogador do cookie.
- `GET categories`: só mostra as categorias que têm pelo menos 5 perguntas ativas por nível.
- `POST sessions`:
  - Cria ou recupera o Player. Retorna 409 se o apelido pertence a outro cookie.
  - Sorteia as perguntas e cria os 20 `SessionItem` numa transação.
- `GET sessions/:id/current`:
  - Grava o `shownAt` só na primeira entrega. Um refresh não reinicia o tempo.
  - Se o item já expirou, marca como `timedOut` e avança.
  - Retorna `{ position, level, statement, options[{id,text}], remainingMs }`. **Não retorna `isCorrect`.**
- `POST sessions/:id/answer` (`{ position, optionId | null }`):
  - Faz um update condicional (`chosenOptionId IS NULL AND answeredAt IS NULL`), garantindo uma resposta por pergunta.
  - Calcula se houve timeout no servidor e retorna `{ correct, correctOptionId, explanation }`.
  - Na 20ª resposta, fecha a sessão: calcula `scoreTenths`, `correctCount` e `totalTimeMs`.
- `GET sessions/:id/result`: retorna a nota, os pontos por nível, a posição no ranking e a revisão completa (só para sessões FINISHED).
- `POST reports`: grava um `QuestionReport` (motivo e texto opcional), com limite de requisições.
- A sessão expira 15 min após `startedAt`: o status vira EXPIRED e ela não entra no ranking.

**Telas:**
- `src/app/page.tsx`: tela inicial com apelido e escolha de modo e categoria.
- `src/app/quiz/[id]/page.tsx`:
  - Componentes `QuestionCard`, `Timer` (usa o `remainingMs` do servidor e muda de cor nos últimos 10 s), `ProgressBar` e `LevelBadge`.
  - Painel de feedback com a explicação e o botão "Reportar".
  - Teclado: 1–4 e A–D.

## Fase 3 — Resultado e ranking
- `src/lib/ranking.ts`:
  - SQL bruto com `DISTINCT ON (playerId)`, que pega a melhor sessão de cada jogador. Ordenação: `scoreTenths DESC, totalTimeMs ASC, finishedAt ASC`.
  - Em seguida, `ROW_NUMBER()` dá a posição. Filtros: escopo (MIXED, ou CATEGORY com `categoryId`) e período.
  - Retorna o Top 50 e a linha do jogador atual, mesmo quando ele está fora do Top 50.
- `GET /api/ranking` e as páginas `src/app/resultado/[id]`, `src/app/revisao/[id]` e `src/app/ranking` (abas de escopo e filtros de período).

## Fase 4 — Acabamento
- Tema claro/escuro com `next-themes` e o toggle do shadcn.
- Animações leves em CSS e Tailwind, respeitando `prefers-reduced-motion`.
- Sons com `src/lib/sound.ts`: **desligados por padrão**, com a preferência salva no `localStorage`.
- Revisão de responsividade (celular, tablet e desktop) e de acessibilidade: `aria-live` no feedback e no timer, foco visível e contraste.
- **Playwright** (`tests/e2e/`), contra o banco **dev**:
  - Fluxo completo de 20 perguntas nos dois modos.
  - Timeout (usando o relógio controlado do Playwright).
  - Apelido duplicado e palavrão rejeitados.
  - Ranking exibindo a sessão.

## Fase 5 — Publicação
1. **Você** coloca `DATABASE_URL`, `DIRECT_URL` e `SESSION_SECRET` de **prod** nas variáveis da Vercel (ambiente Production) e configura o Preview com as do **dev**.
2. Rodar `prisma migrate deploy` contra prod. Eu passo o comando e você roda localmente com as variáveis de prod. Depois, o seed só com perguntas revisadas.
3. Deploy, smoke test manual e conferência do RLS: com a chave anon, uma consulta via REST precisa retornar vazio ou negar acesso.
4. Rotina de backup: `npm run db:prod:backup` (você executa). **Mudança:** o `pg_dump` não está instalado, então o backup é feito em Node com o Prisma (`scripts/backup.ts`, JSON por tabela + manifest), com restauração em `scripts/restore.ts`. A ida e volta foi testada num schema temporário do dev.
5. Proteção contra conexões presas pelo pooler: migração `idle_transaction_timeout` (`idle_in_transaction_session_timeout = 60s` no papel do banco). Na Fase 4 uma conexão ficou `idle in transaction` depois de o servidor ser encerrado no meio de uma requisição.
6. Comandos de prod (`db:prod:*`, `check:rls:prod`) usam o `.env.prod.local`, e o `smoke` testa o site publicado. O passo a passo está em [PUBLICACAO.md](PUBLICACAO.md).

## Fase 6 — Conteúdo
- Ampliar até 15 perguntas por nível por categoria (600 no total), em lotes por categoria.
- Cada lote é revisado por você, recebe `reviewed: true` e passa pelo seed de prod.
- Atualizar o `PRD.md` (v1.2, com os complementos acima) e o "Status atual" do `CLAUDE.md` a cada fase.

---

## Verificação
- **Unidade (Vitest):** `npm test` cobre:
  - Pontuação: todas as combinações relevantes, 0,0, 10,0 e os exemplos de 3,5 do PRD.
  - Sorteio: 1000 sorteios com seeds diferentes sem 2 temas seguidos, sempre 5 por nível, alternativas embaralhadas e fallback de estoque.
  - Timing, filtro de apelido e assinatura do cookie.
- **Segurança:** um teste confirma que nenhuma resposta de `GET current` contém `isCorrect` ou `correctOptionId`. Outro testa resposta após 33 s e resposta duplicada.
- **E2E (Playwright):** `npm run test:e2e` com o servidor local apontando para o **dev**. O `assert-not-prod` roda antes.
- **Manual:** jogar uma sessão completa em `npm run dev` no celular (DevTools) e no desktop, nos dois temas.
- **Critérios de aceite do PRD §13:** checklist marcado ao fim da Fase 5.
