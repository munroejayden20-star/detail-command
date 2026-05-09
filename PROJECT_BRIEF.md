# Detail Command — Project Brief

A handoff document for an outside reviewer (human or AI). Skim this and you'll have the full picture in five minutes.

---

## 1. What it is

**Detail Command** is a single-owner business-management PWA for **Jayden's Mobile Detailing**, a side business in the Vancouver, WA / Portland, OR metro. Two surfaces:

1. **Owner Dashboard** (auth-gated) — full CRM, calendar, jobs, leads, services, receipts, photos, expenses, mileage, tax center.
2. **Public booking page** at `/book` — a polished landing page with an embedded 7-step booking form. No login.

It's deployed on Vercel and uses Supabase (Postgres + Auth + Storage + Edge Functions) as its only backend.

- **Owner / contact:** Jayden Munroe — `munroe.jayden20@gmail.com`
- **Business email surfaced to customers:** `jaydensmobiledetailing03@gmail.com`
- **Repo:** `https://github.com/munroejayden20-star/detail-command`
- **Supabase project ref:** `tswwuhfgjxxbpfmxnsez`
- **Timezone for scheduling:** America/Los_Angeles (hardcoded)

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Routing | React Router v6 (client-side) |
| Backend | Supabase JS v2 (Postgres + Auth + Storage + Realtime + Edge Functions) |
| Payments | Stripe Checkout Sessions (deposits) |
| Date math | date-fns v4 |
| Charts | Recharts |
| Toasts | Sonner |
| DnD | dnd-kit |
| Icons | lucide-react |
| Push | Web Push (VAPID), Deno edge function via `npm:web-push@3.6.7` |
| SMS (scaffolded) | Twilio REST API via `fetch` from edge function |
| PDF | jsPDF — receipts generated client-side on demand |
| Tests | Vitest (`npm run test`) — pure-function tests for datetime, receipts, tax |
| Hosting | Vercel |

No backend server beyond Supabase. No queue, no cron (yet). CI is `tsc --noEmit` (`npm run lint`) + `npm run test` (Vitest pure-function tests).

---

## 3. Architecture in one breath

- `AuthProvider` → `AuthGuard` (admin allowlist) → `StoreProvider` (loads all data once) → `Layout` → routed pages.
- Store is a single Zustand-style reducer holding the entire `AppData`.
  - **Optimistic path** (`dispatch(action)`): reducer applies locally, then `syncAction` mirrors to Supabase. On failure: toast + console. Used for low-risk UI changes.
  - **Pessimistic path** (`commit(action)`): writes to Supabase first, only applies local state on confirmed success. On failure: clear "Save failed" toast + auto-refetch from server so UI matches reality. Used for money-touching writes (receipts, payments, booking approvals, voids).
- Cross-device sync via Supabase Realtime — subscribes to every core table and refetches on any change.
- localStorage is **cache only**, never the source of truth.
- All business-time displays go through `src/lib/datetime.ts` (BUSINESS_TIMEZONE = America/Los_Angeles). Never use `date-fns format()` directly for an appointment time — it would render in browser-local time and lie to non-LA users.
- Every user-owned table has `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE` with RLS `using (auth.uid() = user_id)`.
- Public booking page never sees keys for owner-only tables — it only calls anon-callable `SECURITY DEFINER` RPCs.

---

## 4. Folder layout

