-- Create Lead table for per-user scraped lead storage
CREATE TABLE "Lead" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    budget TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    "aiScore" INTEGER NOT NULL DEFAULT 0,
    "proposalDraft" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for efficient per-user queries
CREATE INDEX IF NOT EXISTS "Lead_userId_idx" ON "Lead"("userId");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);

-- Enable Row Level Security
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/insert their own leads
CREATE POLICY "Users can view their own leads"
    ON "Lead" FOR SELECT
    USING ("userId" = auth.uid());

CREATE POLICY "Users can insert their own leads"
    ON "Lead" FOR INSERT
    WITH CHECK ("userId" = auth.uid());

CREATE POLICY "Users can delete their own leads"
    ON "Lead" FOR DELETE
    USING ("userId" = auth.uid());

-- Note: If you are using Clerk instead of Supabase Auth, 
-- the RLS policies above using auth.uid() will not work directly.
-- In that case, RLS enforcement happens at the API layer via Clerk auth.
