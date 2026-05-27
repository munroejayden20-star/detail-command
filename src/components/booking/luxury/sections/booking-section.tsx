/* ============================================================================
 * BookingSection — chrome wrapping the multi-step form.
 *
 * This file only renders the *frame*; the actual form lives in form-steps/
 * and is passed in as children so the orchestrator can keep state.
 * ========================================================================== */

import type { ReactNode } from "react";
import { Hairline, Reveal, RevealText, SectionMarker } from "../primitives";

export function BookingSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section id="book" className="relative isolate overflow-hidden bg-obsidian-900/60 py-24 md:py-32 scroll-mt-24">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(221,41,20,0.18),transparent_60%)]" />
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-4">
            <div className="md:sticky md:top-32">
              <SectionMarker index="08" label="The Configurator" />
              <RevealText
                text="Build your detail."
                italics={[1, 2]}
                as="h2"
                className="mt-8 font-sans text-[clamp(2.2rem,4.6vw,3.4rem)] font-extralight leading-[1] tracking-[-0.02em] text-platinum-50"
              />
              <Reveal delay={0.2}>
                <p className="mt-6 max-w-[34ch] text-[14.5px] leading-relaxed text-platinum-300/85">
                  Seven steps, under two minutes. Pricing updates as you go. You'll see exactly what's
                  on the menu before you commit.
                </p>
              </Reveal>
              <Reveal delay={0.35}>
                <div className="mt-10 space-y-3 text-[12.5px] text-platinum-300/85">
                  <ConfigBullet>You confirm — I review</ConfigBullet>
                  <ConfigBullet>Photos are optional</ConfigBullet>
                  <ConfigBullet>Final price after on-site inspection</ConfigBullet>
                </div>
              </Reveal>
            </div>
          </div>

          <div className="md:col-span-8">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfigBullet({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-platinum-300/85">
      <span className="h-1 w-1 rounded-full bg-ember-400" />
      <span>{children}</span>
    </p>
  );
}