```
src/
  App.tsx                       # Router, AuthGuard, StoreProvider, DataGate
  main.tsx                      # Mount + service-worker registration
  auth/                         # AuthProvider, AuthGuard, LoginPage, AccessDenied, UserMenu
  pages/
    Dashboard.tsx               # Landing
    BookingPage.tsx             # PUBLIC /book — landing + 7-step form
    BookingSuccess.tsx          # Stripe deposit success
    BookingCancel.tsx           # Stripe deposit cancel
    Calendar.tsx                # Month / week / day views, drag-to-reschedule
    Customers.tsx / CustomerDetail.tsx
    Leads.tsx
    Tasks.tsx
    Services.tsx
    Revenue.tsx
    Expenses.tsx
    Receipts.tsx                # Phase A — list + view modal
    PublicReceipt.tsx           # /receipt/:token — no auth
    TaxCenter.tsx               # Phase C — period agg, set-aside
    Mileage.tsx                 # Phase D — trip log + IRS deduction
    Checklists.tsx
    Photos.tsx
    Calculator.tsx              # Quick price quotes
    Settings.tsx                # All settings + integrations
    Work.tsx                    # Detailer "work mode" (simplified)
  components/
    appointments/               # Dialog, Form, Row
    calendar/                   # BlockDialog
    customers/                  # CustomerDialog
    photos/                     # PhotoGallery, PhotoImage, Lightbox, Uploader
    layout/                     # Layout, Sidebar, TopBar, BottomNav
    notifications/              # NotificationCenter (in-app bell)
    receipts/                   # ReceiptView, ViewModal, MarkCompleteDialog
    reviews/                    # ReviewRequestPrompt, ReviewsDueWidget (Phase F)
    search/                     # CommandPalette (Cmd+K global search)
    contact/                    # ReachOutDialog (sms/email shortcuts)
    profile/                    # ProfileAvatar
    updates/                    # UpdateBanner
    migration/                  # MigrationBanner
    ui/                         # shadcn/ui wrappers
  lib/
    types.ts                    # All TS interfaces
    supabase.ts                 # Client init
    mappers.ts                  # row <-> object
    api.ts                      # CRUD helpers + bulk fetch
    booking-api.ts              # Public RPCs (anon)
    receipts.ts                 # Receipt build helpers
    receipt-pdf.ts              # jsPDF receipt generator (lazy-loaded)
    tax-center.ts               # Period + aggregate math, IRS rate
    push.ts                     # Web Push subscribe/unsubscribe
    photos.ts                   # signed URL helper
    notificationTriggers.ts     # Client-side trigger engine
    storage.ts                  # localStorage cache
    datetime.ts                 # Business-timezone formatters (Phase G)
    selectors.ts / utils.ts / starter.ts / admin.ts / checklistPresets.ts
    __tests__/                  # Vitest pure-function tests
  store/store.tsx               # The whole reducer + sync layer
  hooks/                        # useTheme, useNotificationScheduler, useUpdateChecker

supabase/
  schema.sql                    # Base schema (idempotent)
  phase_*.sql                   # Migrations, ordered by phase letter
  service_discounts.sql         # Discount columns + RPC update
  booking_fixes.sql             # Older booking RPC fixes (frozen, do not modify)
  functions/
    _shared/cors.ts
    stripe-checkout/
    stripe-webhook/
    send-notification/          # Web push + SMS dispatcher

public/
  manifest.webmanifest          # PWA install
  sw.js                         # Service worker (push + click handlers)
  logo.svg / favicon.svg
```

---

## 5. Data model

All tables have RLS enabled. Owner-scoped tables use `using (auth.uid() = user_id)` plus `is_admin()` guards on later migrations.

| Table | Purpose |
|---|---|
| `customers` | CRM. `vehicles JSONB`, `preferred_contact`, `is_repeat`, `is_monthly_maintenance`. |
| `appointments` | Jobs. Status enum. `source`, `booking_photo_urls JSONB`, deposit fields, `stripe_checkout_session_id`. |
| `leads` | Prospects with `source`, `status`, `interest`, `follow_up_date`. |
| `tasks` | Owner todos with `recurring`. |
| `services` | Service menu. `is_addon`, `discount JSONB` (label, value, type, expiry, etc). |
| `expenses` | Categorized expenses (dollars, legacy unit). |
| `startup_items` | Equipment / startup-budget tracker. |
| `templates` | Message templates (sms/email body). |
| `checklist_groups` | Custom checklists, `items JSONB[]`. |
| `blocked_times` | Calendar blocks. |
| `photos` | Photo metadata. `storage_path` is either Supabase path *or* a full `https://` URL (booking uploads). |
| `notifications` | In-app + push trigger source. Type taxonomy in `types.ts`. |
| `settings` | Single row per user (PK = `user_id`). 60+ columns. See §7. |
| `receipts` (Phase A) | Snapshotted invoices. `receipt_number` from `next_receipt_number()` RPC. `public_receipt_token` for `/receipt/:token`. |
| `receipt_number_sequences` (Phase A) | Atomic per-prefix counter. |
| `payments` (Phase 7) | Stripe payment records. |
| `stripe_events` (Phase 7) | Webhook idempotency dedupe. |
| `audit_logs` (Phase 7) | Service-role-only audit trail. |
| `mileage_entries` (Phase D) | IRS-style trip log. `is_business`, odometer, charging cost, optional `customer_id`/`appointment_id`. |
| `push_subscriptions` (Phase E) | One row per device that opted in to web push. `endpoint`, `p256dh`, `auth`, `device_label`. |
| `appointments.review_request_*` (Phase F) | 3 columns added: `review_request_sent`, `review_request_sent_at`, `review_request_method`. Tracks Google review asks. |

