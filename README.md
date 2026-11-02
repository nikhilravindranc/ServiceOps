# ServiceOps

Field service management: requests, estimates, scheduling, dispatch, jobs, billing.

Next.js 15, React 19, MUI, Tailwind, Prisma (SQLite for local use), Auth.js.

## Run locally

```bash
npm install
cp .env.example .env        # then fill AUTH_SECRET and SEED_ADMIN_PASSWORD
npx prisma migrate dev      # creates the local database
npm run db:seed             # demo organization, administrator, catalog, sample requests
npm run dev                 # http://localhost:3100
```

Sign in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`.

## Deploying to Vercel (demo)
Push to git; no dashboard settings are needed. `npm run vercel-build` (`scripts/prepare-demo.mjs`) builds a seeded SQLite database and a per-deployment auth secret. At runtime the database is copied to `/tmp`, so data resets when the server restarts. Default demo login: `demo@serviceops.dev` / `ServiceOps-Demo-2026`. Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` or `AUTH_SECRET` in Vercel to override. Replace SQLite with Postgres before real use.

## Email and social sign-in
Without `RESEND_API_KEY`, verification links, reset links and sign-in codes are printed in the server console and shown on screen in development. Google and Microsoft sign-in need the client IDs in `.env.example`.

## Database
`prisma/schema.prisma` uses SQLite. For Postgres change the provider and `DATABASE_URL`, then run `npx prisma migrate dev`.

## Data status
Customers, work orders, jobs, assets, estimates, invoices and users are still sample data held in memory (`lib/serviceData.ts`, `lib/jobsData.ts`) and reset on reload. Requests, catalog, job costs, organizations, users, invitations and the audit log are stored in the database.

## Scripts
`npm run dev`, `npm run build`, `npm run db:migrate`, `npm run db:seed`, `npm run db:studio`.
