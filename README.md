# Deerfield Intelligence | Director of Operations Case Study

**Katie Harrington**

The written deliverables (Operational Gap Assessment, 90-Day Operational Plan,
and Cross-Functional Coordination Model) are in the PDF titled 'Deerfield Intelligence | Director of Operations - Case Study'.

The prototype tool, a vendor review workflow supporting gap #6 and the Finance / Procurement initiatives in the 90-day plan, is documented below.

---

# Deerfield Vendor Review Desk

A cross-functional workflow for reviewing new vendor contracts, built so Ops, Finance, Compliance and IT
leads can see exactly where a contract stands, talk it through in one place, and hand a fully approved
contract to Ops for execution.

## What's in it

| Page | Path | Purpose |
| --- | --- | --- |
| Vendor dashboard | `/` | Every active vendor with use case, requesting team, portfolio company, execution and end dates, renewal and cancellation terms, original data sources, and PHI/PII confirmation. |
| Review pipeline | `/requests` | All submissions with each lead's review status at a glance. |
| New request | `/requests/new` | Submission form: use case, requesting team, portfolio company, data sources, PHI/PII confirmation, contract attachment. |
| Request detail | `/requests/:id` | The review thread for one vendor — workflow progress, per-lead status, Q&A, and Ops execution. |

## How the workflow runs

1. A requester submits a vendor with the contract attached.
2. Compliance, Finance, IT and Ops leads are all notified at the same time.
3. Each lead marks their own review **pending**, **approved** or **rejected**, and every status change
   posts a notification to the whole group (e.g. "Finance lead approved the Kensho Data vendor contract").
4. Leads and the requester ask and answer questions in the request's own thread.
5. Only once **all four leads have approved** does the contract move to the Ops lead for execution.
6. Ops records the execution and end dates, renewal and cancellation terms, and uploads the signed copy.
7. The vendor then appears on the dashboard with its full contract terms.

Notifications are in-app only for now. Slack/email delivery and DocuSign signing are planned — until then
Ops uploads the signed copy by hand.

## Stack

- TanStack Start (React 19, TypeScript) — routing, SSR and server functions
- Tailwind CSS v4 with shared design tokens in `src/styles.css`, plus shadcn/ui components
- Lovable Cloud (Supabase) — `vendor_requests`, `request_messages`, `notices`, and a private `contracts`
  storage bucket, kept in sync in the browser with realtime plus a periodic refresh
- Vitest for the workflow and routing tests

## Getting started

```sh
npm i
cp .env.example .env   # then fill in your backend values
npm run dev
```

The app expects a Supabase-compatible backend with the three tables above and a `contracts` storage
bucket. `drizzle/migrations/0000_vendor_review_cloud.sql` creates the tables, grants, row-level security
policies and realtime publication.

To load the sample vendors and their thread history, put the three CSVs from the data export next to
`restore.sql` and run it against your backend:

```sh
psql "$DATABASE_URL" -f restore.sql
```

## Useful commands

```sh
npm run dev      # local dev server
npm test         # workflow and routing tests
npm run build    # production build
```

## Before using this for real

The demo runs without a login: row-level security lets any visitor read and write, and the role switcher
in the header is a viewing preference stored on the device, not authentication. Add real authentication,
per-role permissions and a private storage bucket before putting live contracts through it.

## Repository

Built in [Lovable](https://lovable.dev) and kept in sync with this repository. Edits made in Lovable are
committed here automatically; commits pushed to the synced branch come back into Lovable.
