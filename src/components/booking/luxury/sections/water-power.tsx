/* ============================================================================
 * WaterPower — "What I need from you" info block. Calmer section.
 * Two-column layout with a hand-set utility diagram.
 * ========================================================================== */

import type { ReactNode } from "react";
import { Droplets, Zap } from "lucide-react";
import {
  CarbonWeave,
  GrainOverlay,
  Hairline,
  Reveal,
  RevealText,
  SectionMarker,
} from "../primitives";

export function WaterPower({ customText }: { customText?: string }) {
  const trimmed = customText?.trim();
  return (
    <section className="relative isolate bg-obsidian-900/60 py-24 md:py-32">
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16 md:items-center">
          <div className="md:col-span-5">
            <SectionMarker index="06" label="Site prep" />
            <RevealText
              text="What I need from you, on the day."
              italics={[2, 7]}
              as="h2"
              className="mt-8 font-sans text-[clamp(1.8rem,4vw,3rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50"
            />
          </div>

          <div className="md:col-span-7">
            <Reveal>
              <div className="relative overflow-hidden border border-white/10 bg-obsidian-850/70 p-7 md:p-10" style={{ borderRadius: 2 }}>
                <CarbonWeave opacity={0.3} />
                <GrainOverlay opacity={0.06} />

                <div className="relative grid grid-cols-2 gap-6">
                  <UtilityPill
                    icon={<Droplets className="h-5 w-5 text-platinum-100" />}
                    title="Water"
                    body="Outdoor spigot, standard hose hookup."
                  />
                  <UtilityPill
                    icon={<Zap className="h-5 w-5 text-platinum-100" />}
                    title="Power"
                    body="A standard 120V outlet within 50 ft."
                  />
                </div>

                <Hairline className="my-7" />

                {trimmed ? (
                  <p className="relative whitespace-pre-line text-[14.5px] leading-relaxed text-platinum-200/90">{trimmed}</p>
                ) : (
                  <>
                    <p className="relative text-[14.5px] leading-relaxed text-platinum-200/90">
                      I bring every tool, product, and pad I need. From you, the only request is access
                      to water and an outlet. If neither works for your spot — note it in the configurator
                      and I'll bring extra gear.
                    </p>
                    <p className="relative mt-3 text-[13px] leading-relaxed text-platinum-300/70">
                      Apartment, garage with a covered driveway, office lot — all fine. Just point me to
                      where you'd like the car parked, and I'll handle the rest.
                    </p>
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function UtilityPill({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-obsidian-900">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">{title}</p>
        <p className="mt-1 text-[13.5px] text-platinum-100">{body}</p>
      </div>
    </div>
  );
}
