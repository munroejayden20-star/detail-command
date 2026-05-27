/* ============================================================================
 * Process — vertical timeline with hairlines drawing in as user scrolls.
 *
 * Each step is a stacked row: number, italic title, body. The connecting
 * thread on the left is a single SVG path that draws itself via stroke-
 * dashoffset on view-enter.
 * ========================================================================== */

import { Hairline, Reveal, RevealText, SectionMarker } from "../primitives";

export function Process() {
  const steps: { title: string; body: string }[] = [
    { title: "Configure",    body: "Walk through the configurator — package, vehicle, add-ons, date. Photos help."     },
    { title: "Confirm",      body: "I review and reach out — usually within hours — to lock the time and final price." },
    { title: "Arrive",       body: "I pull up to your driveway with the full kit. Water spigot + outlet is all I need."},
    { title: "Detail",       body: "Hours, not minutes. Door jambs, trim, vents, wheel barrels, glass — all of it."    },
    { title: "Hand it back", body: "You walk out to a car you actually want to look at again. Reschedule any time."    },
  ];

  return (
    <section id="process" className="relative isolate bg-obsidian-950/55 py-24 md:py-40 scroll-mt-24">
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="md:sticky md:top-32">
              <SectionMarker index="03" label="Process" />
              <RevealText
                text="Five steps. No surprises."
                italics={[2]}
                as="h2"
                className="mt-8 font-sans text-[clamp(2rem,4.5vw,3.2rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50"
              />
              <Reveal delay={0.2}>
                <p className="mt-6 max-w-[36ch] text-[14.5px] leading-relaxed text-platinum-300/80">
                  The whole arc, written down. The booking page is just step one — I take it from there.
                </p>
              </Reveal>
            </div>
          </div>

          <ol className="md:col-span-8 relative">
            <span
              aria-hidden
              className="absolute left-[20px] top-3 bottom-0 w-px bg-gradient-to-b from-ember-500/0 via-ember-500/40 to-ember-500/0 md:left-[26px]"
            />
            {steps.map((s, i) => (
              <li key={s.title} className="relative pl-16 pb-12 last:pb-0 md:pl-24">
                {/*
                 * Number sits OUTSIDE Reveal — Reveal is a motion.div with a
                 * `transform` style, which creates a containing block per CSS
                 * spec and would capture this absolute span into the text area.
                 */}
                <span className="absolute left-0 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-obsidian-900 md:h-[56px] md:w-[56px]">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-ember-300 md:text-[12.5px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <Reveal delay={i * 0.08}>
                  <h3 className="font-sans text-2xl font-light text-platinum-50">
                    <span className="font-display italic font-light text-ember-200/95">{s.title}.</span>
                  </h3>
                  <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-platinum-300/85">
                    {s.body}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
