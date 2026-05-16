# Detail Command — Current Task

## What We Just Shipped

**Phase H4 + Phase H7 — Customer/Pricing Intelligence + AI Assistant.** The two
remaining intelligence phases that don't require Google Cloud setup. Command
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
