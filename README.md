# Turnpoint — cleaning operations for short-term rentals

Turnpoint is a full-stack web app that runs cleaning and turnover operations for short-term-rental managers: scheduling, crews, checklists, inventory, owner reporting, and cleaner payouts in one place. It's built to replace the patchwork of spreadsheets, group texts, and single-purpose tools that most STR cleaning operations run on.

---

## About this repo

This is a **public showcase** of Turnpoint. The production app runs on a live Supabase backend with real properties, crews, owners, and payment data. **None of that is in this repo.** I replaced the operational dataset with a fully fictional demo cast (`src/data/mockData.ts`), removed the backend keys and connection details, and kept the engineering: the UI, the app logic, the API layer, the edge functions, and the tests.

So this builds and runs against demo data without touching any real backend.

I built this with no CS degree (pretty much Claude'd it all).

---

## What it does

- **Scheduling** — a weekly board of cleaning/turnover projects across every property, with status tracking (scheduled, in progress, completed) and unscheduled-job follow-up
- **Crews & marketplace** — manage cleaners and inspectors, ratings, primary-property assignments, and a marketplace to connect new crew
- **Checklists** — build turnover checklists, attach them to properties, and have technicians complete them job-by-job (with photo verification)
- **Inventory** — per-property stock levels with reorder thresholds and one-tap reordering
- **Owner reporting** — owner-facing reports on work completed per property
- **Payments & payouts** — cleaner payouts, payment methods, and autopayment rules (pay on completion or weekly, with caps)
- **Problem tickets** — report issues from a turnover with photos and repair quotes
- **PMS/OTA integrations** — connect Hostaway, Guesty, OwnerRez, Airbnb, Vrbo, Booking.com per property
- **AI assists** — edge functions that parse uploaded checklist PDFs and assess cleaning photos (Google Gemini)

## Stack

- **React + TypeScript + Vite**
- **Tailwind + shadcn/ui** (Radix primitives) for the UI
- **TanStack Query** for server state, with offline persistence
- **Supabase** (Postgres + Auth + Edge Functions) as the backend
- **PWA** — installable, offline-capable (Workbox / vite-plugin-pwa)
- **Zod** for validation, **Vitest** for tests

## Run it

```bash
npm install
cp .env.example .env   # fill in your own Supabase project values
npm run dev            # http://localhost:5173
npm test               # run the test suite
```

The app ships with fictional demo data, so it runs out of the box. Connecting a real Supabase backend is optional.

## Project layout

| Path | What's there |
|---|---|
| `src/pages/` | The app screens — Dashboard, Schedule, Properties, MyTeam, Inventory, Checklists, Payments, Reports, technician + cleaner views |
| `src/components/` | UI components, layout, property/inventory/payment modules |
| `src/lib/` | API layer, business logic, and tests |
| `src/data/mockData.ts` | Fictional demo dataset |
| `supabase/` | Migrations and edge functions (checklist parsing, photo assessment) |

---

Built by Jeremiah Lwin. The production app runs cleaning ops for StayAscend / Ascend Vacation Rentals.
