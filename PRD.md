# PRD — Quiz Web de Conhecimentos Gerais

| Campo | Valor |
|---|---|
| Versão | 1.5 |
| Data | 07/11/2026 |
| Status | ✅ Aprovado em 07/11/2026 |

### Histórico de mudanças
| Versão | Mudança |
|---|---|
| 0.1 | Rascunho inicial |
| 0.2 | Timer fixo de 30 s por pergunta; compartilhamento de resultado removido da v1; banco no Supabase (conta do usuário) + app na Vercel |
| 1.0 | Aprovação final: sugestões definidas, pontuação fixa de 0,5, 10 categorias e stack Next.js + Prisma confirmadas |
| 1.1 | Pontuação trocada para ponderada por nível (0,3 / 0,4 / 0,6 / 0,7) |
| 1.2 | Complementos técnicos do plano de desenvolvimento (seção 8.7): apelido único vinculado a cookie, tabelas `QuestionReport` e `RateLimit`, nota em décimos, campo `reviewed` no seed, fuso do ranking, versões fixadas, região da Vercel via `vercel.json` |
| 1.3 | Detalhes da Fase 2: o cookie guarda até 10 apelidos por navegador (computador compartilhado); começar uma partida encerra a anterior que estiver em andamento |
| 1.4 | Nova função: **salvar o jogo e continuar depois** (seção 2.2). Só entre perguntas, válido por 24 h, um jogo salvo por apelido, entra no ranking; os 15 min passam a contar só o tempo de jogo ativo |
| 1.5 | Identidade visual (seção 10.1): logo "Quiz online" em todas as páginas e Tema Azul / Minimalista |

---

## 1. Visão geral

Aplicação web de quiz com perguntas de múltipla escolha (4 alternativas, 1 correta). Cada sessão tem **20 perguntas** com **dificuldade crescente** (do fácil ao avançado) e termina com uma **nota de 0,0 a 10,0**. As notas alimentam um **ranking** público.

### 1.1 Objetivos
- Oferecer uma experiência rápida (5–10 min por sessão) e desafiadora.
- Incentivar a repetição com ranking e categorias.
- Garantir que a pontuação seja justa e difícil de fraudar.

### 1.2 Fora do escopo (v1)
- Modo multiplayer em tempo real.
- Aplicativo mobile nativo (a web será responsiva).
- Geração automática de perguntas por IA em produção (pode ser usada só para *rascunhar* o banco, com revisão humana).

---

## 2. Usuários e fluxo principal

**Público:** qualquer pessoa que queira testar conhecimentos gerais; sem cadastro obrigatório na v1 (ver seção 9, item S1).

```
Tela inicial
   ├── Informar apelido (nickname)
   ├── Escolher modo:
   │     ├── 🎲 Temas Variados   → perguntas misturadas de todas as categorias
   │     └── 🎯 Por Categoria    → usuário escolhe 1 categoria
   ▼
Sessão (20 perguntas, dificuldade crescente)
   ├── Pergunta + 4 alternativas + cronômetro de 30 s
   ├── Responde (ou o tempo acaba) → feedback imediato (certo/errado + resposta correta)
   ├── Barra de progresso (ex.: 7/20) e indicador de nível
   ▼
Resultado
   ├── Nota final (0,0–10,0), acertos por nível
   ├── Posição no ranking
   └── Botões: Jogar novamente | Ver ranking | Revisar respostas
```

### 2.1 Tempo limite
- **30 segundos por pergunta**, igual para todos os níveis.
- O cronômetro aparece na tela e muda de cor nos últimos 10 s.
- Se o tempo acabar sem resposta, a pergunta conta como **erro** (0 ponto) e o quiz avança.
- O tempo é controlado também pelo **servidor**: uma resposta que chega depois de 30 s (com 2 s de tolerância para a internet) é considerada tempo esgotado, mesmo que o navegador seja manipulado.
- Duração máxima de uma sessão: 20 × 30 s = 10 minutos.

