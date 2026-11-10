-- Correção da regra de coerência do modo LEVEL: num CHECK, uma expressão que resulta em NULL
-- é aceita. Com "level" nulo, "level" BETWEEN 1 AND 4 dava NULL e a sessão LEVEL sem nível passava.
ALTER TABLE "Session" DROP CONSTRAINT "Session_mode_scope_check";
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_mode_scope_check" CHECK (
       ("mode"::text = 'MIXED'    AND "categoryId" IS NULL     AND "level" IS NULL)
    OR ("mode"::text = 'CATEGORY' AND "categoryId" IS NOT NULL AND "level" IS NULL)
    OR ("mode"::text = 'LEVEL'    AND "categoryId" IS NULL     AND "level" IS NOT NULL AND "level" BETWEEN 1 AND 4)
  );
