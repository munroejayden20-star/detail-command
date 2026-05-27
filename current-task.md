# Detail Command — Current Task

## What We Just Shipped (Phases J → M, booking-page focus)

Multi-session work that transformed `/book` from a styled form into a luxury
reservation system, added optional customer accounts, fixed a long-standing
scroll bug, and laid down a design-token foundation for future refactors.

### Phase J — UI/UX architecture pass (commit `bdedc13`)
- **Customer-history overlap fixed.** `CustomerPortalRibbon` (new, slim, fixed-top, `z-60`) replaces the old sticky `CustomerPortalPanel`. TopNav accepts `topOffset` and drops below the ribbon when present.
- **TopNav restructured** into a clean three-zone layout (brand · center-nav · CTA) with `shrink-0` right zone so Configure and the mobile menu can never compete for the same x-coordinate.
- **Footer mobile fix** — single-column stack below `sm`; `min-w-0` + `break-all` so long emails/addresses wrap inside their column.
- **New `/portal` route** — dedicated cinematic customer dashboard. Reuses `AppointmentRow` / `ReceiptRow` / `IrisNote` from the panel; "Book new appointment" CTAs route back to `/book#book`. Hero orb + 4-card stat strip + upcoming/past panels + receipts grid + vehicles + saved info + loyalty/referral/support promo cards.
- **Pricing engine** — `VEHICLE_SIZES` reordered with sedan as baseline; hints reworded so compact reads as a small-car discount.

### Phase K — Cinematic polish + LuxuryScheduler (commit `e333b7f`)
- **3 new atmospheric primitives** in `primitives.tsx`: `FloatingParticles` (drifting dust motes, CSS keyframes), `VolumetricFog` (CSS-driven fog blobs), `CinematicVignette` (corner darkening).
- **`HeroContentParallax`** — scroll-linked y-lift + opacity fade on hero text.
- **GlassCTA refined** — Apple-style chromatic dispersion ring on hover (`mix-blend: screen`), `backdrop-saturate(1.4)`, true pressed-state inset shadow.
- **EmberCTA** — active-state inset shadow + warmer hover border.
- **Smoother hero → manifesto bleed** (h-56, 4-stop gradient).
- **New `LuxuryScheduler`** (`src/components/booking/luxury/scheduler.tsx`) replaces the native `<input type="date">` + plain time grid in Step 4. Glass-framed month calendar with animated month transitions, staggered cell reveal, ember-glow selected states, booking-density dots, today ring, premium time-slot cards. ~520 LOC.
- **Slot logic changes** (synced in both `lib/booking-slots.ts` and the duplicate in `form-steps.tsx`):
  - Weekday slots narrowed to **5:30 PM and 6:00 PM** only.
  - **Same-day bookings blocked** — earliest selectable date is tomorrow.
  - Initial calendar month auto-advances if today is end-of-month.
- New Tailwind keyframes: `lx-mote-float` / `-rev`, `lx-fog-drift`.

### Phase L — Optional customer accounts (commits `a85f671`, `f27ac3c`, `314d8ba`)
- **New `BookingSuccessAccount` component** — cinematic post-submit screen. Optional save-my-account choice with inline email + password (8-char min, show/hide toggle, confirmation-required state).
- **`AuthProvider.signUp` re-enabled** — was hard-coded reject. Customer auth has no admin access; `is_admin()` allowlist is the real security boundary. Returns `needsConfirmation` so UI can branch.
- **`/portal` auth-session gated.** Cinematic sign-in form (email + password + magic-link fallback) when no session. Falls back to session-based fetch if no token in localStorage.
- **`/booking/success` (Stripe deposit return)** also renders the new account screen on `isPaid`.
- **"User already registered" handler** — `BookingSuccessAccount` auto-slides into a sign-in form variant with email locked + password autoFocus.
- **Ribbon gate simplified** to `!!user && !!portal` — anyone signed in with portal data sees the ribbon; admin signs out from `/portal` to hide it. (Previous attempts using email-match and localStorage flags broke whenever localStorage was cleared during testing.)
- **Skip signup when already signed in** — admin testing or returning signed-in customer bypasses the account screen entirely.
- **New SQL migration `supabase/phase_n_customer_accounts.sql`** — adds `get_customer_portal_by_session()` so a signed-in customer can fetch portal data via JWT email match. Delegates to the existing by-token RPC and re-emits the token so cancel/reschedule keep working.
- **PWA manifest** `start_url` changed from `/quick` to `/` so installed app opens the admin dashboard. `/quick` moved to shortcuts.
- **Telemetry slider fixed** — `src/index.css`: `overflow-x: hidden` → `overflow-x: clip` on `html, body, #root`. `hidden` was implicitly turning the y-axis into a scroll context, moving the scroll container off `window` and silently breaking every `framer-motion` `useScroll()` (Telemetry tick, ScrollProgress bar, ScrollAmbient parallax). `clip` clips horizontal overflow without creating a scroll context.

