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

### Phase H1 — Command Core: Intelligence Foundation (shipped)
- [x] `src/lib/intelligence/` module: `types.ts`, `confidence.ts`, `data-access.ts`, `derived-metrics.ts`, `rules.ts`, `explainers.ts`, `source-attribution.ts`, `index.ts`.
- [x] Deterministic attention engine with 15 rule families (bookings, jobs, customers/finance, leads, operations).
- [x] `BusinessSnapshot`, `CustomerIntelligenceProfile`, `ServicePerformanceProfile`, `LeadSourcePerformance` derived metrics.
- [x] `NeedsAttentionCard` dashboard surface with snooze/dismiss (localStorage, cross-tab synced).
- [x] Stub modules for Phases H2–H7 (`insights`, `forecasts`, `pricing-intelligence`, `external-intelligence`, `ai-context`, `ai-tools`, `customer-intelligence`).
- [x] 55 new unit tests; 92 / 92 total passing.
- [x] `docs/command-core-architecture.md` — full multi-phase plan.

### Phase H2 — Command Core: Insights & Forecasts (shipped)
- [x] `forecasts.ts` — `buildWorkloadForecast` (next-N-days bookedJobs / capacity / overloaded / underbooked), `buildRevenuePace` (MTD collected, projection, vs last month).
- [x] `insights.ts` — 7 insight families: pricing drift, duration drift, revenue pace, average ticket trend, lead source winner, rebook candidates aggregation, workload outlook. Each is sample-aware (suppressed below MIN_SAMPLE_FOR_INSIGHT) with confidence + sample size.
- [x] `RecentInsightsCard` dashboard surface with confidence pills + recommended-action links.
- [x] 22 new unit tests (8 forecast + 14 insights); 114 / 114 total passing.

### Phase H6 — Command Core: UI / Orb / Full Panel (shipped)
- [x] `CommandCoreOrb.tsx` — animated multi-layer SVG/CSS element with idle / thinking / alert / success states. Sizes xs–xl. Reduced-motion fallback. No libraries.
- [x] Tailwind keyframes added (`orb-breathe`, `orb-spin-slow`, `orb-spin-reverse`, `orb-spin-fast`, `orb-shimmer`, `orb-pulse-out`, `orb-flare`).
- [x] Response primitives: `MetricPill`, `ConfidenceBadge`, `SuggestedCommandChip`, `CommandInputBar` (rotating placeholders, H7-ready).
- [x] `CommandCorePanel` + `/command-core` route — full intelligence experience with hero orb, KPI strip, command bar, suggestions, two-column attention + insights + weather grid.
- [x] `CommandCoreLauncher` in TopBar with critical/high pulse and badge count.
- [x] `BusinessPulseCard` dashboard hero — orb + headline + detail + animated motion bar; click-through to `/command-core`.
- [x] Orb state derives automatically from attention urgency (critical → alert, high → thinking, otherwise → idle).
- [x] 119 / 119 tests passing.

### Phase H7 — Command Core: AI Assistant (shipped)
- [x] `src/lib/intelligence/ai-context.ts` — `buildAiContext` (PII-redacted bundle) + `buildEnrichedContext` (bundle + insights + workload forecast + revenue pace + pricing patterns + rebook candidates, all capped).
- [x] `src/lib/intelligence/ai-tools.ts` — `dispatchAiTool` with 23 tool cases. Internal data tools query AppData directly; `search_web` / `get_weather_for_appointment` / `search_news` proxy to H3 edge functions; Google-family tools return `not_configured` (light up in H5).
- [x] `supabase/functions/ai-assistant/` — POST-only edge function. Admin auth via `is_admin()`. 4-iteration tool-use loop calling Anthropic Messages API. Server-side `search_web` and `get_weather` dispatch via internal fetch to existing edge functions. Returns `{ text, citations, usage, model }`. Required secret: `ANTHROPIC_API_KEY`. Optional: `AI_ASSISTANT_ENABLED`, `AI_ASSISTANT_MODEL` (default `claude-sonnet-4-6`), `AI_ASSISTANT_MAX_TOKENS` (default 1500).
- [x] `src/lib/intelligence/ai-assistant.ts` — browser client `askAiAssistant(query, data, options?)` with `ExternalResult<AiAssistantResponse>` reason codes (`ok`, `not_configured`, `unauthorized`, `rate_limited`, `bad_query`, `provider_failed`, `supabase_unconfigured`).
- [x] `CommandInputBar` gains `isLoading` prop + spinner. `CommandCorePanel` renders a response card with pending orb / paragraphs / citation chips / "Clear" button; special `not_configured` inline notice.
- [x] 33 new unit tests (12 ai-context + 21 ai-tools); **189 / 189 total passing**.

