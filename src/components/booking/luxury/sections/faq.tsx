/* ============================================================================
 * FAQ — accordion with hairlines, no boxes.
 * ========================================================================== */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PublicBookingFaq } from "@/lib/booking-api";
import { Hairline, RevealText, SectionMarker } from "../primitives";

export function FAQ({ faqs }: { faqs?: PublicBookingFaq[] }) {
  const DEFAULT_FAQS: { q: string; a: string }[] = [
    { q: "Do you actually come to me?",                  a: "Yes — mobile-only is the whole identity. I pull up to your home, office, or wherever you can park. I bring water tanks if your spot has no spigot, just let me know on the form." },
    { q: "How long does a detail take?",                 a: "An exterior-only is 1.5–2.5 hrs. A full interior + exterior is 4–6 hrs. Restoration jobs can run 6–9 hrs. I'll give you an honest window when I confirm." },
    { q: "Pet hair? Stains? Smoke?",                     a: "Yes to all three. Heavy cases may bump the price up to the high end of the band, but never silently — I'll talk through any change before I start." },
    { q: "What if I don't have water or power?",         a: "I can bring a portable water tank and a battery setup. Note it in the form's access step and I'll plan around it." },
    { q: "Are the photos in the form required?",         a: "No, but they help. A 30-second walkaround on your phone tells me everything about scope before I arrive — fewer surprises, better quote accuracy." },
    { q: "Where do you service?",                        a: "Vancouver, WA and the Portland, OR metro. A bit further out — Camas, Battle Ground, Hillsboro — ask and we'll usually make it work." },
  ];
  const items = ((faqs && faqs.length > 0 ? faqs : DEFAULT_FAQS) as { q: string; a: string }[]).filter(
    (f) => f.q?.trim() && f.a?.trim(),
  );
  if (items.length === 0) return null;

  return (
    <section id="faq" className="relative isolate bg-obsidian-950/55 py-24 md:py-36 scroll-mt-24">
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1100px] px-5 md:px-10">
        <SectionMarker index="09" label="Questions" />
        <RevealText
          text="Common questions. Honest answers."
          italics={[1, 4]}
          as="h2"
          className="mt-8 font-sans text-[clamp(2rem,4.8vw,3.2rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50"
        />
        <div className="mt-12">
          {items.map((f, i) => (
            <FAQItem key={`${f.q}-${i}`} q={f.q} a={f.a} index={i + 1} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  q,
  a,
  index,
  defaultOpen,
}: {
  q: string;
  a: string;
  index: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-white/10 last:border-b">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-6 py-7 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="font-mono text-[11px] tracking-[0.18em] text-ember-300">
          /{String(index).padStart(2, "0")}
        </span>
        <span className="flex-1 font-sans text-lg font-light text-platinum-50 transition-colors group-hover:text-ember-200 md:text-2xl">
          <span className="font-display italic">{q}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15"
        >
          <span className="block h-px w-3 bg-platinum-100" />
          <span className="absolute block h-3 w-px bg-platinum-100" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="ml-[36px] max-w-[64ch] pb-8 text-[14.5px] leading-relaxed text-platinum-300/85">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