### Phase M — Design system Phase 1 (commit `98f570c`)
New `src/design-system/` module with three token files. No behavior change — pure refactor.
- **`z-index.ts`** — `Z` + `Z_CLASS` exporting 15 named stacking layers (`underlay` → `boot`). Mirrored Tailwind class strings so the JIT still purges. Every fixed/absolute `z-N` in the booking subtree now references it.
- **`motion.ts`** — `EASING` (5 named curves: `settle`, `swift`, `pulse`, `sheen`, `ambient`), `DURATION` (11 levels: `instant` → `scanline`), `TRANSITIONS` presets, `stagger(i, opts)` helper. Adopted in `scheduler.tsx`; legacy inlines in `sections.tsx` / `primitives.tsx` can migrate opportunistically.
- **`surfaces.ts`** — `SURFACES` (glass class strings), `GRADIENTS` + `SHADOWS` (CSS strings for the most-reused atmospheric / selected / ember-CTA backgrounds).
- **`index.ts`** barrel + **`README.md`** with migration policy.

---

## ⚠️ Manual steps still required for the new flows

1. **Supabase Auth — Email signups enabled.** Dashboard → Authentication → Providers → Email → expand → **Enable Sign Up** = ON. (Jayden has done this.)
2. **Supabase Auth — Email confirmation disabled.** Same panel → **Confirm email** = OFF. Otherwise customers get stuck on "Check your inbox" + Supabase's built-in email is rate-limited on the free tier. (Jayden has done this.)
3. **Run `supabase/phase_n_customer_accounts.sql`** in Supabase SQL editor. Without it, cross-device sign-in shows "Almost there" gate instead of the dashboard. Same-device signup-after-booking works without it. **Status: ✅ done — customer accounts confirmed working end-to-end.**
4. **PWA reinstall** if the desktop app still opens `/quick` or `/book` — browsers cache the old manifest, so uninstall + reinstall is required for `start_url: "/"` to take effect.

---

## Architecture conventions established this session

- **Z-index** — every new fixed/absolute/sticky surface should reference `Z_CLASS.*` from `@/design-system`. Add new named layers to `z-index.ts` rather than introducing inline values.
- **Motion** — new framer-motion `transition` props should use `EASING.*` + `DURATION.*` (or a `TRANSITIONS.*` preset). The literal `[0.16, 1, 0.3, 1]` lives behind `EASING.settle`.
- **`overflow-x: clip`** — never use `overflow-x: hidden` on root/body/#root. It silently moves the scroll container off `window` and breaks every `useScroll()` on the page.
- **Slot duplication** — `timeSlotsForDate` / `availabilityHintForDate` exists in BOTH `lib/booking-slots.ts` (canonical) and `form-steps.tsx` (duplicate). Keep them in sync when editing slot hours.

---

## Suggested next phases (any can be the next session's PR)

