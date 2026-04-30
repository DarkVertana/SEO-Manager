-- AlterTable: add the per-user sequential counter.
-- Strategy:
--   1. Add the column nullable so existing rows pass the constraint.
--   2. Backfill existing rows in createdAt order using ROW_NUMBER().
--   3. Attach a sequence, set its current value past the max backfilled
--      number, and wire it as the column DEFAULT so new inserts auto-fill.
--   4. Make the column NOT NULL + UNIQUE.

-- 1. Add column
ALTER TABLE "User" ADD COLUMN "accountNumber" INTEGER;

-- 2. Backfill in createdAt order so the earliest user is #1
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
  FROM "User"
)
UPDATE "User" u
SET "accountNumber" = ranked.rn
FROM ranked
WHERE u."id" = ranked."id";

-- 3. Create the sequence and bind it to the column
CREATE SEQUENCE "User_accountNumber_seq" OWNED BY "User"."accountNumber";
SELECT setval(
  '"User_accountNumber_seq"',
  GREATEST(1, COALESCE((SELECT MAX("accountNumber") FROM "User"), 0))
);
ALTER TABLE "User"
  ALTER COLUMN "accountNumber" SET DEFAULT nextval('"User_accountNumber_seq"');

-- 4. Constraints
ALTER TABLE "User" ALTER COLUMN "accountNumber" SET NOT NULL;
CREATE UNIQUE INDEX "User_accountNumber_key" ON "User"("accountNumber");
