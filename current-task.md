# Detail Command — Current Task

## What We Just Shipped

**Phase G — Reliability, Reviews, and Professional Output.** Combined Phase F (review request workflow) and Phase G (timezone correctness, hardened critical writes, PDF receipts, Vitest setup). The app is now safer to trust with real customer bookings, real money, and real tax records.

Highlights:
- Business-time everywhere via `src/lib/datetime.ts` — no more "browser must be in PT" caveat.
- Critical writes use `commit()` server-first instead of optimistic dispatch — receipts, voids, booking approve/decline.
- Google review requests track sent state per appointment with prompt + dashboard widget.
- Receipts download as professional PDFs (jsPDF) with full branding.
- Vitest covers pure-function logic; `docs/manual-test-checklist.md` covers the rest.

---

## What's Next

The app is at "ship to real customers" reliability. Sensible next focuses:

### Near-term polish

- Server-side cron for review reminders honoring `reviewRequestDelayHours` (would need Supabase pg_cron + a scheduled edge function).
- Upload generated receipt PDFs to Supabase Storage (`receipts/{user_id}/{receipt_id}.pdf`) and store on `receipts.pdf_url` so SMS/email links don't regenerate every open.
- Convert remaining write sites (Expenses, Mileage, Services price changes, Settings deposit/tax fields) to `commit()` — currently only the most money-critical ones use it.
- Receipt PDF storage so old receipts can be retrieved without recomputing.
- Convert `dispatch` → `commit` in `AppointmentForm` save path (currently optimistic — fine for status changes, less fine for price changes).

### Medium-term

- Customer portal (let customers view their appointment status with a public link).
- True PWA offline mode — write-through queue for when offline.
- SMS reminders via the already-scaffolded Twilio integration.
- Push the review request from the server when a job hits "completed", not just from the UI.

### Long-term ideas

- Multi-detailer / role-based dashboards.
- Lifetime value / retention analytics.
- Memberships and recurring jobs.

---

## Migrations Outstanding

Run these in Supabase SQL editor in order if not already applied:

1. `supabase/phase_d_mileage.sql` — Mileage tracker.
2. `supabase/phase_e_push_notifications.sql` — Push subscriptions + SMS settings.
3. `supabase/phase_f_review_requests.sql` — Review request tracking.

All three are idempotent and preserve existing data.

---

## Do-Not-Break Rules (still active)

- `/book` public booking flow.
- `submit_public_booking` RPC signature.
- Stripe deposit checkout and webhook.
- Admin allowlist lockdown.
- Existing receipts, customers, appointments, expenses, mileage, services, photos.
- Public receipt page (`/receipt/:token`) and its token format.
