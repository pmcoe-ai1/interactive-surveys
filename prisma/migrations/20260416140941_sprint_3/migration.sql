-- AlterTable
ALTER TABLE "responses" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "responses_userId_idx" ON "responses"("userId");

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
