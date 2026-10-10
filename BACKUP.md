# ApexFetch — Backup & Restore Runbook

**Purpose:** Ensure the database and configuration can be recovered before any migration or risky change.

---

## 1. Database (Supabase PostgreSQL)

### 1.1 Supabase-native backup (recommended)

Supabase free/pro tier offers automated backups + Point-in-Time Recovery (PITR) on paid tiers.

1. Supabase Dashboard → project `reoclbbidpqcvpsfhggl` → **Database → Backups**.
2. Free tier: download a manual backup via **Database → Backups → Create backup** (or use the SQL editor to export).
3. Paid tier: enable **PITR** so you can restore to any point in time.

### 1.2 Manual `pg_dump` (portable, works for any tier)

From a machine with network access to Supabase (use the **direct** connection string, `DIRECT_URL`):

```bash
# Export schema + data (run BEFORE any migration)
pg_dump "$DIRECT_URL" --no-owner --clean --if-exists > apexfetch_backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql "$DIRECT_URL" < apexfetch_backup_YYYYMMDD_HHMMSS.sql
```

> The `DIRECT_URL` uses `db.<ref>.supabase.co:5432` with user `postgres`. Do **not** use the pooler URL (`aws-*.pooler.supabase.com`) for `pg_dump`.

### 1.3 Pre-migration checklist (mandatory)

1. ✅ Confirm DB is reachable: `npx prisma db execute --stdin` won't be needed — run `node -e "..."` or `npx prisma studio` to confirm.
2. ✅ Take a `pg_dump` backup (1.2).
3. ✅ Record row counts before/after:
   ```sql
   SELECT count(*) FROM "Lead";
   SELECT count(*) FROM "User";
   ```
4. ✅ Apply migration, then re-run the counts and compare.

---

## 2. Configuration (secrets)

Secrets live in three places. Back them all up:

| Location | What | How to back up |
|---|---|---|
| `.env.local` (gitignored) | Local dev secrets incl. `DATABASE_URL`, `CRON_SECRET` | Copy the file somewhere safe (password manager) |
| Vercel env vars | `CRON_SECRET`, `PAYSTACK_*`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_APP_URL`, Clerk keys, etc. | Vercel → Settings → Environment Variables → screenshot/export |
| Supabase project | Connection strings + service role key | Supabase → Settings → Database → copy connection strings |

---

## 3. Restore procedures

### 3.1 Restore the database
1. If using PITR: Supabase → Database → Backups → restore to timestamp.
2. If using `pg_dump`: `psql "$DIRECT_URL" < backup.sql`.

### 3.2 Restore a deleted Supabase project
If the project is paused/deleted and unrecoverable, recreate it (`supabase init`), then:
1. `npx prisma db push` (schema from `prisma/schema.prisma`).
2. Re-run `supabase/migration_lead_table.sql` and `supabase/migration_add_job_fields.sql` if needed.
3. Re-enter `DATABASE_URL` / `DIRECT_URL` in `.env.local` + Vercel.

### 3.3 Roll back a code deploy (Vercel)
1. Vercel → Deployments → select the previous successful deployment → **Promote to Production**.
2. Or `git revert` the offending commit and re-deploy.

---

## 4. Git / branch hygiene

- Work happens on `audit-and-plan` (feature branch) off `main`.
- Small commits with clear messages; squash only when ready to merge.
- Before any merge to `main`, verify: `npx tsc --noEmit`, `npm test`, `npm run build`.
