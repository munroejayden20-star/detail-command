/* ============================================================================
 * FinalCTA — big italic call, ember orb behind.
 * ========================================================================== */

import { ArrowRight } from "lucide-react";
import {
  CarbonWeave,
  EmberCTA,
  EmberOrb,
  Hairline,
  Reveal,
  RevealText,
  SectionMarker,
} from "../primitives";
import { scrollToId } from "./shared";

export function FinalCTA({ onBook }: { onBook: () => void }) {
  return (
    <section className="relative isolate overflow-hidden bg-obsidian-950/55 py-32 md:py-48">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <EmberOrb size={680} className="relative opacity-80" />
      </div>
      <CarbonWeave opacity={0.5} />
      <Hairline className="absolute top-0" />
      <div className="relative mx-auto max-w-[1320px] px-5 text-center md:px-10">
        <SectionMarker index="10" label="Book it" align="center" />
        <div className="mx-auto mt-10 max-w-[18ch]">
          <RevealText
            text="Your driveway. My studio."
            italics={[1, 3]}
            as="h2"
            className="font-sans text-[clamp(2.6rem,8vw,6rem)] font-extralight leading-[0.98] tracking-[-0.03em] text-platinum-50"
          />
        </div>
        <Reveal delay={0.3}>
          <p className="mx-auto mt-8 max-w-[42ch] text-[15px] leading-relaxed text-platinum-200/85">
            Booked direct. Confirmed within hours. Detailing that takes the time it takes — done at home.
          </p>
        </Reveal>
        <Reveal delay={0.5}>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <EmberCTA onClick={onBook} size="lg">
              Open the Configurator
              <ArrowRight className="h-4 w-4" />
            </EmberCTA>
            <EmberCTA onClick={() => scrollToId("faq")} size="lg" variant="ghost">
              Questions first
            </EmberCTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
