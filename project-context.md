# Detail Command — Project Context

## What the App Is

Detail Command is a mobile auto detailing business management PWA built for Jayden's Mobile Detailing. It has two sides:

1. **Owner Dashboard** — Jayden logs in and manages his entire business: appointments, customers, leads, revenue, tasks, photos, services, and settings.
2. **Public Booking Landing Page** (`/book`) — Customers visit a public URL, see a full landing page (hero, services, how-it-works, before/after, why-us, FAQ), and submit a multi-step booking request from the same page. No login required.

Deployed on Vercel. Backend is Supabase (Postgres + Auth + Storage).

---

## User Roles

- **Owner (Jayden)** — `jaydensmobiledetailing03@gmail.com` — full access to all dashboard pages.
- **Unauthenticated customer** — accesses only `/book`. No Supabase keys exposed. All booking reads/writes go through SECURITY DEFINER RPCs callable by the `anon` role.

There is a `/work` route (Detailer Tool mode) for potential future non-admin users, but currently only the owner logs in.

---

## Core Features (shipped)

| Feature | Status |
|---|---|
| Dashboard with today's jobs, revenue stats, booking requests | ✅ |
| Calendar with appointments + blocked times | ✅ |
| Customer management + vehicle tracking | ✅ |
| Appointment form (full detail fields, before/after photos) | ✅ |
| Public booking page (`/book`) with photo upload | ✅ |
| Booking landing page (hero, services, FAQ, etc.) | ✅ Phase A |
| Booking requests shown as "Pending Approval" in dashboard | ✅ |
| Services & add-ons manager | ✅ |
| Leads tracker | ✅ |
| Tasks & recurring tasks | ✅ |
| Revenue page with charts | ✅ |
| Expenses tracker | ✅ |
| Checklists (pre-job, exterior, interior, etc.) | ✅ |
| Photo gallery (before/after, tags, lightbox) | ✅ |
| Notifications center | ✅ |
| Settings (profile, scheduling, booking page config) | ✅ |
| Price calculator | ✅ |
| Work/Detailer Tool mode | ✅ |

---

## Important Rules

1. **Supabase is the source of truth.** Never use localStorage for business data.
2. **Every user-owned table has a `user_id` column** referencing `auth.users(id)` with RLS enabled.
3. **The public booking page must not expose private keys.** All booking operations use `anon`-callable SECURITY DEFINER RPCs.
4. **Single-owner app.** RPCs resolve the owner with `SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1`.
5. **Timezone for scheduling is America/Los_Angeles.** The `submit_public_booking` RPC stores times using `timezone('America/Los_Angeles', ...)`.
6. **Booking photos go to `booking-uploads` bucket** (public), not the private `photos` bucket. `PhotoImage.tsx` handles both by checking if `storagePath` starts with `https://`.

---

## Common Commands

```bash
npm run dev        # local dev server
npm run build      # TypeScript check + Vite build
npm run lint       # TypeScript type check only (no eslint)
```

---

## Environment Variables (`.env.local`)

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Never use the service role key in the frontend.

---

## Supabase Tables

| Table | Notes |
|---|---|
| `customers` | Has `preferred_contact` column |
| `appointments` | Has `source` (default `'dashboard'`) and `booking_photo_urls` JSONB |
| `leads` | Lead tracking |
| `tasks` | Recurring tasks supported |
| `services` | Services + add-ons (`is_addon` bool) |
| `expenses` | Business expenses |
| `startup_items` | Equipment purchase tracker |
| `templates` | Message templates |
| `checklist_groups` | Custom checklists with JSONB items array |
| `blocked_times` | Calendar blocks |
| `photos` | Photo metadata; `storage_path` is either a Supabase path OR a full `https://` URL for booking uploads |
| `notifications` | In-app notification center |
| `settings` | One row per user (PK = `user_id`) |

## Supabase Storage Buckets

| Bucket | Access | Used For |
|---|---|---|
| `photos` | Private (signed URLs, per-user RLS) | Dashboard before/after photo uploads |
| `booking-uploads` | Public (anon INSERT, public SELECT) | Customer photo uploads from `/book` |

## Supabase RPCs

- `get_public_booking_info()` — returns business name, service area, services list for the booking page. Callable by `anon`.
- `submit_public_booking(...)` — creates customer, appointment (status = `pending_approval`), and photo rows. Handles timezone conversion. Callable by `anon`.

---

## Known Issues / Outstanding

1. **Phase B & C of booking landing page upgrade pending** — see [current-task.md](current-task.md) and [roadmap.md](roadmap.md). Phase A (landing-page shell) shipped; admin-customizable hero/FAQ/featured photos and form-UI polish remain.
2. Times display correctly only when the dashboard browser is in America/Los_Angeles timezone.