### Security-definer RPCs

| RPC | Caller | Purpose |
|---|---|---|
| `get_public_booking_info()` | `anon` | Returns business profile, services, deposit info, featured photos, FAQs for `/book`. |
| `submit_public_booking(...)` | `anon` | Creates customer + appointment + photo rows for a public booking. Converts time using `timezone('America/Los_Angeles', ...)`. |
| `get_public_payment_status(p_session_id)` | `anon` | Checks deposit status from BookingSuccess page. |
| `get_public_receipt_by_token(p_token)` | `anon` | Public receipt view. |
| `next_receipt_number(p_user_id, p_prefix)` | `authenticated` | Atomic receipt-number generator. |
| `is_admin()` | any | Allowlist check (Phase 8). |

### Storage buckets

| Bucket | Access | Used for |
|---|---|---|
| `photos` | private (per-user RLS folder = `<user_id>/`) | Dashboard before/after photos |
| `booking-uploads` | public (anon INSERT, public SELECT) | Customer photos from `/book` |

---

## 6. Edge functions

Deployed Deno functions in `supabase/functions/`:

| Function | Trigger | Purpose |
|---|---|---|
| `stripe-checkout` | client POST from BookingPage | Creates a Stripe Checkout Session for a deposit. |
| `stripe-webhook` | Stripe → `--no-verify-jwt` | Verifies signature, updates `payments` + `appointments` on `checkout.session.completed`, refunds, failures. Idempotent via `stripe_events.stripe_event_id`. |
| `send-notification` | Supabase Database Webhook on `notifications` INSERT | Sends Web Push (VAPID) to all `push_subscriptions` for that user. SMS branch wired but inert until Twilio secrets are set. |

---

## 7. Settings columns (full list)

The `settings` table holds 60+ columns. The Settings page is a search-driven UI over these.

**Profile / business** — `business_name`, `owner_name`, `contact_phone`, `email`, `service_area`, `service_area_radius`, `business_description`, `google_review_link`, `accent_color`, `avatar_url`, `logo_url`.

**Scheduling** — `weekend_availability`, `workday_start`, `workday_end`, `weekday_evenings`, `weekday_unavailable_start`, `weekday_unavailable_end`, `buffer_minutes`, `max_jobs_per_day`, `default_appointment_duration`.

**Pricing defaults** — `default_tax_rate`, `default_travel_fee`, `default_quote_disclaimer`, `default_confirmation_message`, `default_follow_up_days`, `default_review_request_message`.

**Booking page** — `booking_page_enabled`, `booking_page_slug`, `auto_confirm_bookings`, `booking_hero_headline`, `booking_hero_subheadline`, `booking_hero_image_url`, `booking_water_power_text`, `booking_featured_photo_ids JSONB`, `booking_phone`, `booking_email`, `booking_faqs JSONB`.

**Deposits (Phase 7)** — `booking_deposits_enabled`, `booking_deposit_amount_cents`, `booking_deposit_required`, `booking_auto_confirm_after_deposit`, `booking_deposit_refund_policy`, `booking_deposit_disclaimer`, `booking_allow_without_deposit`, `booking_deposit_applies_to_total`. Legacy: `deposit_required`, `deposit_amount`.

**Notifications** — `notifications_enabled`, `notify_appointments`, `notify_payments`, `notify_follow_ups`, `notify_reviews`, `notify_weather`, `notify_updates`, `reminder_minutes`.

**Receipts (Phase A)** — `receipt_footer_message`, `auto_generate_receipt_on_complete`, `default_payment_method`.

**Sales tax (Phase B)** — `sales_tax_enabled`, `sales_tax_disclaimer`. Rate uses `default_tax_rate`.

**Tax Center (Phase C)** — `tax_set_aside_percent` (default 25), `tax_business_state`.

**Phone notifications (Phase E)** — `push_notifications_enabled`, `sms_enabled`, `sms_phone_number`.

