# Detail Command — Current Task

## What We Are Working On

**Phase 6B — Admin-customizable booking landing page.**

Phase 6A shipped a full landing-page experience at `/book` (hero, services, how-it-works, before/after gallery, why-us, water/power info, embedded 7-step form, FAQ, final CTA, footer). The copy and gallery are currently hard-coded. Phase 6B exposes those fields in Settings so Jayden can edit them without a redeploy.

---

## Files to Change

1. **`src/lib/types.ts` — extend `Settings` interface**
   - `bookingHeroHeadline?: string`
   - `bookingHeroSubheadline?: string`
   - `bookingWaterPowerText?: string`
   - `bookingFeaturedPhotoIds?: string[]`
   - `bookingPhone?: string`
   - `bookingEmail?: string`
   - `bookingFaqs?: Array<{ q: string; a: string }>` (optional override)

2. **`src/lib/mappers.ts`**
   - Map all of the above in `settingsFromRow`, `settingsToRow`, `settingsPatchToRow`.

3. **`src/lib/booking-api.ts`**
   - Extend `PublicBookingInfo.settings` with the new fields plus a resolved `featuredPhotos: { url: string }[]`.

4. **`supabase` SQL — write a `phase_6b_booking_settings.sql` migration**
   - `ALTER TABLE settings ADD COLUMN IF NOT EXISTS booking_hero_headline TEXT;` (and the rest)
   - Update `get_public_booking_info()` RPC to return the new fields. Resolve `featured_photos` IDs into their public URLs from the `photos` table.

5. **`src/pages/Settings.tsx` — Booking Page section**
   - Add inputs for hero headline, subheadline, water/power text, phone, email
   - Add a featured-photos picker (multi-select from `photos`, drag-to-reorder if simple)
   - Add a FAQ editor (array of {q, a} rows; optional override)

6. **`src/pages/BookingPage.tsx`**
   - Read all of the above from `info.settings` with sensible fallbacks (current hard-coded copy stays as the default).
   - Replace the four placeholder slots in `BeforeAfterGallery` with `featuredPhotos` if any are set.
   - Use `bookingPhone` / `bookingEmail` in the footer.

---

## Acceptance Tests

- [ ] Go to Settings → Booking Page section, see fields for Hero Headline, Hero Subheadline, Water/Power Text, Phone, Email, Featured Photos picker, FAQ editor
- [ ] Save a custom hero headline — it appears at `/book` after page reload
- [ ] Pick 4 photos as featured — they replace the placeholder gallery slots
- [ ] Phone/email appear in `/book` footer when set
- [ ] If no overrides are set, the page renders with current Phase 6A defaults (no regressions)
- [ ] FAQ editor: can add, edit, delete, reorder; saved values render at `/book`
- [ ] Booking submission flow still works end-to-end (create customer, appointment, photos, notification)

---

## Do-Not-Break Rules

- Do NOT change the `submit_public_booking` RPC behavior or signature.
- Do NOT change the existing form logic in `BookingPage.tsx` (steps 1–7, validation, payload, photo upload).
- Do NOT remove the placeholder fallback in `BeforeAfterGallery` — it must render if no featured photos are picked.
- Do NOT expose any private Supabase keys on the booking page.
- Do NOT touch `booking_fixes.sql` — that file's already-applied migration must stay as a historical record.
