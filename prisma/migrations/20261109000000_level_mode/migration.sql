-- Modo de jogo por nível de dificuldade (PRD v1.8): 10 perguntas de um único nível.

-- AlterEnum
ALTER TYPE "Mode" ADD VALUE 'LEVEL';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "level" INTEGER;

-- Coerência entre modo, categoria e nível. O valor novo do enum não pode ser usado na mesma
-- transação em que foi criado; por isso a comparação é feita com o modo convertido para texto.
ALTER TABLE "Session" DROP CONSTRAINT "Session_category_mode_check";
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_mode_scope_check" CHECK (
       ("mode"::text = 'MIXED'    AND "categoryId" IS NULL     AND "level" IS NULL)
    OR ("mode"::text = 'CATEGORY' AND "categoryId" IS NOT NULL AND "level" IS NULL)
    OR ("mode"::text = 'LEVEL'    AND "categoryId" IS NULL     AND "level" BETWEEN 1 AND 4)
  );

-- CreateIndex
CREATE INDEX "Session_mode_level_status_finishedAt_idx" ON "Session"("mode", "level", "status", "finishedAt");
