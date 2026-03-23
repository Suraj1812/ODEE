# ODEE Multi-Tenant Isolation Demo

This repo is a complete no-`.env` demo app for the ODEE screening assignment:

- `Express` backend with a seeded multi-tenant demo API
- polished `frontend` served from the same Node process
- committed `Supabase/PostgreSQL` migration SQL with `tenant_id` + `RLS`
- `node:test` smoke tests for tenant isolation

## Why no `.env`

The app runs without any local secrets or `.env` file.

- Local dev uses seeded in-memory demo data
- Railway only needs its auto-provided `PORT`
- The real Supabase implementation is documented in [`supabase/migrations/20260323_multi_tenant_isolation.sql`](/Users/surajsingh/Documents/New project 2/supabase/migrations/20260323_multi_tenant_isolation.sql)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production start

```bash
npm install
npm start
```

## Test

```bash
npm test
```

## Railway

Railway can deploy this repository directly:

1. Connect the GitHub repo
2. Railway will detect Node automatically
3. Build command: `npm install`
4. Start command: `npm start`

No `.env` file is required.
