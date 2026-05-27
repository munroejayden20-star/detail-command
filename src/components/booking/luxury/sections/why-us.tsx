/* ============================================================================
 * WhyUs — pull-quote + numbered reasons + stats strip.
 * ========================================================================== */

import { Star } from "lucide-react";
import {
  AnimatedCounter,
  Hairline,
  Reveal,
  RevealText,
  SectionMarker,
} from "../primitives";

export function WhyUs() {
  const reasons: { title: string; body: string }[] = [
    { title: "I show up, every time",       body: "No 4-hour windows. No subcontractor. I confirm the time, then I'm there."   },
    { title: "Hours, not minutes",          body: "A real detail can be 4–8 hours. A car wash is 20 minutes. We're not the same job." },
    { title: "Care for the small things",  body: "Door jambs, vents, trim, wheel wells. The parts shop-detailers skip."        },
    { title: "Safe products, careful tools",body: "pH-balanced cleaners, microfiber by zone, no rotary on first-pass paint."   },
    { title: "Your driveway is the studio", body: "Mobile-only means I bring tools matched to your space. No tow to a shop."   },
  ];

  return (
    <section className="relative isolate bg-obsidian-950/55 py-24 md:py-40">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_40%_at_0%_100%,rgba(168,114,70,0.12),transparent_70%)]" />
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionMarker index="05" label="Why this, not a car wash" />
            <RevealText
              text="The difference is in what they skip."
              italics={[2, 5]}
              as="h2"
              className="mt-8 font-sans text-[clamp(2rem,4.8vw,3.4rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50"
            />
            <Reveal delay={0.2}>
              <p className="mt-7 max-w-[40ch] text-[14.5px] leading-relaxed text-platinum-300/85">
                I'm not chasing volume. I take fewer jobs and finish them properly. Here's what that
                buys you when you book.
              </p>
            </Reveal>
            <Reveal delay={0.35}>
              <div className="mt-10 flex items-center gap-4">
                <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                <Star className="h-4 w-4 fill-ember-400 text-ember-400" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                  Detailer-owned · since 2022
                </span>
              </div>
            </Reveal>
          </div>

          <ol className="md:col-span-7 space-y-3">
            {reasons.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.08}>
                <li className="group relative grid grid-cols-[auto_1fr] gap-6 border-t border-white/10 py-7 last:border-b">
                  <span className="font-mono text-[12px] tracking-[0.18em] text-ember-300 mt-1.5">
                    /{String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-sans text-xl font-light text-platinum-50 md:text-2xl">
                      <span className="font-display italic font-light text-platinum-100">{r.title}</span>
                    </h3>
                    <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-platinum-300/85">{r.body}</p>
                  </div>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 h-px w-0 bg-ember-400 transition-all duration-700 group-hover:w-full"
                  />
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-4 border-t border-white/10 pt-10 md:grid-cols-4 md:gap-10">
          <Stat n={420} suffix="+" label="cars detailed" />
          <Stat n={3}   suffix=" hr"   label="avg detail time" />
          <Stat n={100} suffix="%"     label="mobile · we come to you" />
          <Stat n={5}   suffix="★"     label="reviews · across platforms" />
        </div>
      </div>
    </section>
  );
}

function Stat({ n, suffix, label }: { n: number; suffix?: string; label: string }) {
  return (
    <Reveal>
      <div>
        <p className="font-sans text-4xl font-extralight text-platinum-50 md:text-5xl">
          <AnimatedCounter value={n} suffix={suffix} />
        </p>
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/70">
          {label}
        </p>
      </div>
    </Reveal>
  );
}
