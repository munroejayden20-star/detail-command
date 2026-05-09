# Detail Command — Roadmap

## Completed Phases

### Phase 1 — Core MVP
- Auth (magic link via Supabase)
- Dashboard, Calendar, Customers, Appointments
- Services, Tasks, Expenses, Leads

### Phase 2 — Operations
- Before/after photo uploads (private `photos` bucket)
- Blocked times on calendar
- Startup items / equipment budget tracker

### Phase 3 — Profile & Customization
- Settings overhaul (profile, scheduling, defaults)
- Custom checklist builder
- Startup items categories, priority, status

### Phase 4 — Photo System
- Photo gallery page with lightbox
- Photo metadata table (`photos`)
- Photo types (before, after, damage, proof, marketing, etc.)
- Tags, customer/appointment linking

### Phase 5 — Notifications & Booking Page
- Notification center (in-app)
- Notification preferences in settings
- Public booking page (`/book`)
  - Customer fills form with vehicle, services, preferred time, notes, photos
  - Creates pending appointment (`status = 'pending_approval'`)
  - Dashboard shows "Booking Requests" card
- Work/Detailer Tool mode (`/work`)

### Phase 5c — Booking Accuracy Fixes
- Fixed timezone bug (times now stored as America/Los_Angeles)
- Fixed booking photo uploads (public `booking-uploads` bucket + anon policies)
- Booking photos now appear in appointment form (read-only section)
- Photos from booking inserted into `photos` table (linked to customer + appointment)

### Phase 6A — Booking Landing Page Shell
- `/book` upgraded from a simple form to a full landing page
- Sections: sticky top nav, hero, trust bar, services showcase, how-it-works, before/after gallery (placeholders), why-us, water/power info, embedded 7-step form, FAQ, final CTA, footer
- Mobile floating "Book Now" button
- Existing form logic, RPCs, and submission flow untouched

---

### Phase 6B — Admin-Customizable Booking Page (shipped)
- [x] Settings columns for hero headline/sub, water/power text override, phone/email, featured photos JSONB.
- [x] `get_public_booking_info` returns the new fields + resolved featured photos.
- [x] Settings UI for editing them.
- [x] BookingPage reads from settings with sensible fallbacks.

### Phase 7 — Stripe Deposits (shipped)
- [x] `payments` + `stripe_events` tables, edge functions, webhook idempotency.

### Phase 8 — Admin Lockdown (shipped)
- [x] `is_admin()` allowlist + access-denied redirect.

### Phase A — Receipts (shipped)
- [x] Snapshotted receipts, public `/receipt/:token` page, atomic numbering.

### Phase B — Sales Tax (shipped)
- [x] `defaultTaxRate`, auto-calc on receipt generation, sales-tax setting.

### Phase C — Tax Center (shipped)
- [x] Period filter, set-aside %, gross/net/expenses/sales tax dashboard.

### Phase D — Mileage (shipped)
- [x] Trip log with IRS standard rate deduction in Tax Center.

### Phase E — Phone Notifications (shipped)
- [x] Web Push via VAPID + service worker, SMS scaffold, Settings panel.

### Phase F — Review Request Workflow (shipped)
- [x] `appointments.review_request_*` columns + settings.
- [x] `ReviewRequestPrompt` dialog (copy / SMS / email / mark as sent).
- [x] Dashboard "Reviews due" widget.
- [x] Receipt view "Review" button.

### Phase G — Reliability, Reviews, and Professional Output (shipped)
- [x] `src/lib/datetime.ts` — business-time formatters; refactored Calendar, Dashboard, BookingRequests, ReceiptView, AppointmentRow, AppointmentForm, Work, CommandPalette.
- [x] `commit()` server-first dispatch path; converted MarkCompleteDialog, ReceiptViewModal void, BookingRequests approve/decline.
- [x] `src/lib/receipt-pdf.ts` — jsPDF receipt download (lazy-loaded chunk).
- [x] Vitest setup + tests for `datetime`, `receipts`, `tax-center` (37 tests).
- [x] `docs/manual-test-checklist.md` for things automated tests can't reach.

---

## Planned / Future

### Near-term
- [ ] Server-side cron for review reminders honoring `reviewRequestDelayHours`.
- [ ] Upload generated receipt PDFs to Supabase Storage; populate `receipts.pdf_url`.
- [ ] Convert remaining write sites (Expenses, Mileage, Services, Settings) to `commit()`.
- [ ] Route optimization for multi-job days.
- [ ] Form UI polish (live price chip, tighter step transitions).

### Medium-term
- [ ] Customer portal (customer can view their appointment status)
- [ ] PWA work mode (offline-capable for detailers in the field)
- [ ] SMS/email reminders (via Twilio or Resend)

### Long-term / Ideas
- [ ] Multi-detailer support (role-based: owner vs. employee)
- [ ] Automated follow-up sequences
- [ ] Package bundles and memberships
- [ ] Analytics dashboard (lifetime value, retention, top services)
