/* ============================================================================
 * Manifesto — single big editorial pull quote on a near-black background.
 * The "breath" between hero and services.
 * ========================================================================== */

import { GrainOverlay, Reveal, RevealText, SectionMarker } from "../primitives";

export function Manifesto({ businessName }: { businessName: string }) {
  return (
    <section id="manifesto" className="relative isolate bg-obsidian-950/55 py-28 md:py-40 scroll-mt-24">
      <GrainOverlay opacity={0.08} />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <SectionMarker index="01" label="Manifesto" />
        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-3">
            <Reveal>
              <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.28em] text-platinum-300/75">
                A statement from
                <br />
                {businessName}
              </p>
            </Reveal>
          </div>
          <div className="md:col-span-9">
            <RevealText
              text="There are details, and there is the detail. Most car washes treat your vehicle like work. We treat it like the second-most-considered object in your life — after, maybe, your home."
              italics={[3, 5, 27, 28, 29]}
              as="p"
              className="font-sans text-[clamp(1.4rem,3.6vw,2.4rem)] font-light leading-[1.18] tracking-[-0.01em] text-platinum-100"
              stagger={0.03}
            />
            <Reveal delay={0.5}>
              <div className="mt-10 flex items-center gap-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">— Jayden</span>
                <span className="h-px w-12 bg-white/15" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/70">founder / detailer</span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
