-- AlterTable
ALTER TABLE "SeoAnalysis" ADD COLUMN     "command" TEXT NOT NULL DEFAULT 'page',
ADD COLUMN     "industry" TEXT;

-- CreateIndex
CREATE INDEX "SeoAnalysis_command_idx" ON "SeoAnalysis"("command");
