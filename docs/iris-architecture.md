# Command Core — Business Intelligence Layer

This document is the architectural reference for the multi-phase intelligence
system being layered onto Detail Command. Phase 1 is shipped; Phases 2–7 are
designed and scaffolded so each can land cleanly without re-shaping the
foundation.

The goal is to turn Detail Command from "a polished management app that
stores records" into "an intelligent operating system that helps run, improve,
and grow the business" — without the gimmicks. Real data, deterministic
logic, sourced external information, AI on top — in that order.

---

## Cooperating layers

```
┌─────────────────────────────────────────────────────────────┐
│  F. Delivery — dashboard cards, Command Core panel,          │
│     contextual entry points, notifications                   │
├─────────────────────────────────────────────────────────────┤
│  E. AI Reasoning — grounded Q&A, summaries, drafts           │
│     (Phase 7)                                                │
├─────────────────────────────────────────────────────────────┤
│  D. External Intelligence — web search, weather, routes,     │
│     Google integrations (Phase 3 + Phase 5)                  │
├─────────────────────────────────────────────────────────────┤
│  C. Insight / Analytics — trends, pricing drift, customer    │
│     intelligence, forecasts, recommendations (Phases 2 + 4)  │
├─────────────────────────────────────────────────────────────┤
│  B. Rules / Attention — deterministic "what needs me now"    │
│     (PHASE 1 ✓ shipped)                                      │
├─────────────────────────────────────────────────────────────┤
│  A. Data Foundation — derived metrics, BusinessSnapshot,     │
│     CustomerIntelligenceProfile, ServicePerformanceProfile   │
│     (PHASE 1 ✓ shipped)                                      │
└─────────────────────────────────────────────────────────────┘
```

The system is designed to **degrade gracefully**:
- Without an AI key, deterministic rules and dashboard intelligence still work.
- Without web/Google integrations, internal intelligence is unaffected.
- AI never invents numbers it doesn't have — it queries tool functions first.

---

## Module map (`src/lib/intelligence/`)

