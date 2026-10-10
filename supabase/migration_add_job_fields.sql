-- ApexFetch — Additive migration: add job-search fields to "Lead"
-- Run this in Supabase SQL Editor (or use `npx prisma db push` once the DB is unpaused).
-- All columns are nullable/defaulted, so this is NON-DESTRUCTIVE and idempotent.

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "company" TEXT,
  ADD COLUMN IF NOT EXISTS "salaryMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "salaryMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "salaryCurrency" TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "jobType" TEXT,
  ADD COLUMN IF NOT EXISTS "remote" BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "matchReason" TEXT;

-- Backfill: infer postedAt from createdAt for existing rows so sorting/filters work immediately
UPDATE "Lead" SET "postedAt" = "createdAt" WHERE "postedAt" IS NULL;

-- Indexes for the new sort/filter paths
CREATE INDEX IF NOT EXISTS "Lead_userId_postedAt_idx" ON "Lead"("userId", "postedAt" DESC);
CREATE INDEX IF NOT EXISTS "Lead_url_idx" ON "Lead"("url");