- **Phase 2 — Split god-files.** `form-steps.tsx` (1880 LOC), `sections.tsx` (1799 LOC), `primitives.tsx` (1167 LOC) — break into per-step / per-section / per-primitive-family files. Mechanical, high readability win, ~30 file moves.
- **Phase 3 — `<Section>` primitive.** Every section in `sections.tsx` repeats the same `bg-obsidian-950/X`, `py-28 md:py-40`, `scroll-mt-24`, atmosphere stack. One primitive replaces ~400 LOC of duplication.
- **Phase 4 — Performance audit.** Lighthouse + React Profiler against `/book`, identify real bottlenecks (not guesses), fix top 3–5 measured issues.
- **Continue motion adoption** — opportunistically replace remaining inline `[0.16, 1, 0.3, 1]` etc. in `sections.tsx` / `primitives.tsx` with `EASING.settle` + `DURATION.*`.

---

## Earlier — Phase H4 + Phase H7 — Customer/Pricing Intelligence + AI Assistant

The two intelligence phases that don't require Google Cloud setup. Command
Core is now a real assistant: you can type a question into the input bar and
get a grounded answer from real business data, with cited external sources
when the model goes to the web.

### H7 — AI Assistant (the input bar is now live)
- New edge function `supabase/functions/ai-assistant/` — admin-auth, calls Anthropic Messages API (default model `claude-sonnet-4-6`), 4-iteration tool-use loop, server-side `search_web` + `get_weather` dispatch to existing H3 edge functions. Returns `{ text, citations, usage, model }`.
- Browser client `src/lib/intelligence/ai-assistant.ts` — `askAiAssistant(query, data, options?)` with structured reason codes for graceful failure.
- `buildAiContext` + `buildEnrichedContext` pre-resolve a PII-redacted bundle in the browser (snapshot, attention, top customers, insights, workload forecast, revenue pace, pricing patterns, rebook candidates) so the model has facts it can rely on without a roundtrip.
- `dispatchAiTool` with 23 tool cases. Internal-data tools query AppData directly (callable by UI surfaces too — e.g., the H4 "Draft follow-up" button). Google-family tools return `not_configured` and light up in H5.
- `CommandCorePanel` renders a pending orb / response card with paragraph rendering + `ExternalSourceChip` citations + "Clear" button. `CommandInputBar` got an `isLoading` prop and spinner. Friendly inline notice when `ANTHROPIC_API_KEY` isn't set.

**To activate:**
```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-assistant
```
Without the deploy, the assistant shows "AI assistant is inactive" and the rest of the Command Core dashboards remain fully live.

### H4 — Customer + Pricing Intelligence
- `customer-intelligence.ts` — `customerHighlights`, `predictNextRebookDate` (confidence scales with completed jobs), `draftFollowUpMessage` for rebook / thank-you / check-in intents.
- `pricing-intelligence.ts` — `buildPricingPatterns` (per `serviceId × vehicleSize`, sample-gated at 3 jobs), `buildCalculatorDrift` (null below $15 delta; suggested multiplier capped to [0.5, 2.0]). **Advisory only** — never auto-applies.
- `CustomerIntelligencePanel` on Customer detail (right column, above Vehicles) — tier badge, rebook prediction, top services, "Draft follow-up" dropdown that copies to clipboard.
- `PricingDriftCard` on Calculator — appears only when the current service × vehicle-size has a drift pattern.

### Test count
119 → 189 (+70 across 4 new test files). All passing.

### Deferred
- **H5 (Google integrations)** — deferred. Needs Google Cloud project + OAuth consent screen + scope verification (especially Gmail/Business Profile, which can take weeks). Plumbing on the H7 side already returns `not_configured` for `get_route_between_appointments`, `get_google_calendar_events`, `draft_gmail_message`, `get_google_business_reviews` so they activate cleanly when H5 lands.

---

## Previously Shipped: Phase H6 — Command Core: UI, Orb, and Full Panel

The visual identity of the intelligence layer. A signature animated orb (red/charcoal automotive,
multi-layer SVG/CSS, no libraries), a full `/command-core` page that
renders all of H1/H2/H3 in one curated experience, a top-bar launcher with a
pulse on critical items, and a dashboard hero "Business Pulse" card.

