/* ============================================================================
 * Services
 *
 * NOT a card grid. Each service is a "spec sheet" tile — number, italic
 * service name, tiny scope list, ember price chip, duration tag. Tilt on
 * hover. Discount-bearing tiles flip into a copper border.
 *
 * Asymmetric layout: 12-col grid where tiles take 7/5 alternating, so the
 * eye traces a diagonal down the page rather than scanning rows.
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Clock } from "lucide-react";
import type { PublicService } from "@/lib/booking-api";
import type { PricingConfig } from "@/lib/pricing/types";
import { computeServicePriceRange } from "@/lib/pricing/engine";
import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/config";
import {
  CarbonWeave,
  Hairline,
  Reveal,
  RevealText,
  SectionMarker,
  TiltCard,
} from "../primitives";
import { activeDiscount, discBadgeText, fmtDuration } from "./shared";

export function Services({
  services,
  onSelect,
  pricingConfig = DEFAULT_PRICING_CONFIG,
}: {
  services: PublicService[];
  onSelect: (serviceId: string) => void;
  pricingConfig?: PricingConfig;
}) {
  const packages = services.filter((s) => !s.isAddon);
  return (
    <section id="services" className="relative isolate overflow-hidden bg-obsidian-900/60 py-24 md:py-40 scroll-mt-24">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_50%_at_100%_0%,rgba(221,41,20,0.10),transparent_60%)]" />
      <Hairline className="absolute top-0" />

      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12 items-end">
          <div className="md:col-span-7">
            <SectionMarker index="02" label="Service Packages" />
            <RevealText
              text="Pick a level. Or talk to me and we'll build it."
              italics={[1, 5]}
              as="h2"
              className="mt-8 font-sans text-[clamp(2rem,5vw,3.6rem)] font-extralight leading-[1.02] tracking-[-0.02em] text-platinum-50"
            />
          </div>
          <div className="md:col-span-5">
            <Reveal delay={0.2}>
              <p className="max-w-[40ch] text-[14.5px] leading-relaxed text-platinum-300/85">
                Each package is a starting frame, not a quote. After you configure, I'll see the car
                in person and lock the number — sometimes lower, never silently higher.
              </p>
            </Reveal>
          </div>
        </div>

        {packages.length === 0 ? (
          <Reveal>
            <div className="mt-16 rounded-sm border border-white/10 bg-obsidian-850 p-12 text-center">
              <p className="text-platinum-300/80">Services are being curated. Check back shortly.</p>
            </div>
          </Reveal>
        ) : (
          <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-7">
            {packages.map((s, i) => {
              const wide = i % 2 === 0;
              const span = wide ? "md:col-span-7" : "md:col-span-5";
              return (
                <Reveal key={s.id} delay={i * 0.06} className={span}>
                  <ServicePlate
                    service={s}
                    index={i + 1}
                    onSelect={onSelect}
                    pricingConfig={pricingConfig}
                  />
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicePlate({
  service: s,
  index,
  onSelect,
  pricingConfig,
}: {
  service: PublicService;
  index: number;
  onSelect: (serviceId: string) => void;
  pricingConfig: PricingConfig;
}) {
  const disc = activeDiscount(s);
  const undiscountedRange = computeServicePriceRange(
    disc ? { ...s, discount: undefined } : s,
    pricingConfig,
  );
  const discountedRange = computeServicePriceRange(s, pricingConfig);
  const priceLow = discountedRange.low;
  const priceHigh = discountedRange.high;

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    if (!s.description) return;
    function measure() {
      const el = descRef.current;
      if (!el) return;
      if (el.dataset.clamped === "true") {
        setOverflows(el.scrollHeight - 1 > el.clientHeight);
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (descRef.current) ro.observe(descRef.current);
    return () => ro.disconnect();
  }, [s.description]);

  return (
    <TiltCard className="h-full">
      <article
        className={`group relative flex h-full min-h-[300px] flex-col justify-between overflow-hidden border bg-obsidian-850/80 p-7 md:p-9 ${
          disc
            ? "border-copper-400/40 hover:border-copper-300/70"
            : "border-white/10 hover:border-ember-400/40"
        }`}
        style={{ borderRadius: 2 }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-ember-500/20 blur-3xl transition-opacity duration-500 group-hover:bg-ember-500/35"
        />
        <CarbonWeave opacity={0.3} />

        <div className="relative flex items-start justify-between gap-6">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-ember-300">
              {String(index).padStart(2, "0")} / Package
            </span>
            {(() => {
              // Trim + regex split so a trailing space in the DB name doesn't
              // dump the full name into the orange italic block.
              const parts = s.name.trim().split(/\s+/);
              const lead = parts.slice(0, -1).join(" ");
              const tail = parts[parts.length - 1] || s.name;
              return (
                <h3 className="mt-3 font-sans text-2xl font-light tracking-tight text-platinum-50 md:text-[28px]">
                  {lead ? <span className="block">{lead}</span> : null}
                  <span className="block font-display italic font-light text-ember-200/95">
                    {tail}
                  </span>
                </h3>
              );
            })()}
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/70">
              From
            </span>
            {disc ? (
              <>
                <p className="font-mono text-[12px] text-platinum-300/50 line-through">${undiscountedRange.low}</p>
                <p className="font-sans text-3xl font-light text-copper-200">${priceLow}</p>
              </>
            ) : (
              <p className="font-sans text-3xl font-light text-platinum-50">${priceLow}</p>
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-300/70">
              to ${priceHigh}
            </p>
          </div>
        </div>

        {s.description ? (
          <div className="relative mt-7">
            <p
              ref={descRef}
              data-clamped={!expanded}
              className={`max-w-[44ch] whitespace-pre-line text-[13.5px] leading-relaxed text-platinum-300/85 transition-all ${
                expanded ? "" : "line-clamp-4"
              }`}
            >
              {s.description}
            </p>
            {overflows ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.26em] text-ember-300 transition-colors hover:text-ember-200"
                aria-expanded={expanded}
              >
                {expanded ? "Show less" : "Read more"}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="relative mt-7 max-w-[44ch] text-[13.5px] leading-relaxed text-platinum-300/85">
            Configure to see the full scope tailored to your vehicle.
          </p>
        )}

        <div className="relative mt-10 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-platinum-300/70">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-ember-300" />
              {fmtDuration(s.durationMinutes)}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span>Mobile</span>
            {disc ? (
              <>
                <span className="h-3 w-px bg-white/15" />
                <span className="text-copper-200">{discBadgeText(disc)}</span>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            className="group/btn inline-flex items-center gap-2 border-b border-white/30 pb-1 font-mono text-[11px] uppercase tracking-[0.26em] text-platinum-50 transition-colors hover:border-ember-400 hover:text-ember-300"
          >
            Configure
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </button>
        </div>
      </article>
    </TiltCard>
  );
}
