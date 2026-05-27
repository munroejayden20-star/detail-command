/* ============================================================================
 * STEP 7 — Review (Configuration card) + QuoteBreakdown disclosure.
 *
 * This is the "configurator summary" moment. Mimics a Tesla / Porsche
 * configurator: spec rows organized by category, an "ESTIMATE" line at the
 * bottom, a quote breakdown disclosure, then a deposit pane when required.
 * ========================================================================== */

import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { PublicService, PublicDepositInfo } from "@/lib/booking-api";
import type { PricingConfig, Quote } from "@/lib/pricing/types";
import type { FormState } from "./types";
import { CONDITION_OPTIONS, CONTACT_OPTIONS, VEHICLE_SIZES } from "./types";
import { hashConfig } from "./helpers";
import { timeSlotsForDate } from "./slot-helpers";
import { StepHeader } from "./shared";
import { quoteOf } from "./quote";

/* ─────────────────────────────────────────────────────────────────────────────
 * QuoteBreakdown — folded-by-default disclosure showing every engine line.
 *
 * Rendered on the Step 7 review screen between the configuration sheet
 * and the deposit panel. Customers don't have to read this — the headline
 * estimate is in the configuration sheet — but if they want to know where
 * the number came from, every modifier and floor is here.
 *
 * Visual treatment matches the rest of the editorial chrome: hairline
 * border, mono kicker, ember accents. AnimatePresence on the height
 * transition so the disclosure feels intentional, not chunky.
 * ──────────────────────────────────────────────────────────────────────── */

