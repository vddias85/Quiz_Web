-- Salvar o jogo entre perguntas e continuar depois (PRD v1.4, §2.2).

-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'SAVED';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeMsBefore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "activeSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "savedAt" TIMESTAMP(3);

-- Sessões existentes: o trecho ativo começou no início da sessão.
UPDATE "Session" SET "activeSince" = "startedAt";

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_activeMsBefore_check" CHECK ("activeMsBefore" >= 0);

-- CreateIndex
CREATE INDEX "Session_playerId_status_idx" ON "Session"("playerId", "status");
