# Detail Command

A polished personal management + calendar web app built specifically for a **mobile auto detailing side business** — the kind you run on weekends while working a Monday–Friday day job.

It's not a generic calendar. Every page and feature is shaped around how detailing jobs actually flow: customer messages turning into leads, leads booking into weekend slots, vehicles with notes about pet hair and stains, sites with or without water/power, jobs you complete then follow up on for reviews and repeat business.

**All your data is private to your account, cloud-synced across devices, and protected by Row-Level Security** via Supabase. Sign in once on your phone, tablet, and desktop — every record follows you everywhere.

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

This app uses Supabase for cloud sync and auth. The free tier is plenty.

1. Create a project at <https://app.supabase.com>.
2. Open the **SQL editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**. (The script is idempotent — safe to re-run later if you bump the schema.)
3. In the project's **Settings → API**, copy:
   - the **Project URL**
   - the **anon / public** API key
4. Create a file named `.env.local` in the project root:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   See [`.env.example`](./.env.example) for the exact format.

5. (Optional) In **Auth → Providers → Email**, you can enable / disable email confirmations. With confirmations on, new sign-ups get a confirm-your-email link. With them off, sign-up logs the user in immediately. Magic-link sign-in is enabled by default and works either way.

### 3. Run

```bash
npm run dev
```

Open <http://localhost:5173>. Sign up with email + password (or magic link), and your account starts loading. The first time you sign in, the app inserts your starter business config — service menu, message templates, checklists, equipment categories, and the default M–F day-job block. **No fake customers, appointments, leads, tasks, or expenses are ever created.** It's a real clean slate.

---

## What was removed (vs. the previous version)

Every piece of hardcoded sample/demo activity is gone. Specifically removed from `src/lib/seed.ts`:

- All 5 sample customers (Marcus Reyes, Jasmine Carter, Devon Lee, Ana Torres, Ricky Patel)
- All 4 sample appointments
- All 5 sample leads
- All 10 sample tasks
- All 5 sample expenses
- All fake spent-amounts on startup items (now $0 / not purchased)
- All mock vehicle records and condition notes

