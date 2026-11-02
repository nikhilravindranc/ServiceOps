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

## Payments, credit notes and voids
Each invoice has a payment ledger (`lib/ledger.ts`, saved per company as `invoiceLedger`): several payments (method, reference, date, who), credit notes (CN-00001) and a void. Balance = amount - payments - credit notes, and the status (Sent, Partially paid, Paid, Overdue, Void) is always worked out from it. A sent invoice is never edited: a Service manager or Administrator voids it with a reason (money already received stays as customer credit or is refunded by a recorded entry) and reissues a corrected one (INV-10481-R1). A deposit collected at estimate approval and a payment the technician took on site are shown as payments on the invoice. Progress-billing stages keep the amount they were invoiced with; if the job total changes, the next stage carries the difference. Outstanding, Overdue and Collected come from one helper (`invoiceSummary` in `lib/serviceData.ts`) on Home, Billing, Insights, Reports and customers. The customer pay page reads the balance from the saved ledger on the server. Settings, Payments holds the company defaults (terms, optional deposit, optional staged billing, allowed methods). A technician screen should call `raiseInvoice(job)` instead of `generateInvoice`; `generateInvoice` alone still works.

## Technician app (Stage 2.3)
Technicians land on `/tech` (phone-first). Today's visits show one next action: On my way, I've arrived, Start work, Complete job. Each job has a checklist tied to its trade (required steps and SOPs in `lib/checklists.ts`), photos, parts used, notes, a work timer, customer signature, on-site payment, a drafted invoice and a printable service report. A job can only be completed when the required steps are done and it is signed off: by the customer, by another person on site (name and role), with a note that the customer refused, or with a note that nobody was on site (only for job types that allow unattended work). The report states how it was signed off. When a visit goes wrong the technician can say "I can't finish this visit" (reason and note; the job becomes Incomplete and the office picks the next step in Dispatch, Follow-up), "Stop work, unsafe" (flags the job and alerts the office; a manager must clear it on the job page) or "Request extra work" (creates a Request with source Technician; technicians cannot create work orders or invoices). Parts taken from the van reduce that van's stock and putting them back restores it; a part that is not in the van can be requested from the warehouse. If the office reassigns or cancels a job while it is open, the technician is told and unsaved work is kept on the phone. Company rules for these (call-out fee, reasons, unattended job types, `techCanCreateWork`) are in `lib/fieldPolicy.ts`. Technicians may save changes to their own jobs only (enforced in `app/api/workspace/route.ts`).

The app is installable (manifest and service worker, production builds) and works offline: changes queue on the device (IndexedDB) and sync when the connection returns; the header shows the sync state. Location sharing is opt-in, limited to working hours, and customers only see an "On the way" card while the technician is en route (`lib/location.ts`, `/api/location`, `/api/portal/track`).

## Email and social sign-in
Without `RESEND_API_KEY`, verification links, reset links and sign-in codes are printed in the server console and shown on screen in development. Google and Microsoft sign-in need the client IDs in `.env.example`.

## Database
`prisma/schema.prisma` uses SQLite. For Postgres change the provider and `DATABASE_URL`, then run `npx prisma migrate dev`.

## Data status
Customers, work orders, jobs, assets, estimates, invoices and users are still sample data held in memory (`lib/serviceData.ts`, `lib/jobsData.ts`) and reset on reload. Requests, catalog, job costs, organizations, users, invitations and the audit log are stored in the database.

## Tests and hardening
`npm test` runs the test suite (vitest, files under `tests/`). API tests run against a scratch SQLite database created from the real migrations, with the signed-in person faked; they cover company separation, conflicting edits, technician limits, the audit trail, deactivated and re-roled people, and the record size limit. Every saved record edit is written to the audit log (`lib/auditDiff.ts`; read it at `/api/audit`, managers only). Settings has an Activity log (who changed what, with before and after values). Administrators can download a full backup there or from `/api/workspace/export`. Only managers can change payment settings or void an invoice, checked on the server as well as on screen. A person's role and active status are re-read from the database on every API call and every five minutes for page access. A real production deploy sets `DEMO_MODE=0` (no demo database, role switcher or test sign-in); see `scripts/prepare-demo.mjs`.

## Scripts
`npm run dev`, `npm run build`, `npm run db:migrate`, `npm run db:seed`, `npm run db:studio`.
