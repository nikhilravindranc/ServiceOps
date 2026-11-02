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

## Roles
Five roles: Administrator, Service manager, Dispatcher, Service coordinator, Technician. Each sees only the screens it may open (`lib/access.ts`, enforced in the sidebar and in `middleware.ts`). The seed script adds one sample person per role (`lib/demo.ts`); on demo and local runs the profile menu has "Switch role (demo)" to try each one. The switcher is off in a normal production deploy unless `DEMO_MODE=1`.

## Requests, work orders and invoices
A request carries a work type (Installation, Service, Maintenance, Repair, Inspection) with its own questions, plus the trade (HVAC, Electrical, ...). Converting it creates a work order that keeps the request number; the request page shows the chain request, estimate, work order, job, invoice. An invoice is only raised or sent when nothing on it would be blank or wrong (`invoiceReadiness` in `lib/serviceData.ts`). Large jobs can be billed in stages (progress billing).

## Technician app (Stage 2.3)
Technicians land on `/tech` (phone-first). Today's visits show one next action: On my way, I've arrived, Start work, Complete job. Each job has a checklist tied to its trade (required steps and SOPs in `lib/checklists.ts`), photos, parts used, notes, a work timer, customer signature, on-site payment, a drafted invoice and a printable service report. A job can only be completed when the required steps are done and the customer has signed. Technicians may save changes to their own jobs only (enforced in `app/api/workspace/route.ts`).

The app is installable (manifest and service worker, production builds) and works offline: changes queue on the device (IndexedDB) and sync when the connection returns; the header shows the sync state. Location sharing is opt-in, limited to working hours, and customers only see an "On the way" card while the technician is en route (`lib/location.ts`, `/api/location`, `/api/portal/track`).

## Email and social sign-in
Without `RESEND_API_KEY`, verification links, reset links and sign-in codes are printed in the server console and shown on screen in development. Google and Microsoft sign-in need the client IDs in `.env.example`.

## Database
`prisma/schema.prisma` uses SQLite. For Postgres change the provider and `DATABASE_URL`, then run `npx prisma migrate dev`.

## Data status
Customers, work orders, jobs, assets, estimates, invoices and users are still sample data held in memory (`lib/serviceData.ts`, `lib/jobsData.ts`) and reset on reload. Requests, catalog, job costs, organizations, users, invitations and the audit log are stored in the database.

## Scripts
`npm run dev`, `npm run build`, `npm run db:migrate`, `npm run db:seed`, `npm run db:studio`.