What stayed (because the original spec explicitly asked for these — they're starter business config, not fake activity):

- Service menu (Exterior Detail / Interior Detail / Full Detail) and 6 add-ons
- The 7 message templates (move-off-Facebook, first response, booking close, water/power, day-before, on-my-way, review request)
- The 4 checklist groups (Pre-Job / Exterior / Interior / Post-Job) with all the items from the spec
- The 12 equipment categories (Pressure washer, Vacuum, Microfiber towels, etc.) with $0 spent and not-yet-purchased
- Default Monday–Friday 8am–5pm "day job" availability blocks

These are seeded **per user, the first time they sign in**, idempotently. You can edit or delete any of them.

---

## Storage system

| Layer | Role |
| --- | --- |
| **Supabase Postgres** | Source of truth. Every customer / appointment / lead / task / expense / setting lives here, scoped by `user_id` with Row-Level Security. |
| **In-memory React reducer** | Optimistic UI. Dispatches apply locally instantly, then mirror to Supabase. |
| **localStorage cache (per user)** | Snapshot of the last loaded data so the UI renders immediately on cold boot before the cloud fetch returns. Never the source of truth — only a read-through cache. |
| **Legacy localStorage (`detail-command:v1`)** | Pre-cloud data from older versions. If detected, **Settings** shows a banner offering to import it into your cloud account. |

`fetch` runs on every sign-in and on window focus, so cross-device changes converge automatically.

---

## How login & sync work

1. **Sign-in** (`src/auth/AuthProvider.tsx`)
   - Email + password, or magic link
   - Session is persisted by Supabase's auth client (auto-refresh tokens)
2. **Authenticated routes** (`src/auth/AuthGuard.tsx`)
   - Everything except `/login` is gated behind a guard that redirects to `/login` if no session
3. **Data load** (`src/store/store.tsx` → `seedStarterForUser` → `fetchAllForUser`)
   - On first sign-in: starter config inserted, full snapshot fetched
   - On subsequent sign-ins: full snapshot fetched
   - Stored in a React reducer + localStorage cache
4. **Writes** (`syncAction`)
   - Component dispatches an action → reducer updates state immediately → action is mirrored to Supabase
   - Errors are logged and surfaced in the console; the next focus refetch heals any drift
5. **Cross-device sync**
   - Each device fetches on auth + window focus
   - Open the dashboard on your phone, edit on desktop, switch back to phone, focus the tab → updated

### Row-Level Security

Every table has the four standard CRUD policies:

```sql
create policy "users select own X" on X for select using (auth.uid() = user_id);
create policy "users insert own X" on X for insert with check (auth.uid() = user_id);
create policy "users update own X" on X for update using (auth.uid() = user_id);
create policy "users delete own X" on X for delete using (auth.uid() = user_id);
```

A user can only ever read or write rows where `user_id = their auth UID`.

---

## Responsive design

| Breakpoint | Navigation | Quick add | Layout |
| --- | --- | --- | --- |
| Phone (< `lg`) | **Bottom nav** with 5 icons + a "More" sheet for the rest | Floating action button (FAB) for new appointment | Stacked cards, large tap targets |
| Tablet / desktop (`lg+`) | Full **left sidebar** with all 12 sections | Top-bar buttons (Task / Customer / Appointment) | Multi-column dashboard, week-view calendar, side panels |

Both layouts share the same React components — the chrome adapts via Tailwind breakpoints. The `safe-area-inset-bottom` is respected on iPhones with home-indicators, so the bottom nav never overlaps the system gesture bar.

---

## File structure (what changed)

```
.env.example                   ← NEW: Supabase env-var template
.gitignore                     ← NEW
supabase/schema.sql            ← NEW: full schema + RLS policies (idempotent)

src/
├── App.tsx                    ← UPDATED: AuthProvider + AuthGuard + DataGate
├── auth/                      ← NEW directory
│   ├── AuthProvider.tsx
│   ├── AuthGuard.tsx
│   ├── LoginPage.tsx          ← Sign in / Sign up / Magic link
│   └── UserMenu.tsx
├── lib/
│   ├── supabase.ts            ← NEW: Supabase client + isConfigured guard
│   ├── api.ts                 ← NEW: typed CRUD wrappers + bulkImport
│   ├── mappers.ts             ← NEW: camelCase ↔ snake_case row converters
│   ├── starter.ts             ← NEW: starter-only content (no demo data)
│   ├── seed.ts                ← UPDATED: now a compat shim re-exporting EMPTY_DATA
│   ├── storage.ts             ← UPDATED: cache-only, with legacy migration helpers
│   ├── types.ts
│   ├── selectors.ts
│   └── utils.ts
├── store/store.tsx            ← UPDATED: loads from Supabase, write-through sync
├── components/
│   └── layout/
│       ├── Layout.tsx         ← UPDATED: bottom-nav-aware padding
│       ├── TopBar.tsx         ← UPDATED: user menu + responsive
│       ├── BottomNav.tsx      ← NEW: mobile bottom navigation + FAB
│       └── Sidebar.tsx        (unchanged, hidden on mobile)
├── pages/
│   ├── Dashboard.tsx          ← UPDATED: empty-state messaging
│   ├── Customers.tsx          ← UPDATED: empty-state messaging
│   ├── Leads.tsx              ← UPDATED: empty-state messaging
│   ├── Tasks.tsx              ← UPDATED: empty-state messaging
│   ├── Expenses.tsx           ← UPDATED: empty-state messaging
│   ├── Revenue.tsx            ← UPDATED: empty-state messaging
│   └── Settings.tsx           ← UPDATED: cloud account block + migration tool
└── vite-env.d.ts              ← NEW: type the VITE_SUPABASE_* env vars
```

---

## Running scripts

```bash
npm run dev         # Vite dev server with HMR
npm run build       # production build → dist/
npm run preview     # preview the built app locally
npm run lint        # type-check (tsc --noEmit)
```

---

## Environment variables

| Name | Required | Where to find it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase → Settings → API → Project API keys → anon / public |

Put them in `.env.local` (gitignored). If they're missing, the app shows a friendly "Connect your Supabase project" setup screen instead of crashing.

---

## Supabase setup checklist

- [ ] Project created at app.supabase.com
- [ ] `supabase/schema.sql` pasted into SQL editor and run
- [ ] All 11 tables visible in **Table editor**: customers, appointments, leads, tasks, services, expenses, startup_items, templates, checklist_groups, blocked_times, settings
- [ ] Row-Level Security toggled on for every table (the script does this; verify in **Authentication → Policies**)
- [ ] `.env.local` populated with URL + anon key
- [ ] (Optional) Enable / configure email confirmations in **Auth → Providers → Email**
- [ ] (Optional) Customize the magic-link / confirmation email templates in **Auth → Email Templates**

---

## Migration from the previous version

If you ran an older release of this app on this device, it stored everything in `localStorage` under `detail-command:v1`. After signing in for the first time:

1. Settings → **"Local-only data found on this device"** banner appears (only if data exists)
2. Click **Import this device's data** → all customers, appointments, leads, tasks, services, expenses, etc. are upserted into your Supabase account
3. The legacy key is cleared on success
4. Subsequent loads come from cloud only

If you want to skip migrating, click **Discard** on the banner.

---

## Feature tour

### Dashboard
Real command-center home. Greeting that adapts to the time of day, four stat cards (week revenue estimate, jobs booked this week, pending follow-ups, open tasks), today's appointments, upcoming jobs, jobs that need confirmation, today's tasks, and a "weekend snapshot." On a fresh account every number is 0, every list is an empty state with a "Add your first ___" button — no fake activity.

### Calendar
Three views with drag-and-drop: Month, Week (7am–8pm), Day. Status-colored bars (inquiry → scheduled → confirmed → in-progress → completed → follow-up → canceled), block-time dialog, weekend columns gently highlighted, recurring weekday day-job overlays.

### Appointments
Every field from the original spec: customer (pick or create inline), address, vehicle (year/make/model/color + condition), interior/exterior notes, pet-hair/stains/heavy-dirt flags, **water and power access toggles**, service package + add-ons (auto-prices and auto-sets duration), final price, deposit, payment status, customer vs. internal notes, status pipeline.

### Customers (CRM)
Searchable card grid with avatars, repeat/monthly badges, lifetime revenue. Click into a profile to see full history, vehicles, last visit, and a one-click "Book job" button.

### Leads
Kanban pipeline: New → Contacted → Waiting → Booked → Lost. Source, interest level, last contact, follow-up date, and one-click copy of intro/booking templates.

### Tasks, Services, Templates, Revenue, Expenses, Startup, Checklists, Settings
Each section as in the original spec, with empty-state messaging for fresh accounts.

---

## How to expand later

1. **SMS reminders** — Twilio + a Supabase Edge Function that runs daily at 5pm and texts unconfirmed jobs the day-before template
2. **Online booking** — public route `/book/:slug` that POSTs to a Supabase function, no auth required for customers
3. **Payments** — Stripe Checkout for deposits, with a webhook updating `appointments.deposit_paid`
4. **Google Calendar sync** — bidirectional via the Calendar API; `start_at` / `end_at` are already calendar-native
5. **Customer photo uploads** — `before_photos` / `after_photos` columns are already JSONB arrays. Add Supabase Storage buckets and store URLs
6. **Invoices** — generate PDFs from completed appointment data via a serverless function
7. **Realtime cross-device sync** — swap the focus-refetch for `supabase.channel('table:*').on('postgres_changes', ...)` subscriptions
8. **Multi-user / helpers** — add a `team_members` table referencing the owner's `auth.uid()`, and an `assigned_to` column on appointments

---

## Notes

- Status colors live as `.status-*` and `.status-bar-*` utilities in `src/index.css` — change them once and they update across pills, calendar bars, and chips.
- All write actions go through a single `syncAction` switch in `src/store/store.tsx`. Adding a new entity = add an action type in the reducer + a sync case + a CRUD wrapper in `src/lib/api.ts`.
- The build emits a single ~1.1 MB JS bundle. If you want to slim it, the calendar and revenue charts (recharts + dnd-kit) are good candidates for `React.lazy` route splitting.
