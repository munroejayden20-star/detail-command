/* ============================================================================
 * STEP 4 — Date / Time / Location
 * ========================================================================== */

import { LuxuryScheduler } from "../scheduler";
import type { FormState } from "./types";
import { Field, StepHeader, inputCls } from "./shared";

export function Step4DateTime({
  form,
  set,
  bookedSlots,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  bookedSlots: { start: string; end: string }[];
}) {
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step four"
        title="When and where."
        body="Pick a window — I'll confirm exact time when I reach out."
      />

      <LuxuryScheduler
        date={form.preferredDate}
        time={form.preferredTime}
        bookedSlots={bookedSlots}
        onDate={(d) => set({ preferredDate: d })}
        onTime={(t) => set({ preferredTime: t })}
      />

      <Field label="Service address" required hint="Where I should pull up.">
        <textarea
          rows={2}
          className={`${inputCls} resize-none`}
          placeholder="123 Main St, Vancouver, WA 98660"
          value={form.serviceAddress}
          onChange={(e) => set({ serviceAddress: e.target.value })}
        />
      </Field>
    </div>
  );
}
