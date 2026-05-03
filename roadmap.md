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

## Current Phase — 6B: Admin-Customizable Booking Page

The landing page currently uses hard-coded copy and placeholder gallery slots. Phase 6B makes those customizable from the dashboard so Jayden can edit content without redeploying.

- [ ] Add columns to `settings` table for hero headline / subheadline overrides, water/power text override, business phone/email, and a `featured_photos` JSONB array of photo IDs.
- [ ] Update `get_public_booking_info` RPC to include those fields.
- [ ] Add UI to Settings → Booking Page section for editing them, plus a featured-photos picker pulling from the `photos` table.
- [ ] BookingPage reads featured photos and falls back to placeholder slots if none are set.
- [ ] FAQ overrides (optional — array of `{q, a}` in settings).

---

## Phase 6C — Form UI Polish
- [ ] Live price chip animation
- [ ] Tighter step transitions
- [ ] Better empty/error states inside each step
- [ ] No logic changes — form fields, validation, RPC calls all unchanged

---

## Planned / Future

### Near-term
- [ ] Stripe deposit collection on booking page
- [ ] Invoice generation and PDF export
- [ ] Review request automation (send Google review link post-job)
- [ ] Route optimization for multi-job days

### Medium-term
- [ ] Customer portal (customer can view their appointment status)
- [ ] PWA work mode (offline-capable for detailers in the field)
- [ ] SMS/email reminders (via Twilio or Resend)

### Long-term / Ideas
- [ ] Multi-detailer support (role-based: owner vs. employee)
- [ ] Automated follow-up sequences
- [ ] Package bundles and memberships
- [ ] Analytics dashboard (lifetime value, retention, top services)