| File | Phase | What it does |
|---|---|---|
| `types.ts` | 1 | Single source of truth for AttentionItem, BusinessSnapshot, CustomerIntelligenceProfile, AiContextBundle, ExternalFinding, etc. |
| `confidence.ts` | 1 | Sample-size → "low" / "medium" / "high" |
| `data-access.ts` | 1 | Pure helpers over AppData (find customer, completed appointments, hours-since-start, range filters) |
| `derived-metrics.ts` | 1 | BusinessSnapshot, CustomerIntelligenceProfile, ServicePerformanceProfile, LeadSourcePerformance |
| `rules.ts` | 1 | The deterministic attention engine — 15 rule families |
| `explainers.ts` | 1 | Pure helpers turning intelligence outputs into plain English |
| `source-attribution.ts` | 1 | FactSource discriminated union (`internal` / `external` / `ai-inference`) |
| `insights.ts` | 2 | Trend analysis, pricing drift, revenue pace |
| `forecasts.ts` | 2 | Workload + revenue forecasts |
| `customer-intelligence.ts` | 4 | Re-export hub + Phase-4 expansions (rebook scoring, message drafts) |
| `pricing-intelligence.ts` | 4 | Quote-vs-final patterns, calculator drift warnings |
| `external-intelligence.ts` | 3 | Provider-abstracted web search + weather |
| `ai-context.ts` | 7 | Builds the minimal-PII bundle sent to the AI provider |
| `ai-tools.ts` | 7 | Tool name registry + dispatcher (called by AI provider's tool-use API) |
| `index.ts` | 1 | Public barrel — import from `@/lib/intelligence` only |

---

## Phase 1 — Intelligence Foundation ✓ SHIPPED

### Attention Engine (`rules.ts`)

15 deterministic rules covering bookings, jobs, customers, leads, finance, and
operations. Each rule is a pure function `(AppData, Date) → AttentionItem[]`.

**Bookings**
- `pending_booking_stale` — pending_approval older than 6 h (high) / 24 h (critical).
- `deposit_paid_unapproved` — money in hand, status still pending → critical.

**Jobs**
- `completed_no_final_price` — completed >6 h with no final price → high.
- `completed_no_receipt` — completed >6 h with no active receipt → high.
- `completed_no_review_request` — completed 24 h–21 d, no request sent → medium.
- `job_timer_stalled` — `actualStartAt` set with no `actualEndAt` for >4 h → medium.
- `in_progress_overrun` — elapsed ≥130 % of estimated duration → medium.

**Customers / finance**
- `receipt_open_balance` — active receipt with `remainingBalanceCents > 0`, ≥7 d old (medium) / ≥21 d (high).
- `customer_overdue_rebook` — last service > 1.2× the customer's median rebook interval. Confidence scales with completed-job count.
- `high_value_dormant` — high-value/VIP tier, >90 d since last service (suppressed when rebook rule covers them).

**Leads**
- `lead_uncontacted` — status `new`, >24 h old → high.
- `lead_followup_due` — `followUpDate` past, status not booked/lost → high.
- `lead_going_cold` — status open, lastContacted >7 d ago → medium.

**Operations**
- `discount_expiring` / `discount_expired` — service discount within 7 d / past expiry.
- `sales_tax_no_rate` — tax enabled but rate unset → high.

Every rule emits an `AttentionItem` with:
- stable id (`att_<type>_<entityId>`) so snooze/dismiss persistence is reliable;
- priority (`critical` / `high` / `medium` / `low` / `insight`);
- a one-sentence "why it matters";
- a primary action (label + linkUrl into the existing app);
- entityType + entityId for downstream wiring.

When the underlying condition is fixed, the rule no longer emits the item, so
attention auto-resolves with no cleanup code. Tests prove this.

### Derived metrics (`derived-metrics.ts`)

- `buildBusinessSnapshot(data, range, attention?)` — normalized point-in-time view: appointment counts by status, collected/outstanding/booked-future cents, average ticket, expenses (signed for credits), lead conversion, attention counts.
- `buildCustomerProfile(data, customer, now?)` — lifetime spend (cents), tier (`new` / `regular` / `high_value` / `vip`), median rebook interval, rebook status, open balance.
- `buildServicePerformance(data, service)` — jobs count, average final price, average duration (from job timer), average hourly cents, quote-to-final delta, confidence + sample size.
- `buildLeadSourcePerformance(data)` — per-source leads count, conversion rate, attributed revenue (best-effort name match between Lead and Customer).
- `topCustomerProfiles(data, limit)` and `rebookCandidates(data)` — convenience aggregators.

### Snooze / dismiss state

`src/components/intelligence/snoozeStorage.ts` — `useAttentionLocalState()`
hook backed by `localStorage` (key `detail-command:attention-state:v1`).
Cross-tab sync via the `storage` event. Preset durations: 1 h / Tomorrow /
Next week. **Phase 2+** can promote this to an `intelligence_actions` Supabase
table without changing the consumer API.

### UI surface

`src/components/intelligence/NeedsAttentionCard.tsx` — slots into Dashboard
between `ReviewsDueWidget` and the two-column grid. Shows top 5 by default
with "Show N more" expansion, an inline snoozed/dismissed drawer, and a
"reset snoozed" affordance. Empty state when nothing needs attention.

### Tests

55 new unit tests in `src/lib/intelligence/__tests__/`:
- `rules.test.ts` — every rule family, threshold edges, auto-resolve, dedupe stability, priority ordering.
- `derived-metrics.test.ts` — snapshot math, customer profile (median, tier, rebook status), service performance confidence levels, lead source aggregation.

Total project test count: **92 / 92 passing**.

---

## Phase H2 — Insights, forecasts, confidence ✓ SHIPPED

**Goal:** Surface trend-level observations the rules layer can't capture.

### Forecasts (`forecasts.ts`)
- `buildWorkloadForecast(data, rangeDays, now)` → `WorkloadForecast` — bookedJobs / bookedRevenueCents / openCapacity / overloadedDates / underbookedDates over next N days, grouped by business-local date key.
- `buildRevenuePace(data, now)` → `RevenuePace` — MTD collected, linear month-end projection, vs last month ratio, hasEnoughDataToProject (≥5 days in).

### Insight families (`insights.ts`)
Every insight is sample-aware (`hasMinimumSample` gate) and includes a confidence label + sample size:

- **`pricing_drift`** — per non-addon service: avg quote-to-final delta exceeds $15 across ≥3 completed jobs that have both an estimate and a final price.
- **`duration_drift`** — per service: avg job-timer duration drifts >20 min from `service.durationMinutes` across ≥3 timed jobs.
- **`revenue_pace`** — only fires after day 5 of the month; compares linear projection to last month's collected total.
- **`average_ticket_trend`** — this month's average ticket vs last month's, when both have ≥3 completed jobs and the delta exceeds 8%.
- **`lead_source_winner`** — highest-converting source with ≥3 leads and ≥1 conversion.
- **`rebook_candidates`** — aggregate count of customers in `due`/`overdue` rebook status.
- **`workload_outlook`** — overloaded weeks always fire; underbooked weeks (≥3 underbooked dates of 7) fire only for apps with prior completed-job history.

### UI
`src/components/intelligence/RecentInsightsCard.tsx` — slots into Dashboard
right after `NeedsAttentionCard`. Shows up to 4 insights with confidence pills
and recommended-action links. Hidden entirely when no insights meet the
threshold (avoids dashboard noise on fresh apps).

### Tests
22 new tests in `__tests__/forecasts.test.ts` (8) and `__tests__/insights.test.ts`
(14) — every insight family has at least one fires/doesn't-fire pair plus an
empty-data sanity check. Total project test count: **114 / 114 passing**.

---

## Phase H3 — External web intelligence ✓ SHIPPED

**Goal:** Answer fresh/current questions with cited sources, never from stale
model memory.

### Edge functions

**`supabase/functions/external-search/`** — provider-abstracted web search.
- Auth: requires the caller's Supabase JWT; verifies admin via the `is_admin()` RPC.
- Provider: Tavily by default. Adapter pattern so a second provider (Brave, Exa, etc.) can be added by adding another adapter and selecting via `WEB_SEARCH_PROVIDER`.
- Freshness scoring on each citation: `fresh` (<30 d) / `recent` (<1 y) / `stale` / `unknown`.
- Confidence on the overall finding scales with how many non-stale citations were returned.
- Returns a normalized `ExternalFinding` shape regardless of provider.
- Required secret: `TAVILY_API_KEY`. Optional: `WEB_SEARCH_PROVIDER`, `WEB_SEARCH_ENABLED`.

**`supabase/functions/weather/`** — Open-Meteo daily forecast.
- Free, no API key, no signup.
- Defaults to Vancouver, WA (45.6387, −122.6615); accepts `latitude`/`longitude` overrides.
- Returns a `WeatherFinding` with daily highs/lows in °F, precipitation probability, conditions (WMO weather-code labels), and inches of precip.
- Same admin-auth gate as external-search.

### Browser-side client

`src/lib/intelligence/external-intelligence.ts`:
- `searchWeb(query, options)` — invokes external-search via `supabase.functions.invoke`. Returns `ExternalResult<ExternalFinding>` with reason codes (`ok`, `provider_not_configured`, `unauthorized`, `provider_failed`, `bad_query`, `supabase_unconfigured`).
- `lookupWeather(options?)` — invokes weather. 30-minute in-session cache by lat/lng key.
- `getWeatherForAppointment(appointmentId)` — Phase H7-friendly tool wrapper; throws on failure to keep tool-result semantics. For v1 returns service-area-level forecast; per-appointment geocoding is a Phase H5 follow-up.
- `clearExternalCaches()` for the Settings test surface.

### UI surfaces

- `ExternalSourceChip` — reusable citation pill with domain + freshness badge. Phase H7's AI assistant will use the same component for response citations.
- `WeatherWatchCard` — dashboard widget over the next 7 days. For each upcoming non-canceled appointment, matches it to the daily forecast by business-local date key. Flags jobs with ≥50% precipitation probability with an amber accent + warning icon. Hides silently when there are no upcoming jobs OR the weather function is unreachable.
- `Settings → Integrations` — status pills for web search + weather, test query inputs, citation rendering. Lays the groundwork for Phase H5 to add Google Calendar / Maps / Gmail / Business Profile controls.

### Deploy

```
supabase secrets set TAVILY_API_KEY=tvly-...
supabase functions deploy external-search
supabase functions deploy weather
```

If you skip the deploy, the dashboard's Weather Watch card hides silently and
the Integrations panel shows "Not configured." The rest of the app is
unaffected.

### Tests

5 new tests in `__tests__/external-intelligence.test.ts` covering cache
behavior and the non-network early-return paths (empty query → `bad_query`,
no supabase client → `supabase_unconfigured`, deduped second call returns
cached result, different options keys → different cache slots). Total project
test count: **119 / 119 passing**.

### What's NOT in H3 (intentional boundaries)

- No per-appointment geocoding — Phase H5 (Google Maps) follow-up.
- No persistent external-research cache table — in-session only for v1; Phase H8 may promote to a table for cross-session sharing.
- No proactive weather-risk attention items merging into `runAttentionRules` — that would require an async rule path. Phase H6/H7 will integrate weather signals into the AI surface and (optionally) into a separate async-attention layer.

---

## Phase H4 — Customer + pricing intelligence ✓ SHIPPED

**Goal:** Per-entity intelligence panels — what does this customer / this
service look like, and where is the calculator drifting from reality?

### Customer intelligence (`customer-intelligence.ts`)

- `predictNextRebookDate(profile)` — projects next service from `lastServiceAt` + `medianRebookIntervalDays`. Confidence scales with completed-job count via `confidenceFromSample`. Returns null when there isn't enough rebook history to project.
- `customerHighlights(data, customerId)` — structured snapshot: tier, lifetime spend cents, total + completed jobs, last service ISO + days-since, top 3 services by count, rebook status, predicted next rebook with confidence, open balance, repeat / monthly flags. Returns null when the customer has no signals at all (avoids panel noise on brand-new entries).
- `draftFollowUpMessage(data, customerId, intent)` — plain-template `{ subject, body }` for `rebook` / `thank_you` / `checkin`. No AI dependency — pure string templates using customer name + last service date + top service.
- Re-exports `buildCustomerProfile`, `rebookCandidates`, `topCustomerProfiles` from Phase 1 so consumers import from one place.

### Pricing intelligence (`pricing-intelligence.ts`)

- `buildPricingPatterns(data)` — every completed appointment with both `estimatedPrice` and `finalPrice` set is grouped by `serviceId × vehicleSize` (or `__any__` when vehicle size is absent). Computes `quotedAvgCents`, `finalAvgCents`, `deltaAvgCents`, `averageDurationMinutes`, `sampleSize`. Confidence via `confidenceFromSample`. **Sample-gated at `MIN_SAMPLE_FOR_INSIGHT` (3 jobs).** Legacy `estimatedPrice` / `finalPrice` dollars are converted to cents at the boundary via `dollarsToCents`.
- `buildCalculatorDrift(data, serviceId, vehicleSize?)` — looks up the matching pattern (exact `serviceId × vehicleSize`, then no-size fallback). Returns null below $15 (1500 cents) of delta. Otherwise emits `{ patternDeltaCents, suggestedMultiplier, sampleSize, confidence, summary }` with the multiplier capped to `[0.5, 2.0]` so a noisy outlier can't yank the suggestion.
- **Advisory only** per spec §8 — never mutates settings.

### UI surfaces

- `src/components/intelligence/CustomerIntelligencePanel.tsx` — drops into Customer detail's right column, above Vehicles. Tier badge, rebook prediction with confidence pill, top 3 services, "Draft follow-up" dropdown (rebook / thank-you / check-in) that copies the templated message to clipboard via `navigator.clipboard.writeText` and toasts. Hidden entirely when `customerHighlights` returns null.
- `src/components/intelligence/PricingDriftCard.tsx` — appears on `/calculator` only when the current `serviceId × vehicleSize` has a drift pattern with sufficient sample. Shows the delta, suggested multiplier, confidence, and sample size as an advisory note.

### Tests

37 new tests in `__tests__/customer-intelligence.test.ts` (14) and
`__tests__/pricing-intelligence.test.ts` (23) — prediction confidence scaling,
sample-size gating, multiplier capping, drift threshold edges, draft templates
for each intent. Total at H4 completion: **156 / 156 passing**.

---

## Phase 5 — Google integrations (planned)

**Goal:** Two-way connection to Calendar, Maps/Routes, Gmail, Business Profile (where access permits).

- New OAuth flow: `supabase/functions/google-oauth-callback/`. Tokens encrypted server-side in a new `google_connections` table.
- `google_sync_logs` table for per-event audit.
- Settings → Integrations panel: connect / disconnect / scope summary per integration.
- **Calendar:** one-way push initially — store `external_event_id` on the appointment row.
- **Maps/Routes:** `getRouteBetweenAppointments(ids)` — Google Routes API; outputs cached briefly.
- **Gmail:** scaffold `draftGmailMessage(context)`; never auto-send without explicit opt-in.
- **Business Profile:** read-only review fetch when access is approved; manual review-link workflow remains the fallback.

App must remain fully functional without any Google integration connected.

---

## Phase H6 — Command Core UI / animated orb ✓ SHIPPED

**Goal:** Distinct visual identity for the intelligence layer — premium, fluid,
automotive, NOT a generic chat panel.

### The orb (`CommandCoreOrb.tsx`)

Pure SVG + CSS, no libraries. Composed of layered radial / conic gradients
that breathe and rotate independently:

1. **Outer halo** — blurred breathing red glow (`blur-2xl` + `animate-orb-breathe`).
2. **Pulse rings** (alert/thinking only) — outward-expanding rose-bordered rings on stagger.
3. **Outer rotating ring** — thin red conic gradient with mask, slow rotation.
4. **Inner counter-ring** — brighter accents, opposite-direction rotation.
5. **Core body** — radial gradient (white → red → deep red → near-black) with inset shadow.
6. **Specular highlight** — top-left shine at 30% opacity, `mix-blend-mode: screen`.
7. **Inner shimmer band** — slow conic orbiting overlay, screen-blended.
8. **Center pinprick** — bright white "heart" with red glow shadow.

States:
- `idle` — slow breathing, slow spin.
- `thinking` — faster pulse + faster spin + active outward rings.
- `alert` — red intensifies (`#e11d48` → `#7f1d1d`), faster everything, sharper center glow.
- `success` — slightly different gradient (rose-tinged), used briefly on resolution.

Sizes: `xs` (20px) → `xl` (220px). Always respects `prefers-reduced-motion`.

### Tailwind keyframes (added to `tailwind.config.js`)

`orb-breathe`, `orb-breathe-fast`, `orb-spin-slow`, `orb-spin-reverse`,
`orb-spin-fast`, `orb-shimmer`, `orb-pulse-out`, `orb-flare`.

### Response primitives

- `MetricPill` — KPI tile with accent border, icon, label, value, hint, optional trend arrow.
- `ConfidenceBadge` — high/medium/low pill with sample-size tooltip.
- `SuggestedCommandChip` — full-pill chip linking to a route or running a click handler.
- `CommandInputBar` — rotating placeholders (9 prompts cycling every 4 s when unfocused), focus glow, mic button stub, submit button. Submit handler is provided by the parent — Phase H7 swaps it to call the AI edge function.

### `/command-core` page (`CommandCorePage` → `CommandCorePanel`)

Layout, top to bottom:
1. **Ambient background** — three radial red glows from the corners.
2. **Hero** — XL orb (state-aware), "Detail Command · Intelligence Layer" eyebrow, gradient-text "Command Core" title, dynamic status line.
3. **KPI strip** — today's jobs, attention count (auto-color), week revenue, month pace (with trend arrow).
4. **Command input bar** — rotating placeholders, H7 notice below.
5. **Suggested command chips** — six contextual links to existing pages.
6. **Two-column grid:**
   - Left (2/3): Needs Attention — top 8 items via the same `AttentionItemRow` component as the dashboard, with snooze/dismiss; empty state shows a small success-state orb.
   - Right (1/3): Insights card, Weather card (rendered from H3 lookup), reviews-time-sensitive nudge when applicable.
7. **Footer note** — H7 readiness statement.

### `CommandCoreLauncher`

Top-bar entry slotted before NotificationCenter. Renders a small (32px)
`CommandCoreOrb` with state derived from current attention counts; shows a
red/amber badge with `critical+high` count when > 0; routes to `/command-core`.

### `BusinessPulseCard`

Dashboard hero placed at the very top of `Dashboard.tsx`, above the existing
greeting. Shows the medium orb on the left with a "Business Pulse" eyebrow,
a one-sentence headline summarizing today (`X jobs today · Y need you · $Z this week`),
a contextual detail line, and a click-through to `/command-core`. A shimmer
bar at the bottom provides motion without noise. Color of the shimmer mirrors
priority state (rose / amber / violet / primary).

### Contextual entry points (deferred to H7)

The customer detail / calendar / calculator / work mode contextual entry
buttons listed in the original spec land in Phase H7 alongside the AI
assistant — they only become useful once the assistant can answer
context-specific questions. The plumbing (orb + route + panel) is ready.

### Tests

The visual layer is hard to unit-test meaningfully. Existing tests still
pass (119 / 119) which proves the wiring didn't break anything. Manual smoke:
`npm run dev` → load `/`, see Business Pulse hero → click → `/command-core`
renders → orb is animating → KPI strip live → attention items rendered →
input cycles placeholders → mobile layout stacks vertically.

---

## Phase H7 — AI assistant ✓ SHIPPED

**Goal:** Grounded natural-language Q&A over real business data + cited
external sources. The `CommandInputBar` is now wired to a real model; the rest
of the dashboards remain fully live whether or not the AI is configured.

### Architecture — v1 decision

The browser owns `AppData`. The edge function owns the Anthropic key. So:

1. **Browser pre-resolves deterministic facts.** `buildEnrichedContext(data, options)` returns a JSON-serializable bundle: PII-redacted business snapshot, top attention items (capped at 15), top customer profiles, insights (cap 10), workload forecast, revenue pace, pricing patterns (cap 10), rebook candidates (cap 10). All sample-gated. No raw rows, no phones / emails, no full customer lists.
2. **Browser sends `{ query, context }`** to `supabase/functions/ai-assistant/`. Body capped at 256KB.
3. **Edge function calls Anthropic.** Default model `claude-sonnet-4-6` (override via `AI_ASSISTANT_MODEL`). System prompt: "you are the business-intelligence layer for a mobile auto-detailing business; answer ONLY from facts in the provided context bundle OR from results of tool calls; never invent numbers; cite external sources when used; ≤200 words; direct, no-fluff, automotive tone."
4. **Tool-use loop (≤4 iterations).** Tools the model can call server-side:
   - `search_web({ query, recency? })` — internal fetch to project's own `external-search` edge function, preserving caller's `Authorization` header for admin gate.
   - `get_weather({ days? })` — internal fetch to `weather`.
   - Tool dispatch failure → reported back to the model as `tool_result` with `is_error: true`; never fails the whole request.
5. **Citations** collected from `search_web` results: `{ title, url, domain, freshness }`.
6. **Response shape:** `{ text, citations, usage: { input_tokens, output_tokens }, model }`.

### Browser-side dispatcher (`ai-tools.ts`)

The model in v1 doesn't roundtrip internal data tools — they're pre-resolved
in the context bundle. But `dispatchAiTool(name, args, ctx)` is implemented
for the full 23-tool surface, callable directly by UI buttons (e.g., H4's
"Draft follow-up" runs through `draft_customer_message`):

- Internal data: `get_business_snapshot`, `get_attention_items`, `get_customer_summary`, `search_customers`, `get_appointments`, `get_revenue_summary`, `get_workload_forecast`, `get_pricing_patterns`, `get_review_request_gaps`, `get_rebooking_candidates`, `get_quote_vs_final_analysis`, `draft_customer_message`
- External (server-proxied from H3): `search_web`, `search_news`, `get_weather_for_appointment`
- Google-family (`get_route_between_appointments`, `get_google_calendar_events`, `draft_gmail_message`, `get_google_business_reviews`) — return `{ ok: false, error: "not_configured" }`. **Lit up when Phase H5 lands.**
- Stubbed (`get_expense_summary`, `get_mileage_summary`, `get_service_performance`, `get_lead_performance`) — return `not_implemented` for now; trivial follow-ups.
- Unknown name → `{ ok: false, error: "unknown_tool" }`.

### Browser-side client (`ai-assistant.ts`)

- `askAiAssistant(query, data, options?)` returns `AiAssistantResult` (`ExternalResult<AiAssistantResponse>` pattern).
- Reason codes: `ok`, `not_configured`, `unauthorized`, `rate_limited`, `bad_query`, `provider_failed`, `supabase_unconfigured`.
- Internally calls `buildEnrichedContext(data, options)` to assemble the payload.
- Uses the same `supabase.functions.invoke()` pattern as the H3 external clients.

### UI wiring (`CommandCorePanel.tsx`)

- `handleSubmit` no longer just toasts. It calls `askAiAssistant`, sets `pending`, renders a card between the suggestions and the two-column grid:
  - **Pending:** small orb in `thinking` state + "Thinking…"
  - **Response:** paragraph rendering (split on `\n\n`) + `ExternalSourceChip` citations + "Clear" button.
  - **Error:** friendly inline message. Special-case `not_configured`: "AI assistant is inactive. Set `ANTHROPIC_API_KEY` in Supabase function secrets and deploy `ai-assistant` to enable conversational answers."
- `CommandInputBar` gained an `isLoading` prop + spinner. Default disclaimer text: "Grounded in your real business data. Provider key never leaves the server."

### Failure modes

- No `ANTHROPIC_API_KEY` → 503 `{ error: "not_configured" }` → friendly inline notice. Dashboards unaffected.
- No `TAVILY_API_KEY` → `search_web` returns `provider_not_configured` to the model, which proceeds without it.
- Anthropic 4xx / 5xx → 502 with sanitized message.
- Bad query / oversized body → 400.
- Tool dispatch failure → reported back to the model as an error tool_result.

### Privacy

- `buildAiContext` / `buildEnrichedContext` defensively strip phones / emails from any nested structure when `options.includePii !== true`. `CustomerIntelligenceProfile` doesn't carry them anyway.
- Edge function never logs API keys, customer names, phones, emails, or full bundles.

### Deploy

```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-assistant
```

Optional env: `AI_ASSISTANT_ENABLED`, `AI_ASSISTANT_MODEL` (default `claude-sonnet-4-6`), `AI_ASSISTANT_MAX_TOKENS` (default 1500).

### Tests

33 new tests in `__tests__/ai-context.test.ts` (12) and `__tests__/ai-tools.test.ts` (21) — shape, attention cap, focus customer inclusion, PII absence, tool ok-paths, unknown-tool, not_configured for Google family. Total at H7 completion: **189 / 189 passing**. The edge function itself is not unit-tested (Deno runtime, network); validate via deploy + smoke prompt.

### What's NOT in H7 (deliberate v1 boundaries)

- Internal data tools are **not** roundtripped through the model — they're pre-resolved in the bundle. If the model needs a customer that's not in the top-5 focus set, it can't fetch one. A future revision can promote `search_customers` and `get_customer_summary` into server-side tools.
- No streaming response. Full message lands at once. Streaming is a Phase H8 polish.
- No conversation history. Each `askAiAssistant` call is independent. Multi-turn chat is a Phase H8 polish.
- No feedback loop (thumbs up/down). Phase H8.

---

## Phase 8 — Refinement (planned)

- Promote attention items into the notifications stream where appropriate (push for `critical` / `high` only).
- Feedback loop: thumbs-up/down on insights, accepted/rejected pricing suggestions.
- "Refresh Intelligence" button + `generated_at` timestamps.
- Server-side cron for review reminders, dormant-customer pings, mileage-after-completion reminders.
- Manual test checklist additions for every new surface.

---

## Conventions

**Money.** All new code uses cents. Legacy `Appointment.estimatedPrice` and
`finalPrice` are dollars (a leftover from before receipts). Convert at the
boundary using `dollarsToCents` from `@/lib/receipts`.

**Time.** Display through `@/lib/datetime` (`formatBusinessDateTime`, etc.).
Never `format(parseISO(...))` directly. The intelligence engine uses
`parseISO` only for math, never display.

**Pure functions.** Every module under `src/lib/intelligence/` is pure — no
React, no I/O, no mutations. The React surface lives in
`src/components/intelligence/`. This keeps the AI tool layer (Phase 7)
implementable without circular deps.

**Determinism.** `runAttentionRules(data, now)` returns the same items with
the same ids for the same inputs. This is required for stable snooze keys and
for snapshot tests.

**No PII to AI without reason.** `buildAiContext` (Phase 7) MUST redact
phones / emails unless the AI is being explicitly asked to draft a message to
that customer.

---

## Adding a new attention rule

1. Write the rule function in `rules.ts`:
   ```ts
   function ruleNewThing(data: AppData, now: Date): AttentionItem[] {
     return data.something
       .filter(/* condition */)
       .map<AttentionItem>((entity) => ({
         id: attId("new_thing", entity.id),
         type: "new_thing",
         category: "...",
         priority: "...",
         source: "rule",
         title: "...",
         why: "Why it matters in one or two sentences.",
         action: { label: "...", linkUrl: "..." },
         entityType: "...",
         entityId: entity.id,
         detectedAt: isoNow(now),
       }));
   }
   ```
2. Add it to the `ALL_RULES` array.
3. Add a threshold to `ATTENTION_THRESHOLDS` if applicable — never inline magic numbers.
4. Write tests covering: fires when condition true, doesn't fire when false (auto-resolve), id stability.
5. Bump the test count in `roadmap.md`.

---

## Adding a new derived metric

1. Add a pure function to `derived-metrics.ts`.
2. Add the result type to `types.ts`.
3. Re-export both from `index.ts`.
4. Add tests in `__tests__/derived-metrics.test.ts`.
5. The same function is what Phase 7's AI tools will call — keep the API stable.

---

## Test playbook

Run unit tests:
```
npm run test
```

Manual smoke for Phase 1 (in dev — `npm run dev`):
1. Dashboard renders the "Command Core · Needs Attention" card.
2. With a fresh seed: empty state shows "Nothing needs your attention."
3. Submit a public booking — within minutes, `pending_booking_stale` does NOT yet appear (under threshold). Edit the appointment's `createdAt` in Supabase to push it past 6 hours → item appears as high. Push to 24 h → escalates to critical.
4. Mark a booking as `pending_approval` with `depositPaid=true` — `deposit_paid_unapproved` appears as critical.
5. Mark a job complete with no final price — `completed_no_final_price` appears.
6. Generate a receipt → `completed_no_receipt` disappears (auto-resolve).
7. Snooze an item (1h / Tomorrow / Next week) — disappears, "X snoozed/dismissed" link appears, restore brings it back.
8. Refresh the page — snooze persists across refresh; cross-tab open and dismiss in one tab → other tab updates within ~1 s via `storage` event.

---

## What's NOT in Phase 1 (to avoid surprise)

- No AI provider wired. No prompt is sent anywhere. The intelligence layer is fully local.
- No external web search. `searchWeb()` throws a "not configured" error.
- No Google OAuth. `google_connections` table not created.
- No animated orb. The dashboard card uses the existing visual language; the Phase 6 orb lands later.
- No new database tables. Attention items are computed live; snooze state is localStorage.

These are deliberate boundaries so Phase 1 ships safely. Each subsequent phase
adds one well-defined capability without touching the others.
