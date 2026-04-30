-- CreateEnum: PlanTier
CREATE TYPE "PlanTier" AS ENUM ('starter', 'pro', 'enterprise');

-- CreateEnum: SubscriptionStatus
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled');

-- AlterTable: subscription columns on User
ALTER TABLE "User"
  ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'starter',
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing user gets a 30-day starter cycle anchored to now.
UPDATE "User"
SET "currentPeriodEnd" = (NOW() + INTERVAL '30 days')
WHERE "currentPeriodEnd" IS NULL;