**Deploy steps:**
```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-assistant
```
Without the deploy, the input bar still works — it shows a friendly "AI assistant is inactive" inline notice and the rest of the dashboards remain fully live.

### Phase H4 — Command Core: Customer + Pricing Intelligence (shipped)
- [x] `src/lib/intelligence/customer-intelligence.ts` — `predictNextRebookDate(profile)` (confidence scales with completed-job count), `customerHighlights(data, customerId)` (tier, lifetime spend, top services, rebook prediction, open balance), `draftFollowUpMessage(data, customerId, intent)` for `rebook` / `thank_you` / `checkin`.
- [x] `src/lib/intelligence/pricing-intelligence.ts` — `buildPricingPatterns(data)` groups completed jobs with both quote + final by `serviceId × vehicleSize`, sample-gated at `MIN_SAMPLE_FOR_INSIGHT` (3). `buildCalculatorDrift(data, serviceId, vehicleSize?)` returns null below $15 delta, else `{ patternDeltaCents, suggestedMultiplier, sampleSize, confidence, summary }` with multiplier capped to [0.5, 2.0]. **Advisory only** — never auto-applies per spec §8.
- [x] `src/components/intelligence/CustomerIntelligencePanel.tsx` — drops into Customer detail right column above Vehicles. Tier badge, rebook prediction with confidence pill, top 3 services, "Draft follow-up" dropdown (copies to clipboard via `navigator.clipboard.writeText` + toast). Hides entirely for customers with no signals.
- [x] `src/components/intelligence/PricingDriftCard.tsx` — appears on Calculator page when the selected `serviceId × vehicleSize` has a drift pattern. Shows delta, suggested multiplier, confidence, sample size.
- [x] 37 new unit tests (14 customer-intelligence + 23 pricing-intelligence); 156 / 156 passing at H4-completion.

### Phase H3 — Command Core: External Intelligence (shipped)
- [x] `supabase/functions/external-search/` edge function — Tavily-backed web search with admin auth + provider abstraction. Required secret: `TAVILY_API_KEY`. Optional: `WEB_SEARCH_PROVIDER`, `WEB_SEARCH_ENABLED`.
- [x] `supabase/functions/weather/` edge function — Open-Meteo daily forecast (free, no API key). Defaults to Vancouver, WA; accepts lat/lng overrides.
- [x] Browser-side client `src/lib/intelligence/external-intelligence.ts` — `searchWeb()`, `lookupWeather()`, `getWeatherForAppointment()`, in-session memory + 30-min weather cache, structured `ExternalResult<T>` with reason codes for graceful "not configured" UX.
- [x] `ExternalSourceChip` reusable attribution component with freshness pill.
- [x] `WeatherWatchCard` dashboard widget — flags rain risk on upcoming jobs over the next 7 days; hidden when no upcoming or weather unreachable.
- [x] Settings → Integrations panel with web-search + weather test surfaces, status pills, and citation rendering.
- [x] 5 new unit tests (cache + early-return paths); 119 / 119 total passing.

**Deploy steps:**
```
supabase secrets set TAVILY_API_KEY=tvly-...
supabase functions deploy external-search
supabase functions deploy weather
```

---

## Planned / Future

### Command Core — remaining phases
See [docs/command-core-architecture.md](docs/command-core-architecture.md) for the full design.

- [ ] **H5** — Google integrations (OAuth, Calendar one-way sync, Maps/Routes, Gmail draft scaffolding, Business Profile read-only). Activates the `not_configured` tool stubs already wired into the H7 dispatcher.
- [ ] **H8** — Refinement (intelligence-driven push notifications, feedback loop on AI responses, server-side cron for time-sensitive surfaces, accepted/rejected pricing-drift telemetry).

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
