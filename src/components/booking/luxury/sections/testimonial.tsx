/* ============================================================================
 * Testimonial — single anchor quote. Calmer beat after WhyUs.
 * ========================================================================== */

import { Hairline, Reveal, RevealText, SectionMarker } from "../primitives";

export function Testimonial() {
  return (
    <section className="relative isolate bg-obsidian-950/55 py-24 md:py-36">
      <Hairline className="absolute top-0" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_50%,rgba(168,114,70,0.07),transparent_70%)]" />
      <div className="mx-auto max-w-[1100px] px-5 md:px-10">
        <SectionMarker index="07" label="From a customer" align="center" />
        <div className="mt-12 text-center">
          <RevealText
            text="“I expected a clean car. I got a different car back.”"
            italics={[3, 6, 7, 8]}
            as="blockquote"
            className="mx-auto max-w-[26ch] font-sans text-[clamp(1.8rem,4.6vw,3.4rem)] font-extralight leading-[1.1] tracking-[-0.02em] text-platinum-50"
            stagger={0.04}
          />
          <Reveal delay={0.4}>
            <div className="mt-10 flex items-center justify-center gap-3 text-platinum-300/85">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">— D. Chen</span>
              <span className="h-px w-10 bg-white/20" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em]">Vancouver · 2025</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
