/* ============================================================================
 * STEP 1 — Service
 * ========================================================================== */

import { CheckCircle2 } from "lucide-react";
import type { PublicService } from "@/lib/booking-api";
import { computeServicePriceRange } from "@/lib/pricing/engine";
import type { PricingConfig } from "@/lib/pricing/types";
import type { FormState } from "./types";
import { activeDiscount, fmtDuration, fmtPrice } from "./helpers";
import { ExpandableDescription, StepHeader } from "./shared";

export function Step1Service({
  services,
  form,
  set,
  pricingConfig,
}: {
  services: PublicService[];
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  pricingConfig: PricingConfig;
}) {
  const packages = services.filter((s) => !s.isAddon);
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step one"
        title="Choose your packages."
        body="Pick anything that applies — tap to add, tap again to remove."
      />
      {packages.length === 0 ? (
        <p className="text-platinum-300/70">No packages available right now. Check back soon.</p>
      ) : (
        <ul className="space-y-3">
          {packages.map((s) => {
            const selected = form.serviceIds.includes(s.id);
            const disc = activeDiscount(s);
            // Real envelope from the calculator engine — vehicle size,
            // condition, flags, and engine floors all factor in. When a
            // discount is active we show the undiscounted range struck
            // through and the discounted range as the live number.
            const undiscRange = computeServicePriceRange(
              disc ? { ...s, discount: undefined } : s,
              pricingConfig,
            );
            const discRange = computeServicePriceRange(s, pricingConfig);
            const lo = discRange.low;
            const hi = discRange.high;
            const toggle = () => {
              // Toggle in/out of the selection. Same pattern as add-ons —
              // the submit RPC already accepts an array of service ids.
              const next = selected
                ? form.serviceIds.filter((id) => id !== s.id)
                : [...form.serviceIds, s.id];
              set({ serviceIds: next });
            };
            return (
              <li key={s.id}>
                {/*
                 * role="button" instead of a real <button> so the description's
                 * "Read more" toggle (a real <button>) can nest legally. Outer
                 * div is keyboard-accessible via tabIndex + onKeyDown.
                 */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={toggle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle();
                    }
                  }}
                  className={`group relative w-full overflow-hidden border p-5 text-left transition-all md:p-6 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 ${
                    selected
                      ? "border-ember-400/70 bg-ember-500/[0.06]"
                      : "border-white/10 bg-white/[0.015] hover:border-white/25"
                  }`}
                  style={{ borderRadius: 2 }}
                >
                  <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4">
                    {/* check indicator — left rail, mirrors the addon UI so the
                     *  "multi-select" affordance reads immediately. */}
                    <span
                      className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                        selected ? "border-ember-400 bg-ember-500/40" : "border-white/30"
                      }`}
                      aria-hidden
                    >
                      {selected ? <CheckCircle2 className="h-3.5 w-3.5 text-platinum-50" /> : null}
                    </span>

                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">
                        Package
                      </p>
                      {(() => {
                        // See sections.tsx note — trim + regex split guards
                        // against trailing whitespace in DB names duplicating
                        // the full title into the orange italic block.
                        const parts = s.name.trim().split(/\s+/);
                        const lead = parts.slice(0, -1).join(" ");
                        const tail = parts[parts.length - 1] || s.name;
                        return (
                          <h4 className="mt-1.5 font-sans text-xl font-light text-platinum-50 md:text-[22px]">
                            {lead ? <>{lead}{" "}</> : null}
                            <span className="font-display italic font-light text-ember-200/95">
                              {tail}
                            </span>
                          </h4>
                        );
                      })()}
                      {s.description ? (
                        <div className="mt-2 max-w-[56ch]">
                          <ExpandableDescription text={s.description} clampClass="line-clamp-3" />
                        </div>
                      ) : null}
                      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/70">
                        Est. {fmtDuration(s.durationMinutes)} · Mobile
                      </p>
                    </div>
                    <div className="text-right">
                      {disc ? (
                        <>
                          <p className="font-mono text-[11px] text-platinum-300/50 line-through">{fmtPrice(undiscRange.low, undiscRange.high)}</p>
                          <p className="font-sans text-2xl font-light text-copper-200">{fmtPrice(lo, hi)}</p>
                        </>
                      ) : (
                        <p className="font-sans text-2xl font-light text-platinum-50">{fmtPrice(lo, hi)}</p>
                      )}
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/70">starting</p>
                    </div>
                  </div>

                  <span
                    aria-hidden
                    className={`absolute bottom-0 left-0 h-px bg-ember-400 transition-all duration-700 ${selected ? "w-full" : "w-0 group-hover:w-1/4"}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form.serviceIds.length > 1 ? (
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/65">
          {form.serviceIds.length} packages selected
        </p>
      ) : null}
    </div>
  );
}
