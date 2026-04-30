-- CreateTable
CREATE TABLE "RewritePage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "storagePath" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewritePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RewritePage_userId_idx" ON "RewritePage"("userId");

-- CreateIndex
CREATE INDEX "RewritePage_expiresAt_idx" ON "RewritePage"("expiresAt");

-- AddForeignKey
ALTER TABLE "RewritePage" ADD CONSTRAINT "RewritePage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
