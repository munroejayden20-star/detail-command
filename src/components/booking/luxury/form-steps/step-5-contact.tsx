/* ============================================================================
 * STEP 5 — Contact
 * ========================================================================== */

import type { FormState } from "./types";
import { CONTACT_OPTIONS } from "./types";
import { Field, SelectChips, StepHeader, inputCls } from "./shared";

export function Step5Contact({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step five"
        title="How do I reach you?"
        body="Used to confirm and follow up. Nothing else."
      />
      <Field label="Full name" required>
        <input className={inputCls} value={form.name}  autoComplete="name" placeholder="Alex Johnson"     onChange={(e) => set({ name:  e.target.value })} />
      </Field>
      <Field label="Phone" required>
        <input type="tel"   className={inputCls} value={form.phone} autoComplete="tel"  placeholder="(360) 555-1234" onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label="Email" hint="Optional. For confirmation emails.">
        <input type="email" className={inputCls} value={form.email} autoComplete="email" placeholder="alex@example.com" onChange={(e) => set({ email: e.target.value })} />
      </Field>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Reach me by</p>
        <div className="mt-3">
          <SelectChips
            options={CONTACT_OPTIONS}
            value={form.preferredContact}
            onChange={(v) => set({ preferredContact: v })}
          />
        </div>
      </div>
    </div>
  );
}
