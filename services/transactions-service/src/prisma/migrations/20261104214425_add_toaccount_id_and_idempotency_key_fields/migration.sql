/*
  Warnings:

  - A unique constraint covering the columns `[accountId,type,idempotencyKey]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotencyKey` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "toAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_type_idempotencyKey_key" ON "Transaction"("accountId", "type", "idempotencyKey");