Highlights:
- `CommandCoreOrb` with four states (idle / thinking / alert / success) and five sizes (xs / sm / md / lg / xl). Reduced-motion fallback. Pure SVG + CSS — no canvas, no libraries.
- Orb state derives automatically from current attention urgency: critical → alert pulse, high → thinking spin, else → idle breathing.
- `/command-core` route — hero orb, KPI strip (today / attention / week revenue / month pace), command input bar with rotating placeholders, suggested command chips, attention items + insights + weather in a two-column grid.
- `CommandCoreLauncher` in the top bar with badge count for critical+high items.
- `BusinessPulseCard` — dashboard hero replacing nothing, just adding intelligence at the top with a one-line headline and click-through.
- Tailwind animation keyframes added to `tailwind.config.js`: `orb-breathe`, `orb-spin-slow`, `orb-spin-reverse`, `orb-spin-fast`, `orb-shimmer`, `orb-pulse-out`, `orb-flare`.
- 119 / 119 tests still passing.

**Note:** as of H7 the input bar is now wired to a real AI assistant; the
"comes online in H7" toast has been replaced with grounded responses + citation
chips when `ANTHROPIC_API_KEY` is configured server-side.

### Previously: Phase H3 — External Intelligence

Server-side edge functions that bring fresh outside information into the app —
provider keys never leave the server, every external claim is cited.

Highlights:
- New edge function `supabase/functions/external-search/` — Tavily-backed web search with admin auth, provider abstraction, freshness scoring, source attribution.
- New edge function `supabase/functions/weather/` — Open-Meteo daily forecast (free, no API key); defaults to Vancouver, WA service area.
- Browser-side client (`searchWeb`, `lookupWeather`, `getWeatherForAppointment`) with in-session caching and structured `ExternalResult<T>` reason codes for graceful "not configured" UX.
- `ExternalSourceChip` and `WeatherWatchCard` UI components — Weather Watch hides silently when no upcoming jobs or when the function is unreachable.
- Settings → Integrations panel with test surfaces for both web search and weather.
- 5 new tests (cache + early-return paths); **119 / 119 total passing**.

**To activate web search:**
```
supabase secrets set TAVILY_API_KEY=tvly-...
supabase functions deploy external-search
```

**To activate weather (no key needed):**
```
supabase functions deploy weather
```

Without those deploys, the Weather Watch card hides silently and Settings →
Integrations shows "Not configured."

### Previously: Phase H2 — Insights & Forecasts

The second layer on top of the H1 attention engine — narrative observations
the data is making about the business, with explicit confidence + sample size
on every claim.

Highlights:
- `buildWorkloadForecast` — next-7-days bookedJobs, capacity, overloaded vs underbooked dates.
- `buildRevenuePace` — MTD collected, linear projection to month-end, comparison vs last month, booked-but-not-yet-collected.
- 7 insight families in `insights.ts`:
  - **pricing_drift** — per-service quote-vs-final delta when consistent across enough samples
  - **duration_drift** — service runs over/under its configured duration based on job timer
  - **revenue_pace** — projection vs last month
  - **average_ticket_trend** — this month's avg ticket vs last month's
  - **lead_source_winner** — highest-converting source with ≥4 leads
  - **rebook_candidates** — aggregated count of customers due/overdue, with potential ticket value
  - **workload_outlook** — overloaded or underbooked weeks (suppressed for fresh apps)
- Each insight gates on `hasMinimumSample()` — never surfaced below 3 samples.
- `RecentInsightsCard` on the dashboard, hidden entirely when nothing meets the threshold.
- 22 new tests (8 forecast + 14 insights); **114 / 114 total passing**.

### Previously: Phase H1 — Intelligence Foundation
Deterministic attention engine + derived metrics + `NeedsAttentionCard`. See
the H1 entry in `roadmap.md` for the full breakdown.

## Previously Shipped: Phase G — Reliability, Reviews, and Professional Output

Combined Phase F (review request workflow) and Phase G (timezone correctness, hardened critical writes, PDF receipts, Vitest setup). The app is now safer to trust with real customer bookings, real money, and real tax records.

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
