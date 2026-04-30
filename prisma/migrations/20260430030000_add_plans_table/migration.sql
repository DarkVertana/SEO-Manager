-- Promote plans from app-code constants to a real, admin-editable DB resource.
-- Order matters: build Plan, seed it, point User at it, then drop the legacy
-- enum-driven column.

-- 1. Plan table
CREATE TABLE "Plan" (
  "slug"                   TEXT       NOT NULL PRIMARY KEY,
  "name"                   TEXT       NOT NULL,
  "description"            TEXT,
  "monthlyPriceCents"      INTEGER    NOT NULL DEFAULT 0,
  "currency"               TEXT       NOT NULL DEFAULT 'USD',
  "auditsPerMonth"         INTEGER    NOT NULL DEFAULT 100,
  "rewritesPerMonth"       INTEGER    NOT NULL DEFAULT 25,
  "storageBytes"           BIGINT     NOT NULL DEFAULT 1000000000,
  "sourcesPerProgrammatic" INTEGER    NOT NULL DEFAULT 20,
  "features"               TEXT[]     NOT NULL DEFAULT '{}',
  "sortOrder"              INTEGER    NOT NULL DEFAULT 0,
  "isActive"               BOOLEAN    NOT NULL DEFAULT TRUE,
  "isPublic"               BOOLEAN    NOT NULL DEFAULT TRUE,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL
);

-- 2. Seed the three baseline plans (matches the previous static catalog so
--    existing users keep the same limits).
INSERT INTO "Plan"
  ("slug", "name", "description", "monthlyPriceCents", "auditsPerMonth", "rewritesPerMonth",
   "storageBytes", "sourcesPerProgrammatic", "features", "sortOrder", "updatedAt")
VALUES
  ('starter', 'Starter', 'Free tier for individuals.', 0,
    100, 25, 1000000000, 20,
    ARRAY[
      'All 5 SEO skills',
      'AI search readiness scoring',
      'Hreflang validation',
      'Site-type-specific issue lists',
      'Indefinite capture storage',
      'Markdown + JSON-LD export'
    ],
    1, NOW()
  ),
  ('pro', 'Pro', 'For teams shipping content weekly.', 4900,
    1000, 250, 10000000000, 50,
    ARRAY[
      'Everything in Starter',
      '10× audit & rewrite quotas',
      'Priority capture queue',
      'Larger competitor research windows',
      'Export to PDF + Markdown',
      'Email support'
    ],
    2, NOW()
  ),
  ('enterprise', 'Enterprise', 'For organisations with workspace-scale needs.', 29900,
    25000, 5000, 100000000000, 100,
    ARRAY[
      'Everything in Pro',
      'Workspace-wide audit history',
      'SSO / SAML (on request)',
      'Custom Health Score weights',
      'API access to JSON reports',
      'Dedicated SLA'
    ],
    3, NOW()
  );

-- 3. Add User.planSlug, backfill from the legacy planTier enum
ALTER TABLE "User" ADD COLUMN "planSlug" TEXT;
UPDATE "User" SET "planSlug" = "planTier"::text;
ALTER TABLE "User" ALTER COLUMN "planSlug" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "planSlug" SET DEFAULT 'starter';

-- 4. FK + index
ALTER TABLE "User"
  ADD CONSTRAINT "User_planSlug_fkey"
  FOREIGN KEY ("planSlug") REFERENCES "Plan"("slug")
  ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX "User_planSlug_idx" ON "User"("planSlug");

-- 5. Drop the legacy enum-driven column
ALTER TABLE "User" DROP COLUMN "planTier";
DROP TYPE "PlanTier";
