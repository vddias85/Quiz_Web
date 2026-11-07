-- Regras de integridade que o schema do Prisma não expressa.

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_level_check" CHECK ("level" BETWEEN 1 AND 4);

ALTER TABLE "Option"
  ADD CONSTRAINT "Option_position_check" CHECK ("position" BETWEEN 0 AND 3);

-- No máximo 1 alternativa correta por pergunta (o seed garante exatamente 1).
CREATE UNIQUE INDEX "Option_one_correct_per_question"
  ON "Option" ("questionId") WHERE "isCorrect";

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_scoreTenths_check" CHECK ("scoreTenths" IS NULL OR "scoreTenths" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Session_correctCount_check" CHECK ("correctCount" IS NULL OR "correctCount" BETWEEN 0 AND 20),
  ADD CONSTRAINT "Session_totalTimeMs_check" CHECK ("totalTimeMs" IS NULL OR "totalTimeMs" >= 0),
  ADD CONSTRAINT "Session_category_mode_check" CHECK (
    ("mode" = 'MIXED' AND "categoryId" IS NULL) OR ("mode" = 'CATEGORY' AND "categoryId" IS NOT NULL)
  );

ALTER TABLE "SessionItem"
  ADD CONSTRAINT "SessionItem_position_check" CHECK ("position" BETWEEN 1 AND 20),
  ADD CONSTRAINT "SessionItem_timeMs_check" CHECK ("timeMs" IS NULL OR "timeMs" BETWEEN 0 AND 30000),
  ADD CONSTRAINT "SessionItem_optionOrder_check" CHECK (cardinality("optionOrder") = 4);

ALTER TABLE "QuestionReport"
  ADD CONSTRAINT "QuestionReport_text_check" CHECK ("text" IS NULL OR char_length("text") <= 500);

ALTER TABLE "Player"
  ADD CONSTRAINT "Player_nickname_check" CHECK (char_length("nickname") BETWEEN 3 AND 20);

-- Row Level Security: ativado em todas as tabelas, SEM nenhuma política.
-- Assim as chaves anon/authenticated do Supabase não leem nem escrevem nada.
-- O Prisma conecta como "postgres" (dono das tabelas), que não é bloqueado pelo RLS.
ALTER TABLE "Category"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Option"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Player"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionItem"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionReport"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