### 2.2 Salvar e continuar depois
- O botão **"Salvar e sair"** aparece **só entre perguntas**: depois do feedback de uma resposta e antes de a próxima pergunta ser exibida. Com uma pergunta na tela, é preciso responder (ou deixar o tempo acabar) antes de salvar.
- Assim, nenhuma pergunta fica vista e sem resposta. Ao voltar, o jogador recebe a **próxima pergunta, inédita**, com o cronômetro zerado (30 s). Salvar não funciona como "pular" (que continua na v2).
- O jogo salvo vale por **24 horas**. Depois disso, expira e não entra no ranking.
- **Um jogo salvo por apelido.** A tela inicial mostra o jogo salvo com o botão "Continuar". Começar uma partida nova com o mesmo apelido pede confirmação e descarta o jogo salvo.
- A partida retomada **entra no ranking normalmente**. O tempo total soma só o tempo gasto nas perguntas.
- O limite de 15 minutos por sessão conta só o **tempo de jogo ativo**: o período em que o jogo ficou salvo não conta.
- O jogo salvo fica vinculado ao navegador (cookie do apelido); não dá para continuar em outro aparelho.

---

## 3. Modos de sessão

| Modo | Descrição | Regras de sorteio |
|---|---|---|
| **Temas Variados** | Mistura de todas as categorias | Em cada nível, as perguntas são distribuídas entre categorias diferentes, evitando 2 seguidas do mesmo tema |
| **Por Categoria** | Usuário escolhe um tema | Todas as 20 perguntas da categoria escolhida |

---

## 4. Categorias sugeridas (10)

| # | Categoria | Exemplos de conteúdo |
|---|---|---|
| 1 | 🌎 **Geografia** | Capitais, países, rios, relevo, bandeiras |
| 2 | 🏛️ **História** | História do Brasil e geral, guerras, civilizações |
| 3 | 🔬 **Ciências** | Biologia, química, física, corpo humano |
| 4 | 🎬 **Cinema e TV** | Filmes, séries, diretores, premiações |
| 5 | 🎵 **Música** | Artistas, gêneros, instrumentos, MPB |
| 6 | ⚽ **Esportes** | Futebol, Olimpíadas, Fórmula 1, regras |
| 7 | 📚 **Artes e Literatura** | Livros, autores, pintura, movimentos artísticos |
| 8 | 💻 **Tecnologia** | Computação, internet, inventos, empresas de tecnologia |
| 9 | 🧮 **Matemática e Lógica** | Raciocínio, cálculo mental, curiosidades numéricas |
| 10 | 🇧🇷 **Brasil** | Cultura, culinária, folclore, política, curiosidades |

> Opcionais para o futuro: Mitologia, Natureza e Animais, Astronomia, Gastronomia Mundial, Games.

---

## 5. Progressão de dificuldade

Cada pergunta tem um nível de 1 a 4. A sessão segue sempre esta escada:

| Perguntas | Nível | Descrição |
|---|---|---|
| 1 – 5 | 🟢 **Fácil** | Conhecimento popular, a maioria acerta |
| 6 – 10 | 🟡 **Médio** | Requer algum estudo ou interesse no tema |
| 11 – 15 | 🟠 **Difícil** | Conhecimento específico |
| 16 – 20 | 🔴 **Avançado** | Detalhes, datas, nomes pouco conhecidos |

Dentro de cada bloco, a ordem das perguntas e das alternativas é embaralhada.

---

## 6. Pontuação

### 6.1 Regra adotada ✅ — pontuação ponderada por nível
Perguntas mais difíceis valem mais, somando 10,0 no total:

| Nível | Pontos por acerto | Total do bloco |
|---|---|---|
| Fácil | 0,3 | 1,5 |
| Médio | 0,4 | 2,0 |
| Difícil | 0,6 | 3,0 |
| Avançado | 0,7 | 3,5 |
| **Total** | | **10,0** |