**Review requests (Phase F)** — `review_request_enabled`, `review_request_delay_hours`. Existing fields reused: `googleReviewLink`, `defaultReviewRequestMessage`.

**Misc / legacy** — `theme`, `startup_goal`.

---

## 8. Routes

```
/                        Dashboard            (authed)
/calendar                Calendar             (authed)  ?appt=:id auto-opens dialog
/customers               Customers list       (authed)  ?q=… pre-fills search
/customers/:id           Customer detail      (authed)
/leads                   Leads kanban         (authed)  ?id=:id opens edit
/tasks                   Tasks                (authed)
/services                Services             (authed)  ?id=:id opens edit
/calculator              Quote calculator     (authed)
/photos                  Photo gallery        (authed)
/checklists              Checklists           (authed)
/revenue                 Business stats       (authed)
/receipts                Receipts list        (authed)  ?id=:id opens view modal
/tax-center              Tax dashboard        (authed)
/mileage                 Mileage trip log     (authed)  ?id=:id opens edit
/expenses                Expenses             (authed)
/work                    Detailer work mode   (authed)
/settings                Settings             (authed)

/login                   Login                (public)
/auth/callback           Magic link callback  (public)
/auth/confirm            Email confirm        (public)
/access-denied           Allowlist denial     (public)

/book                    Public booking       (public)
/booking/success         Stripe deposit OK    (public)
/booking/cancel          Stripe deposit X     (public)
/receipt/:token          Public receipt       (public)
```

Global features:

- **Cmd/Ctrl+K** anywhere → command palette searching customers, jobs, leads, tasks, services, receipts, mileage, and pages. `/` also opens it when not typing.
- **Refresh button** in TopBar → re-pulls everything from Supabase.

---

## 9. Public booking flow (most complex flow)

1. `/book` calls `get_public_booking_info()` (anon) on mount.
2. Customer fills 7 steps: Service → Add-ons → Vehicle → Date/Location → Contact → Access → Review.
3. Photos upload directly to `booking-uploads` bucket (public, anon INSERT).
4. If deposits are enabled, the form calls `stripe-checkout` edge function and redirects to Stripe.
5. Stripe webhook fires on payment → updates `appointments` + creates `payments` row + creates a `notifications` row.
6. If deposits are off, `submit_public_booking(...)` RPC creates customer + appointment (`status='pending_approval'`, `source='Public Booking Page'`) + photo metadata + a `new_booking_request` notification.
7. Owner sees the request on Dashboard's "Booking Requests" widget. Web Push fires automatically (Phase E, once configured).

Single-owner resolution inside RPCs:
```sql
SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
```

---

## 10. Phone notifications (Phase E) — current setup state

Architecture is **Database Webhook → edge function → Web Push (+ SMS scaffold)**.

- `push_subscriptions` table holds devices.
- `send-notification` edge function reads the new notification row, looks up subs, sends VAPID-encrypted pushes via `npm:web-push@3.6.7`. Suppresses 404/410 endpoints automatically.
- Settings UI lets the owner toggle web push (handles permission + subscribe + persist) and enter an SMS phone number for later.
- iOS push only works after Add-to-Home-Screen — the UI shows a hint banner when it detects iOS-Safari without standalone mode.

**Manual setup steps** (in `supabase/phase_e_push_notifications.sql` header):

1. Run the migration.
2. Generate VAPID keys (`npx web-push generate-vapid-keys`).
3. Set function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
4. Add `VITE_VAPID_PUBLIC_KEY` to `.env.local` and Vercel.
5. `supabase functions deploy send-notification`.
6. Create a Database Webhook on the `notifications` table (INSERT) → POSTs to the function with the `Authorization: Bearer <anon>` header.

