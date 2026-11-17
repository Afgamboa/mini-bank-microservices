-- Rows created before the saga refactor have no currency / initiator: backfill placeholders, then drop the defaults
-- so the schema matches schema.prisma (Prisma would otherwise report drift).
ALTER TABLE "Transaction"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "initiatedBy" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Transaction"
  ALTER COLUMN "currency" DROP DEFAULT,
  ALTER COLUMN "initiatedBy" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX "Transaction_initiatedBy_createdAt_idx" ON "Transaction"("initiatedBy", "createdAt");
