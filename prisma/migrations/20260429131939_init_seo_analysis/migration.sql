-- CreateTable
CREATE TABLE "SeoAnalysis" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "scores" JSONB NOT NULL,
    "parsed" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoAnalysis_url_idx" ON "SeoAnalysis"("url");

-- CreateIndex
CREATE INDEX "SeoAnalysis_createdAt_idx" ON "SeoAnalysis"("createdAt");