function QuoteBreakdown({ quote }: { quote: Quote }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative overflow-hidden border border-white/10 bg-obsidian-900/55"
      style={{ borderRadius: 2 }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.025]"
      >
        <span className="flex items-baseline gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
            Quote breakdown
          </span>
          <span className="h-px w-10 bg-white/15" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/65">
            {quote.laborHours.toFixed(1)} hr
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-platinum-300"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/10"
          >
            <ul className="space-y-2 px-5 py-4">
              {quote.lines.map((line, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-4"
                >
                  <div>
                    <p className="text-[13px] text-platinum-100">{line.label}</p>
                    {line.detail ? (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/60">
                        {line.detail}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`font-sans text-base tabular-nums ${
                      line.amount < 0
                        ? "text-emerald-300/85"
                        : "text-platinum-50"
                    }`}
                  >
                    {line.amount < 0 ? "−" : "+"}${Math.abs(Math.round(line.amount))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t border-white/10 px-5 py-4">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
                Estimate
              </span>
              <span className="font-sans text-2xl text-platinum-50">
                ~${quote.estimate}
              </span>
            </div>

            {quote.minProtectionApplied || quote.minBookingApplied ? (
              <div className="space-y-1 border-t border-white/10 px-5 py-3">
                {quote.minProtectionApplied ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/55">
                    Labor floor applied · keeps the work sustainable
                  </p>
                ) : null}
                {quote.minBookingApplied ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/55">
                    Minimum booking floor applied
                  </p>
                ) : null}
              </div>
            ) : null}

            {quote.policyNotes.length > 0 ? (
              <div className="border-t border-white/10 px-5 py-3 space-y-1.5">
                {quote.policyNotes.map((n, i) => (
                  <div key={i} className="grid grid-cols-[60px_1fr] gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-300">{n.label}</span>
                    <span className="text-[12px] text-platinum-200/85">{n.detail}</span>
                  </div>
                ))}
                <p className="pt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-platinum-300/45">
                  Informational · confirmed at booking confirmation
                </p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Step7Review({
  form,
  services,
  estimatedPrice,
  disclaimer,
  deposit,
  pricingConfig,
}: {
  form: FormState;
  services: PublicService[];
  estimatedPrice: number;
  disclaimer?: string;
  deposit?: PublicDepositInfo;
  pricingConfig: PricingConfig;
}) {
  const selectedServices = services.filter((s) => form.serviceIds.includes(s.id));
  const selectedAddons   = services.filter((s) => form.addonIds.includes(s.id));
  const selectedSize     = VEHICLE_SIZES.find((s) => s.value === form.vehicleSize);
  const selectedTime     = timeSlotsForDate(form.preferredDate).find((t) => t.value === form.preferredTime);

  return (
    <div className="space-y-8">
      <StepHeader
        kicker="Step seven"
        title="Confirm your configuration."
        body="One last read-through. You can step back to edit anything."
      />

      <div className="relative overflow-hidden border border-white/10 bg-obsidian-850/85" style={{ borderRadius: 2 }}>
        <div className="border-b border-white/10 px-5 py-4 md:px-8 md:py-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
              Configuration Sheet
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/70">
              #{Math.abs(hashConfig(form)).toString(16).slice(0, 6).toUpperCase()}
            </p>
          </div>
        </div>

        <ReviewBlock kicker="Service">
          <ReviewRow
            k={selectedServices.length > 1 ? "Packages" : "Package"}
            v={selectedServices.map((s) => s.name).join(", ") || undefined}
          />
          {selectedAddons.length > 0 ? (
            <ReviewRow
              k="Add-ons"
              v={selectedAddons
                .map((a) => {
                  const q = form.addonQuantities[a.id] ?? 1;
                  return q > 1 ? `${q}× ${a.name}` : a.name;
                })
                .join(", ")}
            />
          ) : null}
          <ReviewRow k="Estimate" v={<span className="font-sans text-lg text-platinum-50">~${estimatedPrice}</span>} />
        </ReviewBlock>

        <ReviewBlock kicker="Vehicle">
          <ReviewRow k="Size"          v={selectedSize?.label} />
          {(form.vehicleYear || form.vehicleMake || form.vehicleModel) ? (
            <ReviewRow k="Vehicle"     v={[form.vehicleYear, form.vehicleMake, form.vehicleModel, form.vehicleColor].filter(Boolean).join(" ")} />
          ) : null}
          {form.interiorCondition ? <ReviewRow k="Interior" v={CONDITION_OPTIONS.find((c) => c.value === form.interiorCondition)?.label} /> : null}
          {form.exteriorCondition ? <ReviewRow k="Exterior" v={CONDITION_OPTIONS.find((c) => c.value === form.exteriorCondition)?.label} /> : null}
          {(form.petHair || form.stains || form.heavyDirt) ? (
            <ReviewRow k="Flags" v={[form.petHair && "Pet hair", form.stains && "Stains", form.heavyDirt && "Heavy dirt"].filter(Boolean).join(", ")} />
          ) : null}
          {form.photoFiles.length > 0 ? <ReviewRow k="Photos" v={`${form.photoFiles.length} attached`} /> : null}
        </ReviewBlock>

        <ReviewBlock kicker="Appointment">
          {form.preferredDate ? <ReviewRow k="Date"     v={new Date(form.preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} /> : null}
          {form.preferredTime ? <ReviewRow k="Window"   v={selectedTime?.label} /> : null}
          {form.serviceAddress ? <ReviewRow k="Address" v={form.serviceAddress} /> : null}
        </ReviewBlock>

        <ReviewBlock kicker="Contact" last>
          <ReviewRow k="Name"      v={form.name} />
          <ReviewRow k="Phone"     v={form.phone} />
          {form.email ? <ReviewRow k="Email" v={form.email} /> : null}
          <ReviewRow k="Reach via" v={CONTACT_OPTIONS.find((c) => c.value === form.preferredContact)?.label} />
          <ReviewRow k="Water"     v={form.waterAccess ? "available" : "not available"} />
          <ReviewRow k="Power"     v={form.powerAccess ? "available" : "not available"} />
        </ReviewBlock>
      </div>

      <QuoteBreakdown quote={quoteOf(form, services, pricingConfig)} />

      {deposit?.enabled && deposit.required ? (
        <div className="relative overflow-hidden border border-ember-500/30 bg-ember-500/[0.05] p-5 md:p-6" style={{ borderRadius: 2 }}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ember-300">Deposit required</p>
            <p className="font-sans text-2xl font-light text-platinum-50">
              ${(deposit.amountCents / 100).toFixed(2)}
            </p>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-platinum-200/90">
            {deposit.disclaimer?.trim() || (
              deposit.autoConfirmAfterDeposit
                ? `A $${(deposit.amountCents / 100).toFixed(0)} deposit reserves your appointment. Goes toward your final price.`
                : `A $${(deposit.amountCents / 100).toFixed(0)} deposit reserves your appointment request. Goes toward your final price. Reviewed before confirmation.`
            )}
          </p>
          {deposit.appliesToTotal ? (
            <p className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/85">
              <span>Estimated remaining on completion</span>
              <span className="text-platinum-50">~${Math.max(0, estimatedPrice - deposit.amountCents / 100).toFixed(0)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/60">
        {disclaimer ?? "Final price may vary based on vehicle condition at inspection. I confirm everything before I start."}
      </p>
    </div>
  );
}

function ReviewBlock({ kicker, children, last }: { kicker: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`px-5 py-5 md:px-8 md:py-6 ${last ? "" : "border-b border-white/10"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-ember-300/85">{kicker}</p>
      <dl className="mt-3 grid grid-cols-1 gap-y-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v?: ReactNode }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 py-1.5">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/70">{k}</dt>
      <dd className="text-[13.5px] text-platinum-100">{v}</dd>
    </div>
  );
}
