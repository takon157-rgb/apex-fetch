# Encoding / UI mojibake

Dashboard text such as `≡ƒÅó` or `ΓÇª` is mojibake: UTF-8 characters were saved after decoding with the wrong character set. The root layout includes `EncodingRepair` as a compatibility fallback for already deployed UI text. New source should use UTF-8 and must not add those damaged strings.

The production build runs `scripts/check-encoding.mjs` before Prisma generation/Next compilation. It scans app source and fails with the file/line if a known mojibake marker or Unicode replacement character is committed. A unit test also guards `app/components/Dashboard.tsx`.

To check code and the live database from a developer machine (with valid `.env.local` credentials):

```bash
npm test
npx tsc --noEmit
npm run build
npm run db:health
```

`db:health` is read-only. It checks a representative schema field, table counts, running scrape sessions, PostgreSQL connection count, and database size. It cannot verify the production Vercel environment unless run with credentials for the same Supabase project.