- Erro ou tempo esgotado = 0.
- Nota exibida com uma casa decimal (ex.: **7,4**). Como todos os valores são múltiplos de 0,1, a nota é sempre exata, sem arredondamento.
- No código, os pontos são somados em décimos inteiros (3, 4, 6, 7) e divididos por 10 só na exibição, para evitar erros de arredondamento.
- Exemplo: acertar todas as fáceis e médias (1,5 + 2,0) e errar o resto = **3,5**; acertar só as 5 avançadas = **3,5**.
- A tela de resultado mostra os pontos obtidos em cada nível.

### 6.2 Alternativa não adotada: 0,5 fixo por acerto
Mantida só como referência: cada acerto valeria 0,5, independentemente do nível.

### 6.3 Desempate no ranking
1. Maior nota → 2. Menor tempo total da sessão → 3. Quem fez primeiro.

---

## 7. Ranking

- **Ranking Geral** (modo Temas Variados).
- **Ranking por Categoria** (um para cada tema).
- **Filtros de período:** Hoje · Semana · Mês · Sempre.
- Exibe Top 50 com posição, apelido, nota, tempo e data; destaca a posição do jogador atual mesmo fora do Top 50.
- Só a **melhor nota** de cada jogador entra em cada ranking/período (evita poluir com repetições).

---

## 8. Arquitetura e tecnologia

### 8.1 Stack escolhida

| Camada | Tecnologia | Motivo |
|---|---|---|
| Front-end + Back-end | **Next.js 15 (App Router) + TypeScript** | Um único projeto com páginas e API; fácil de publicar |
| Estilo | **Tailwind CSS** + componentes **shadcn/ui** | Interface moderna, responsiva e rápida de construir |
| Banco de dados | **Supabase (PostgreSQL)** — na sua conta | Postgres gerenciado, painel visual para ver os dados, plano gratuito |
| ORM | **Prisma** | Migrações e tipagem automática; conecta direto no Postgres do Supabase |
| Validação | **Zod** | Valida dados das requisições |
| Testes | **Vitest** (unidade) + **Playwright** (ponta a ponta) | Garante regras de pontuação e fluxo |
| Hospedagem | **Vercel** | Deploy automático a cada alteração, plano gratuito |

### 8.1.1 Como o Supabase será usado
- **Dois projetos no Supabase:** `quiz-web-dev` (desenvolvimento/testes) e `quiz-web-prod` (produção), para que testes nunca apaguem o ranking real. No plano gratuito cabem 2 projetos ativos.
- **Acesso ao banco só pelo servidor:** o navegador nunca fala direto com o Supabase. Toda leitura e escrita passa pela API do Next.js, rodando na Vercel. Isso protege as respostas corretas e o ranking.
- **Row Level Security (RLS) ativado** em todas as tabelas sem nenhuma regra pública. Assim, mesmo que a chave pública vaze, ninguém lê ou altera os dados por fora.
- **Conexões:**
  - `DATABASE_URL` → *connection pooler* do Supabase (porta 6543), usado pela aplicação na Vercel (funções serverless abrem muitas conexões curtas).
  - `DIRECT_URL` → conexão direta (porta 5432), usada só pelo Prisma para rodar migrações.
- **Segredos:** as strings de conexão ficam em `.env.local` (nunca vão para o Git) e nas *Environment Variables* da Vercel. Você mesmo copia essas strings do painel do Supabase e cola nesses lugares, sem precisar me passar a senha.
- **Região:** `South America (São Paulo)` no Supabase e `gru1` (São Paulo) na Vercel, para menor latência.
- **Backup:** o plano gratuito não tem backup automático diário; faremos exportação periódica (`pg_dump`) do banco de produção. Os arquivos de *seed* das perguntas no repositório servem como cópia do conteúdo.
- **Atenção:** projetos gratuitos do Supabase são **pausados após 7 dias sem acesso**. Se o quiz ficar parado, basta reativar no painel. Se virar um problema, podemos agendar um acesso automático semanal.

### 8.2 Diagrama

