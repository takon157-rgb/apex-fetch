-- Run this in Supabase SQL Editor to create the leads table
-- This is equivalent to what `npx prisma db push` does

-- Create Lead table for per-user scraped lead storage
CREATE TABLE IF NOT EXISTS "Lead" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, -- Changed from UUID to TEXT to match your User table
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    budget TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    "aiScore" INTEGER NOT NULL DEFAULT 0,
    "proposalDraft" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Lead_userId_idx" ON "Lead"("userId");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);

-- Enable Row Level Security
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;

-- RLS policies (with text casting adjustment for matching data types)
-- Users can only see their own leads
DROP POLICY IF EXISTS "Users can view their own leads" ON "Lead";
CREATE POLICY "Users can view their own leads" ON "Lead"
    FOR SELECT USING ("userId" = auth.uid()::text);

-- Users can insert their own leads
DROP POLICY IF EXISTS "Users can insert their own leads" ON "Lead";
CREATE POLICY "Users can insert their own leads" ON "Lead"
    FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

-- Users can delete their own leads
DROP POLICY IF EXISTS "Users can delete their own leads" ON "Lead";
CREATE POLICY "Users can delete their own leads" ON "Lead"
    FOR DELETE USING ("userId" = auth.uid()::text);