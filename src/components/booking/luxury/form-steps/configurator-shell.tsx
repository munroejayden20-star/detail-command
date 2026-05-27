/* ============================================================================
 * ConfiguratorShell — the form chrome that wraps all 7 steps.
 *
 * Owns: status bar (step number + label + live estimate + liquid progress),
 * AnimatePresence step transitions (slide + blur), honeypot, error banner,
 * back / continue / submit footer. Per-step body comes from `step-N-*.tsx`.
 * Validation is delegated to `makeCanProceed` (in ./validation).
 * ========================================================================== */

import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import type { PublicService, PublicDepositInfo } from "@/lib/booking-api";
import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/config";
import type { PricingConfig } from "@/lib/pricing/types";
import { EmberCTA, LiquidProgress } from "../primitives";
import type { FormState } from "./types";
import { TOTAL_STEPS } from "./types";
import { Step1Service } from "./step-1-service";
import { Step2Addons } from "./step-2-addons";
import { Step3Vehicle } from "./step-3-vehicle";
import { Step4DateTime } from "./step-4-datetime";
import { Step5Contact } from "./step-5-contact";
import { Step6Access } from "./step-6-access";
import { Step7Review } from "./step-7-review";

const STEP_LABELS = ["Service", "Add-ons", "Vehicle", "Schedule", "Contact", "Access", "Confirm"];

export function ConfiguratorShell({
  step,
  setStep,
  form,
  set,
  services,
  estimatedPrice,
  disclaimer,
  canProceed,
  submitting,
  submitError,
  onSubmit,
  bookedSlots,
  deposit,
  pricingConfig = DEFAULT_PRICING_CONFIG,
}: {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  services: PublicService[];
  estimatedPrice: number;
  disclaimer?: string;
  canProceed: () => boolean;
  submitting: boolean;
  submitError: string;
  onSubmit: () => void;
  bookedSlots: { start: string; end: string }[];
  deposit?: PublicDepositInfo;
  /** Phase O — owner-tuned engine config. Defaults to DEFAULT_PRICING_CONFIG
   *  when caller hasn't loaded the dynamic config yet. */
  pricingConfig?: PricingConfig;
}) {
  const depositActive = !!deposit?.enabled && !!deposit.required;
  const progress = (step - 1) / (TOTAL_STEPS - 1);

  function submitHandler(e: FormEvent) {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      if (canProceed()) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    } else {
      onSubmit();
    }
  }

  return (
    <form
      id="booking-card"
      onSubmit={submitHandler}
      className="relative overflow-hidden border border-white/10 bg-obsidian-850/85 backdrop-blur-xl"
      style={{ borderRadius: 2 }}
    >
      {/* Top status bar */}
      <div className="border-b border-white/10 px-6 py-5 md:px-9">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-[0.18em] text-ember-300">
              {String(step).padStart(2, "0")}<span className="text-platinum-300/40">/{String(TOTAL_STEPS).padStart(2, "0")}</span>
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-200/85">
              {STEP_LABELS[step - 1]}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/65">Est.</span>
            <motion.span
              key={estimatedPrice}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="font-sans text-lg font-light text-platinum-50"
            >
              {estimatedPrice > 0 ? `$${estimatedPrice}` : "—"}
            </motion.span>
          </div>
        </div>
        <div className="mt-4">
          <LiquidProgress value={progress} />
        </div>
      </div>

      {/* Step body */}
      <div className="relative min-h-[420px] px-6 py-9 md:px-9 md:py-11">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0,  filter: "blur(0)"   }}
            exit   ={{ opacity: 0, y: -22, filter: "blur(10px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && <Step1Service services={services} form={form} set={set} pricingConfig={pricingConfig} />}
            {step === 2 && <Step2Addons  services={services} form={form} set={set} estimatedPrice={estimatedPrice} />}
            {step === 3 && <Step3Vehicle form={form} set={set} />}
            {step === 4 && <Step4DateTime form={form} set={set} bookedSlots={bookedSlots} />}
            {step === 5 && <Step5Contact  form={form} set={set} />}
            {step === 6 && <Step6Access   form={form} set={set} />}
            {step === 7 && (
              <Step7Review
                form={form}
                services={services}
                estimatedPrice={estimatedPrice}
                disclaimer={disclaimer}
                deposit={deposit}
                pricingConfig={pricingConfig}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Honeypot — left in place, off-screen + ARIA-hidden. */}
        <div aria-hidden style={{ position: "absolute", left: -9999, opacity: 0 }}>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => set({ website: e.target.value })}
          />
        </div>

        {submitError ? (
          <div className="mt-6 border-l-2 border-ember-500 bg-ember-500/[0.07] px-4 py-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">Submission failed</p>
            <p className="mt-1 text-[13.5px] text-platinum-100">{submitError}</p>
          </div>
        ) : null}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-obsidian-900/60 px-6 py-5 md:px-9">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-platinum-200 transition-colors hover:text-ember-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
        ) : (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/65">
            Start of configurator
          </span>
        )}

        {step < TOTAL_STEPS ? (
          <EmberCTA
            type="submit"
            disabled={!canProceed()}
            size="md"
          >
            Continue
            <ArrowRight className="h-3.5 w-3.5" />
          </EmberCTA>
        ) : (
          <EmberCTA
            type="submit"
            disabled={submitting}
            size="md"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {depositActive ? "Routing payment" : "Submitting"}
              </>
            ) : depositActive ? (
              <>
                Pay deposit & submit
                <CheckCircle2 className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Submit request
                <CheckCircle2 className="h-3.5 w-3.5" />
              </>
            )}
          </EmberCTA>
        )}
      </div>
    </form>
  );
}