```
┌──────────────────────┐      HTTPS/JSON      ┌──────────────────────────┐
│  Navegador (React)   │ ───────────────────▶ │  Next.js API (servidor)  │
│  - Telas do quiz     │ ◀─────────────────── │  - Sorteio das perguntas │
│  - Timer / progresso │                      │  - Correção das respostas│
└──────────────────────┘                      │  - Cálculo da nota       │
                                              │  - Ranking               │
                                              │     (hospedado na Vercel)│
                                              └────────────┬─────────────┘
                                                           │ Prisma (pooler)
                                                  ┌────────▼──────────┐
                                                  │ Supabase Postgres │
                                                  │  (sua conta, RLS) │
                                                  └───────────────────┘
```

**Princípio de segurança:** a resposta correta **nunca** é enviada ao navegador antes do usuário responder. O servidor corrige cada resposta e calcula a nota — assim ninguém consegue “ver a resposta” no código da página ou enviar uma nota falsa ao ranking.

### 8.3 Modelo de dados

```
Category      id, slug, name, icon
Question      id, categoryId, level(1-4), statement, explanation?, active
Option        id, questionId, text, isCorrect
Player        id, nickname, createdAt
Session       id, playerId, mode(MIXED|CATEGORY), categoryId?, status,
              startedAt, finishedAt, score, correctCount, totalTimeMs
SessionItem   id, sessionId, questionId, position(1-20), optionOrder,
              shownAt, chosenOptionId?, isCorrect?, timedOut, answeredAt, timeMs
```

`shownAt` é gravado quando o servidor entrega a pergunta; é a partir dele que o limite de 30 s é verificado.

### 8.4 API

| Método | Rota | Função |
|---|---|---|
| GET | `/api/categories` | Lista categorias |
| POST | `/api/sessions` | Cria sessão (`mode`, `categoryId?`, `nickname`) e sorteia as 20 perguntas |
| GET | `/api/sessions/:id/current` | Retorna a pergunta atual (sem indicar a correta) |
| POST | `/api/sessions/:id/answer` | Envia resposta (ou `null` se o tempo acabou) → retorna se acertou, a correta e explicação |
| GET | `/api/sessions/:id/result` | Nota final e resumo |
| GET | `/api/ranking?scope=&categoryId=&period=` | Ranking filtrado |

### 8.5 Estrutura de pastas

```
Quiz_Web/
├── prisma/
│   ├── schema.prisma
│   └── seed/               # perguntas em JSON, um arquivo por categoria
├── src/
│   ├── app/                # páginas: início, quiz, resultado, ranking
│   │   └── api/            # rotas da API
│   ├── components/         # botões, cards de pergunta, tabela de ranking
│   ├── lib/
│   │   ├── scoring.ts      # regra de pontuação (testada)
│   │   ├── draw.ts         # sorteio das perguntas por nível
│   │   └── db.ts
│   └── types/
├── tests/
├── .env.example            # modelo das variáveis (sem valores reais)
└── PRD.md
```

### 8.6 Variáveis de ambiente

| Variável | Onde | Uso |
|---|---|---|
| `DATABASE_URL` | `.env.local` e Vercel | Conexão via pooler do Supabase (aplicação) |
| `DIRECT_URL` | `.env.local` e Vercel | Conexão direta do Supabase (migrações) |
| `SESSION_SECRET` | `.env.local` e Vercel | Assina o identificador da sessão do jogador |
| `PROD_PROJECT_REF` | `.env.local` | *Project ref* do Supabase prod; impede que testes e seed rodem contra produção |

### 8.7 Complementos técnicos (v1.2)

