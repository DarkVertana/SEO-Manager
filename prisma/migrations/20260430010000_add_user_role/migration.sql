-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- AlterTable: add role with a safe default; existing rows become 'user'
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user';