To turn on SMS later: add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` as function secrets, redeploy. Toggle in Settings.

---

## 11. Outstanding / known issues

- **`phase_d_mileage.sql`, `phase_e_push_notifications.sql`, and `phase_f_review_requests.sql` migrations** must be run in Supabase SQL Editor for those features to persist. Reads degrade gracefully (table/column missing → empty list/false); writes will toast "Sync failed" if the schema is missing.
- **iOS PWA web push** requires the user to install via Safari → Add to Home Screen. Documented in the Settings UI banner, but easy to miss.
- **No server-side cron yet** for time-based notifications — `useNotificationScheduler` runs only while the app is open. Job-reminder notifications won't fire if the app is closed. (`notificationTriggers.ts` line 9–10 documents this.)
- ~~Dashboard times only render correctly when the browser is in America/Los_Angeles~~ — **fixed in Phase G.** All business-time displays now route through `src/lib/datetime.ts` and render in `America/Los_Angeles` regardless of browser timezone. The DST-transition edge case in `combineLocalDateTimeInBusinessTimezone` is covered by Vitest tests.
- **bulkImport** in `api.ts` does not include `receipts`, `photos`, `notifications`, `mileageEntries` — it's only used for legacy localStorage migration so this is intentional, but worth noting.
- **Vitest covers pure-function logic only** — `npm run test` runs ~37 tests across `datetime`, `receipts`, and `tax-center`. UI/feature correctness is verified by hand using `docs/manual-test-checklist.md`.
- **Revenue chunk is 428KB** post-build (pulls in all of Recharts). Build warns. Acceptable for now since it's a single-user app.
- **Two sync-error patterns** depending on action criticality:
  - Optimistic (`dispatch`) → "Sync failed — change may not appear on other devices". Local change stays; refetches on next focus.
  - Pessimistic (`commit`) → "Save failed. Your change was not saved." Local change is rolled back via auto-refetch. Used for receipts, voids, booking approve/decline.

---

## 12. Roadmap (from `roadmap.md`)

**Shipped phases:** 1–5c (core MVP through booking accuracy fixes), 6A (booking landing page shell), 6B (admin-customizable booking page), 7 (Stripe deposits), A (receipts), B (sales tax), C (tax center), 8 (admin lockdown / allowlist), D (mileage), E (web push + SMS scaffold), **F (review request workflow)**, **G (Reliability, Reviews, and Professional Output: timezone correctness everywhere, hardened critical writes, PDF receipts, Vitest)**. Plus: service discounts, command palette, expandable booking descriptions, manual refresh button.

**Planned (near-term):**
- Invoice generation + PDF export
- Review request automation (post-job Google review link)
- Route optimization for multi-job days

**Planned (medium-term):**
- Customer portal
- Offline work mode (PWA already in place — just need offline data fallback)
- SMS / email reminders (SMS infra is scaffolded; needs Twilio creds + scheduling)
- Server-side cron for review-request reminders honoring `reviewRequestDelayHours`
- Upload generated receipt PDFs to Supabase Storage (`receipts/{user_id}/{receipt_id}.pdf`) so they can be linked from SMS/email instead of regenerated each open

**Long-term ideas:** multi-detailer / role-based, automated follow-up sequences, packages and memberships, lifetime-value analytics.

---

## 13. Recent commit history (most recent first)

```
15e82f8 feat(topbar): manual refresh button
0ac8dfc feat(notifications): web push to phone + SMS scaffold
53b4d98 feat(search): global command palette across all entities
30357ca feat(mileage): IRS-style trip tracker + Tax Center deduction
7657a75 feat(booking): expandable service + add-on descriptions
1b86c97 feat(tax-center): tax dashboard with period filters + set-aside
d5abea2 feat(receipts): sales tax + receipt settings UI
db16c51 feat(receipts): digital receipt system on job completion
4b565eb feat(auth): lock management app to admin allowlist
ed9ddc5 feat(booking): live countdown timers on active discounts
03d7701 fix(booking): scroll to form card top on step change
923b4c2 fix(sql): only block slots for confirmed/scheduled/in_progress appointments
e57a082 feat: service discounts — editable promos on booking page
```

---

## 14. How to run locally

```bash
npm install
# Set .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
npm run dev          # vite, port 5173
npm run lint         # tsc --noEmit (this is the type check)
npm run test         # vitest run — pure-function tests
npm run test:watch   # vitest in watch mode
npm run build        # tsc -b && vite build
npm run preview      # preview production build (use this to test the service worker — SW is disabled in dev)
```

Manual test checklist for the things automated tests can't reach:
[`docs/manual-test-checklist.md`](docs/manual-test-checklist.md)

Edge functions:

```bash
npx supabase functions deploy send-notification --project-ref tswwuhfgjxxbpfmxnsez
npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:…
```

Database migrations: paste each `supabase/phase_*.sql` into the Supabase SQL editor in order. They are idempotent.

---

*Last updated: 2026-05-09.*
