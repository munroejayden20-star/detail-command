# Detail Command — Architecture Notes

## Folder Structure

```
src/
  App.tsx                  # Router setup, AuthGuard, StoreProvider, DataGate
  main.tsx                 # React root mount
  auth/
    AuthProvider.tsx       # Supabase auth session context
    AuthGuard.tsx          # Redirects unauthenticated users to /login
    LoginPage.tsx          # Magic link login
    AuthCallback.tsx       # Handles /auth/callback and /auth/confirm
    UserMenu.tsx           # Top-bar user dropdown
  pages/
    Dashboard.tsx          # Landing page after login
    BookingPage.tsx        # PUBLIC — /book route, full landing page + 7-step form
    Calendar.tsx           # Appointment + blocked time calendar
    Customers.tsx / CustomerDetail.tsx
    Leads.tsx
    Tasks.tsx
    Services.tsx
    Revenue.tsx
    Expenses.tsx
    Checklists.tsx
    Photos.tsx
    Calculator.tsx
    Settings.tsx
    Work.tsx               # Detailer Tool mode
  components/
    appointments/          # AppointmentDialog, AppointmentForm, AppointmentRow
    calendar/              # BlockDialog
    customers/             # CustomerDialog
    photos/                # PhotoGallery, PhotoImage, PhotoLightbox, PhotoUploader
    layout/                # Layout, Sidebar, TopBar, BottomNav
    dashboard/             # BookingRequests (pending approval widget)
    notifications/         # NotificationCenter
    ui/                    # shadcn/ui component wrappers
  lib/
    types.ts               # All TypeScript interfaces (Customer, Appointment, Settings, etc.)
    supabase.ts            # Supabase client init
    mappers.ts             # DB row ↔ TypeScript object conversion
    booking-api.ts         # Public booking page API (get_public_booking_info, submit_public_booking)
    photos.ts              # getSignedPhotoUrl helper
    utils.ts               # cn() and misc helpers
  store/
    store.tsx              # Global Zustand-like store (StoreProvider + useStore)
  hooks/                   # Custom React hooks
```

---

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **React Router v6** (client-side routing)
- **Supabase JS v2** (auth + database + storage)
- **date-fns v4** (date formatting/parsing)
- **Recharts** (revenue charts)
- **Sonner** (toast notifications)
- **dnd-kit** (drag-and-drop in checklists)
- **lucide-react** (icons)

---

## Data Flow Overview

1. `AuthProvider` establishes a Supabase session on mount.
2. `AuthGuard` wraps all dashboard routes — redirects to `/login` if no session.
3. `StoreProvider` fetches all user data (customers, appointments, etc.) from Supabase on mount.
4. Pages read from the store and dispatch updates through store actions that call Supabase directly.
5. Changes are optimistic where possible — UI updates immediately, Supabase write happens in the background.
6. Supabase Realtime is enabled on all tables for cross-device sync.

---

## Auth Flow

```
/login → user enters email → Supabase sends magic link → user clicks link
→ /auth/callback → AuthCallback exchanges token → session stored → redirect to /
```

Supabase settings needed:
- **Site URL** = Vercel deployment URL (no trailing slash)
- **Redirect URLs** += `<vercel-url>/**`

---

## Booking Page Flow (`/book`)

`BookingPage.tsx` is a **single-page landing experience** with the booking form embedded as one section among many. The page is fully public (no AuthGuard).

Sections (in order, top to bottom):
1. Sticky top navigation (smooth-scroll to anchor IDs)
2. Hero (logo, headline, sub, primary/secondary CTAs)
3. Trust bar (4 quick points)
4. Services showcase (cards built from real `services` table)
5. How It Works (5 steps)
6. Before/After gallery (placeholders in Phase 6A; featured photos in Phase 6B)
7. Why Choose Us (5 reasons)
8. Water/Power info section
9. **Booking form** (existing 7-step flow, embedded — id="book")
10. FAQ (accordion)
11. Final CTA
12. Footer

Submission flow is unchanged from Phase 5c:
1. `BookingPage` calls `get_public_booking_info()` RPC (anon, no auth) on mount.
2. Customer fills the 7-step form: Service → Add-ons → Vehicle → Date/Location → Contact → Access → Review.
3. Photos uploaded to the public `booking-uploads` bucket as the form submits.
4. `submit_public_booking(...)` RPC (anon, SECURITY DEFINER) creates customer, appointment (`status='pending_approval'`, `source='Public Booking Page'`), photo metadata rows, and a `new_booking_request` notification.
5. Dashboard `BookingRequests` widget queries appointments where `status = 'pending_approval'`.

### Slug resolution
The app currently has one owner. RPCs resolve the owner via:
```sql
SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
```
The `bookingPageSlug` in settings is for future multi-user support.

---

## Photo Upload Flow

### Dashboard photos (before/after)
- `PhotoUploader` uploads to `photos` Supabase Storage bucket under `<user_id>/<photo_id>.<ext>`.
- `PhotoImage` calls `getSignedPhotoUrl(storagePath)` to get a 1-hour signed URL.
- RLS: users can only read/write files in their own `<user_id>/` folder.

### Booking page photos
- Uploaded directly to `booking-uploads` bucket (public, anon INSERT).
- Files stored as `booking-<timestamp>-<random>.<ext>`.
- Public URLs stored in `appointments.booking_photo_urls` JSONB array.
- `PhotoImage` detects `https://` prefix and uses the URL directly (skips signing).
- Photo metadata also inserted into `photos` table with `storage_path` = full public URL.

---

## Timezone Handling

- All `timestamptz` values are stored in UTC in Postgres (standard behavior).
- The `submit_public_booking` RPC converts the customer's selected date + time from **America/Los_Angeles** to UTC before storing:
  ```sql
  v_start_at := timezone('America/Los_Angeles', p_date::date + p_time::time);
  ```
- The dashboard renders times using `date-fns` `format()` which uses the browser's local timezone.
- **Known limitation:** Times display correctly only when the dashboard browser is in America/Los_Angeles timezone.

---

## Supabase / RLS Notes

- Every user-owned table has `user_id uuid references auth.users(id) on delete cascade`.
- RLS is enabled on all tables. The policy pattern is:
  ```sql
  using (auth.uid() = user_id)
  ```
- `settings` table uses `user_id` as its primary key (one row per user).
- Public RPCs use `SECURITY DEFINER` so `anon` role can execute them without bypassing RLS manually.
- Storage RLS uses `storage.foldername(name)[1]` to match the user_id path prefix.

---

## Admin vs Detailer Routing

Currently all authenticated users see the same dashboard. The `/work` route exists as a simplified Detailer Tool mode. Future role-based routing would check a `role` field from the user's settings or a separate `user_roles` table.
