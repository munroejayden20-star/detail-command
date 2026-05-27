/* ============================================================================
 * STEP 2 — Add-ons
 * ========================================================================== */

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { PublicService } from "@/lib/booking-api";
import type { FormState } from "./types";
import { midPrice } from "./helpers";
import { ExpandableDescription, QuantityStepper, StepHeader } from "./shared";

export function Step2Addons({
  services,
  form,
  set,
  estimatedPrice,
}: {
  services: PublicService[];
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  estimatedPrice: number;
}) {
  const addons = services.filter((s) => s.isAddon);
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step two"
        title="Add to your scope."
        body="Optional. Stack what's relevant — skip what isn't."
      />
      {addons.length === 0 ? (
        <p className="text-platinum-300/70">No add-ons listed. Continue to vehicle details.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {addons.map((s) => {
            const checked = form.addonIds.includes(s.id);
            const qty = form.addonQuantities[s.id] ?? 1;
            const toggle = () => {
              if (checked) {
                const ids = form.addonIds.filter((id) => id !== s.id);
                // Clean up the quantity record when the addon goes off.
                const nextQty = { ...form.addonQuantities };
                delete nextQty[s.id];
                set({ addonIds: ids, addonQuantities: nextQty });
              } else {
                set({
                  addonIds: [...form.addonIds, s.id],
                  addonQuantities: { ...form.addonQuantities, [s.id]: 1 },
                });
              }
            };
            const setQty = (n: number) => {
              set({ addonQuantities: { ...form.addonQuantities, [s.id]: n } });
            };
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={checked}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }}
                className={`group relative flex items-start justify-between gap-4 overflow-hidden border p-4 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 ${
                  checked
                    ? "border-ember-400/70 bg-ember-500/[0.06]"
                    : "border-white/10 bg-white/[0.015] hover:border-white/25"
                }`}
                style={{ borderRadius: 2 }}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-sm border transition-colors ${
                        checked ? "border-ember-400 bg-ember-500/40" : "border-white/30"
                      }`}
                    >
                      {checked ? <CheckCircle2 className="h-3.5 w-3.5 text-platinum-50" /> : null}
                    </span>
                    <span className="font-sans text-[14.5px] text-platinum-50">
                      {s.name}
                      {checked && qty > 1 ? (
                        <span className="ml-2 font-mono text-[11px] tracking-[0.18em] text-ember-300">
                          ×{qty}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {s.description ? (
                    <div className="ml-8 mt-1">
                      <ExpandableDescription text={s.description} clampClass="line-clamp-2" />
                    </div>
                  ) : null}
                  {checked ? (
                    <div className="ml-8 mt-3 flex items-center gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-300/65">
                        Quantity
                      </span>
                      <QuantityStepper value={qty} onChange={setQty} />
                    </div>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-platinum-100">
                    +${midPrice(s)}
                  </span>
                  {checked && qty > 1 ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/85">
                      subtotal ~${midPrice(s) * qty}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-white/10 pt-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-platinum-300/85">Running estimate</span>
          <span className="font-sans text-2xl font-light text-platinum-50">
            <motion.span
              key={estimatedPrice}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              ~${estimatedPrice}
            </motion.span>
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/55">
          Final price after on-site inspection
        </p>
      </div>
    </div>
  );
}