- **Apelido único**, sem diferenciar maiúsculas, minúsculas e acentos (`Player.nicknameKey`). O apelido fica vinculado a um cookie assinado (`qw_player`, HMAC-SHA256 com `SESSION_SECRET`). Outro navegador que tente usar o mesmo apelido recebe o aviso "apelido em uso". O cookie guarda até 10 apelidos, para que várias pessoas possam jogar no mesmo computador.
- **Uma partida por vez:** começar uma nova partida encerra (como expirada) a anterior que estiver em andamento.
- **`QuestionReport`**: grava os avisos do botão "reportar pergunta" (S13): pergunta, jogador, motivo, texto opcional e data.
- **`RateLimit`**: limite de requisições por IP e rota, guardado no banco. Memória local não funciona em serverless.
- **Nota em décimos**: `Session.scoreTenths` (inteiro de 0 a 100); a divisão por 10 acontece só na exibição.
- **`Question.reviewed`**: só perguntas revisadas por uma pessoa vão para produção.
- **Fuso do ranking**: `America/Sao_Paulo`. Hoje = dia corrente; Semana = desde segunda-feira; Mês = desde o dia 1.
- **Versões fixadas**: `next@15` e `prisma@6`.
- **Região da Vercel** fixada em `gru1` pelo arquivo `vercel.json` do repositório.

---

## 9. Banco de perguntas

- Formato JSON por categoria, carregado no banco via *seed*.
- **Meta v1:** 10 categorias × 4 níveis × 15 perguntas = **600 perguntas**.
  - Mínimo para funcionar: 5 por nível por categoria (200 no total), mas com muita repetição.
- Cada pergunta: enunciado, 4 alternativas, 1 correta, nível, explicação curta (opcional).
- Evitar repetição: o jogador não recebe perguntas que viu nas últimas sessões, enquanto houver estoque.
- Eu posso redigir o banco inicial; recomendo **revisão humana** antes de publicar (checagem de fatos).

---

## 10. Requisitos não funcionais

- **Responsivo:** funciona bem em celular, tablet e desktop.
- **Desempenho:** troca de pergunta em menos de 300 ms.
- **Acessibilidade:** navegação por teclado (teclas 1–4 / A–D), contraste adequado, leitores de tela.
- **Idioma:** português do Brasil.

### 10.1 Identidade visual
- **Logo:** "Quiz online" (arquivo original em `logo/logo.jpg`). Aparece no topo de todas as páginas; também é o ícone da aba e do atalho no celular.
- **Tema Azul / Minimalista** (o azul transmite confiança e foco):

| Elemento | Cor |
|---|---|
| Fundo da página | Azul gelo `#F0F4F8` |
| Cartão do quiz | Branco `#FFFFFF` |
| Texto | Azul-marinho escuro `#1E293B` |
| Destaques e botões | Azul primário `#0284C7` |

- As cores ficam como variáveis em `src/app/globals.css`. O tema escuro (S6) será definido na Fase 4.
- **Anti-fraude:** correção e controle do tempo no servidor, limite de requisições por IP, sessão expira após 15 min de jogo ativo (jogo salvo: 24 h), uma resposta por pergunta, RLS no Supabase.
- **Privacidade:** apenas apelido é armazenado; filtro de palavrões nos apelidos (LGPD — sem dados pessoais).

---

## 11. Sugestões adicionais — decididas

Decididas na v0.2:

| # | Sugestão | Decisão |
|---|---|---|
| S2 | **Timer por pergunta:** 30 s para todos os níveis; tempo esgotado = erro (detalhes na seção 2.1) | ✅ Aprovado |
| S9 | **Compartilhar resultado** (WhatsApp e redes) | ❌ Fora da v1 (pode voltar depois) |

Decididas na v1.0:

| # | Sugestão | Decisão |
|---|---|---|
| S1 | **Identificação:** v1 só com apelido (sem senha); login com Google numa v2 (o Supabase Auth já oferece isso) | ✅ Entra na v1 |
| S3 | **Pontuação ponderada** por nível (seção 6.1) em vez de 0,5 fixo | ✅ Adotada na v1.1 |
| S4 | **Feedback imediato** com explicação curta após cada resposta | ✅ Entra na v1 |
| S5 | **Revisão ao final:** ver todas as perguntas, sua resposta e a correta | ✅ Entra na v1 |
| S6 | **Tema claro/escuro** | ✅ Entra na v1 |
| S7 | **Painel administrativo** para cadastrar/editar perguntas sem mexer no código | 🔜 Fica para a v2 |
| S8 | **Ajudas (uma vez por sessão):** eliminar 2 alternativas / pular pergunta — com pequena penalidade | 🔜 Fica para a v2 |
| S10 | **Conquistas/medalhas** (ex.: “10 acertos seguidos”, “nota 10”) | 🔜 Fica para a v2 |
| S11 | **Sons e animações** leves (com botão de silenciar) | ✅ Entra na v1: animações leves; sons desligados por padrão, com botão para ativar |
| S12 | **Desafio do dia:** 20 perguntas iguais para todos, ranking diário próprio | 🔜 Fica para a v2 |
| S13 | **Botão “reportar pergunta”** para indicar erro no enunciado | ✅ Entra na v1 |
| S14 | **PWA** (instalar no celular como app) | 🔜 Fica para a v2 |

---

## 12. Plano de entrega

| Fase | Entregas |
|---|---|
| **0. Contas** (você) | Criar os projetos `quiz-web-dev` e `quiz-web-prod` no Supabase (região São Paulo); criar repositório no GitHub e conectar à Vercel |
| **1. Base** | Projeto Next.js, Prisma conectado ao Supabase dev, migrações, RLS, seed com perguntas iniciais |
| **2. Quiz** | Tela inicial, escolha de modo/categoria, fluxo das 20 perguntas, correção no servidor, timer de 30 s |
| **3. Resultado e ranking** | Nota, revisão, ranking geral/por categoria/por período |
| **4. Acabamento** | Responsividade, acessibilidade, tema escuro, testes |
| **5. Publicação** | Migrações no Supabase prod, variáveis na Vercel, deploy |
| **6. Conteúdo** | Completar o banco até ~600 perguntas revisadas |

---

## 13. Critérios de aceite (v1)

- [ ] Usuário escolhe entre “Temas Variados” e “Por Categoria”.
- [ ] Toda sessão tem exatamente 20 perguntas, 5 de cada nível, na ordem fácil → avançado.
- [ ] Cada pergunta mostra 4 alternativas embaralhadas, apenas 1 correta.
- [ ] Cada pergunta tem 30 s; ao esgotar, conta como erro e avança (validado também no servidor).
- [ ] Nota final entre 0,0 e 10,0, com uma casa decimal, calculada no servidor com pesos por nível (0,3 / 0,4 / 0,6 / 0,7).
- [ ] Resultado aparece no ranking correspondente, com filtros de período.
- [ ] Funciona em celular e desktop.
- [ ] Feedback com explicação após cada resposta e revisão completa ao final.
- [ ] Tema claro/escuro, animações leves e sons opcionais (desligados por padrão).
- [ ] Botão “reportar pergunta” grava o aviso no banco.
- [ ] Jogo pode ser salvo entre perguntas e retomado em até 24 h, voltando numa pergunta inédita.
- [ ] Publicado na Vercel usando o banco Supabase de produção.

---

## 14. Decisões

Todas as decisões foram tomadas; não há pendências.

- ✅ Timer de 30 s por pergunta (todos os níveis).
- ❌ Sem compartilhamento de resultado na v1.
- ✅ Hospedagem na Vercel; banco no Supabase (conta do usuário).
- ✅ **Entram na v1:** S1 (só apelido), S2 (timer), S3 (pontuação ponderada), S4 (feedback com explicação), S5 (revisão ao final), S6 (tema claro/escuro), S11 (animações leves e sons opcionais), S13 (reportar pergunta).
- 🔜 **Ficam para a v2:** S7 (painel admin), S8 (ajudas), S10 (conquistas), S12 (desafio do dia), S14 (PWA).
- ❌ **Fora:** S9 (compartilhar).
- ✅ Pontuação ponderada: 0,3 / 0,4 / 0,6 / 0,7 por acerto, conforme o nível (seção 6.1).
- ✅ As 10 categorias da seção 4.
- ✅ Stack: Next.js 15 + TypeScript + Tailwind + Prisma.
