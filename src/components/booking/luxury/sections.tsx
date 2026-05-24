/* ============================================================================
 * Landing-page sections for the public /book route.
 *
 * Editorial / automotive identity. Every section has its own composition —
 * no shared "card grid" everywhere. Sections share primitives (Hairline,
 * RevealText, MouseSpotlight, EmberOrb) but their layouts vary.
 *
 * Public data only — `services`, `featuredPhotos`, `faqs` come from the
 * existing `get_public_booking_info` RPC. The owner profile is rendered
 * from settings the same way the original page consumed them.
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Clock,
  Droplets,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import type {
  PublicBookingFaq,
  PublicFeaturedPhoto,
  PublicService,
} from "@/lib/booking-api";
import {
  AnimatedCounter,
  CarbonWeave,
  EmberCTA,
  EmberOrb,
  GrainOverlay,
  Hairline,
  Marquee,
  MouseSpotlight,
  ParallaxLayer,
  Reveal,
  RevealText,
  SectionMarker,
  TiltCard,
} from "./primitives";

/* ─────────────────────────────────────────────────────────────────────────────
 * Shared helpers (price, discount math) — duplicated minimally from the old
 * BookingPage to keep this module self-contained. The math is trivial; the
 * point of duplication is to avoid an extra import dance.
 * ──────────────────────────────────────────────────────────────────────── */

function activeDiscount(s: PublicService) {
  const d = s.discount;
  if (!d?.active || !d.value) return null;
  if (d.expiry && new Date(d.expiry) < new Date()) return null;
  return d;
}

function applyDiscount(price: number, d: NonNullable<PublicService["discount"]>) {
  if (d.type === "percent") return Math.round(price * (1 - d.value / 100));
  return Math.max(0, price - d.value);
}

function discBadgeText(d: NonNullable<PublicService["discount"]>) {
  if (d.label) return d.label;
  return d.type === "percent" ? `${d.value}% OFF` : `$${d.value} OFF`;
}

function fmtDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours} hr`;
  }
  return `${minutes} min`;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Owner brand presets — fixed copy that anchors the editorial voice.
 * These can be overridden via Settings (Phase 6B fields on PublicBookingInfo);
 * the orchestrator passes them in. Falls back to these only when blank.
 * ──────────────────────────────────────────────────────────────────────── */

const FALLBACK_HERO_HEADLINE = "Detailed. To obsession.";
const FALLBACK_HERO_SUB =
  "A one-person mobile studio bringing concours-level finish to driveways across Vancouver and Portland.";

const MANIFESTO_LINES = [
  "Mobile-only · No shop, no waiting room",
  "Founder-operated · One pair of hands, every car",
  "Pacific Northwest · Vancouver → Portland",
  "Booked direct · No middlemen, no callbacks lost",
  "Detailed, not rushed · Hours, not minutes",
];

/* ──────────────────────────────────────────────────────────────────────────
 * TopNav
 *
 * Idle state: completely transparent, tiny brand mark left-aligned.
 * Past 80px: condenses into a hairline-divider sticky bar with backdrop blur.
 * Mobile: full-screen overlay drawer with framer-motion stagger.
 * ───────────────────────────────────────────────────────────────────────── */

export function TopNav({
  businessName,
  logoUrl,
  onBook,
}: {
  businessName: string;
  logoUrl?: string;
  onBook: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "manifesto", label: "Manifesto" },
    { id: "services",  label: "Services"  },
    { id: "process",   label: "Process"   },
    { id: "gallery",   label: "Work"      },
    { id: "faq",       label: "FAQ"       },
  ];

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background,backdrop-filter,border-color] duration-500 ${
          scrolled
            ? "bg-obsidian-950/72 backdrop-blur-xl border-b border-white/10"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 md:px-10">
          <a
            href="#home"
            onClick={(e) => { e.preventDefault(); scrollToId("home"); }}
            className="group flex items-center gap-3"
          >
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-obsidian-900">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display italic text-[15px] text-ember-300">jm</span>
              )}
              <span className="absolute inset-0 rounded-full bg-ember-500/0 transition-colors duration-300 group-hover:bg-ember-500/15" />
            </span>
            <span className="hidden text-[11px] uppercase tracking-[0.32em] text-platinum-100 sm:inline-block">
              {businessName}
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollToId(l.id)}
                className="group relative text-[11px] uppercase tracking-[0.26em] text-platinum-300/85 transition-colors hover:text-platinum-50"
              >
                {l.label}
                <span className="absolute -bottom-2 left-1/2 h-px w-0 -translate-x-1/2 bg-ember-400 transition-all duration-500 group-hover:w-full" />
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <EmberCTA onClick={onBook} size="sm" className="hidden md:inline-flex">
              Configure
              <ArrowRight className="h-3.5 w-3.5" />
            </EmberCTA>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-platinum-100 transition-colors hover:bg-white/[0.08] md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="absolute inset-0 bg-obsidian-950/96 backdrop-blur-xl" />
            <div className="relative flex h-full flex-col px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.32em] text-platinum-200">{businessName}</span>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4 text-platinum-100" />
                </button>
              </div>
              <nav className="mt-12 flex flex-col gap-7">
                {links.map((l, i) => (
                  <motion.button
                    key={l.id}
                    initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
                    transition={{ delay: 0.08 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => {
                      setOpen(false);
                      setTimeout(() => scrollToId(l.id), 100);
                    }}
                    className="text-left font-display italic text-4xl text-platinum-50 hover:text-ember-300 transition-colors"
                  >
                    {l.label}
                  </motion.button>
                ))}
              </nav>
              <div className="mt-auto">
                <Hairline />
                <div className="mt-6">
                  <EmberCTA
                    onClick={() => { setOpen(false); setTimeout(onBook, 100); }}
                    size="lg"
                    className="w-full"
                  >
                    Configure a Detail
                    <ArrowRight className="h-4 w-4" />
                  </EmberCTA>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hero
 *
 * Layout (desktop):  asymmetric two-thirds left / one-third right
 *   Left:   tiny coordinate marker, oversized italic display headline, sub,
 *           dual-CTA, marquee of brand values, scroll cue.
 *   Right:  vertical hairline timeline (founded / area / service mode)
 *           and the photographic plate (or built-in geometric fallback).
 *
 * Mobile: single-column. Plate shrinks to a thumbprint at the bottom.
 *
 * Mouse spotlight + ember orb give the section atmosphere; ParallaxLayer
 * slides the plate independently of the headline. The headline itself is
 * a RevealText with letter-stagger, with one word italicized (Fraunces).
 * ──────────────────────────────────────────────────────────────────────── */

export function Hero({
  businessName,
  serviceArea,
  heroHeadline,
  heroSubheadline,
  heroImageUrl,
  onBook,
  onServicesClick,
}: {
  businessName: string;
  serviceArea?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  heroImageUrl?: string;
  onBook: () => void;
  onServicesClick: () => void;
}) {
  // Pick a deterministic italic-target inside the headline — last word by
  // default, unless the headline already contains an em-dash, in which case
  // the segment after it becomes the italic accent. That's what makes the
  // type read as edited copy rather than generic styling.
  const headlineRaw = (heroHeadline?.trim() || FALLBACK_HERO_HEADLINE).replace(/—/g, "·");
  const words = headlineRaw.split(" ");
  // Italicize the LAST word (or the last 2 if the last is short) so accents land naturally.
  const italicIdx: number[] = [];
  if (words.length > 0) {
    italicIdx.push(words.length - 1);
    if (words.length > 2 && words[words.length - 1].length <= 4) italicIdx.unshift(words.length - 2);
  }

  const sub =
    heroSubheadline?.trim() ||
    (serviceArea
      ? `A one-person mobile studio bringing concours-level finish to driveways across ${serviceArea}.`
      : FALLBACK_HERO_SUB);

  return (
    <section
      id="home"
      className="relative isolate overflow-hidden bg-obsidian-950 text-platinum-50"
    >
      {/* Background — layered gradient + ember corner + mouse spotlight + grid */}
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#0f1218_0%,#06070a_55%,#040506_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.18] animate-lx-grid-pan"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <CarbonWeave opacity={0.4} />
        <GrainOverlay opacity={0.10} />
      </div>
      <MouseSpotlight />

      {/* Top-corner ember orb */}
      <div className="pointer-events-none absolute -right-32 -top-20 opacity-90">
        <EmberOrb size={520} />
      </div>

      <div className="relative mx-auto grid min-h-[100svh] max-w-[1320px] grid-cols-1 items-end gap-12 px-5 pb-12 pt-32 md:grid-cols-12 md:gap-10 md:px-10 md:pb-20 md:pt-36">
        {/* LEFT — editorial headline */}
        <div className="md:col-span-8">
          <Reveal delay={0.05}>
            <div className="flex items-center gap-3 text-platinum-300/80">
              <span className="font-mono text-[11px] tracking-[0.32em] text-ember-300">N 45°37′ · W 122°40′</span>
              <span className="h-px w-10 bg-white/20" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em]">{businessName}</span>
            </div>
          </Reveal>

          <div className="mt-6 md:mt-10">
            <RevealText
              text={headlineRaw}
              italics={italicIdx}
              as="h1"
              className="font-sans text-[clamp(2.7rem,9vw,7.4rem)] font-extralight leading-[0.96] tracking-[-0.02em] text-platinum-50"
            />
          </div>

          <Reveal delay={0.45} y={18}>
            <p className="mt-8 max-w-[44ch] text-[15px] leading-relaxed text-platinum-200/85 md:text-base">
              {sub}
            </p>
          </Reveal>

          <Reveal delay={0.6}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <EmberCTA onClick={onBook} size="lg">
                Configure a Detail
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </EmberCTA>
              <EmberCTA onClick={onServicesClick} size="lg" variant="ghost">
                See the work
                <ArrowDown className="h-3.5 w-3.5" />
              </EmberCTA>
            </div>
          </Reveal>

          {/* Marquee row */}
          <Reveal delay={0.75}>
            <div className="mt-14 border-y border-white/10 py-5">
              <Marquee speed="slow">
                {MANIFESTO_LINES.map((t, i) => (
                  <span key={i} className="flex items-center gap-12">
                    <span className="font-display italic text-[15px] text-platinum-100">{t}</span>
                    <span aria-hidden className="text-ember-400/70">◆</span>
                  </span>
                ))}
              </Marquee>
            </div>
          </Reveal>
        </div>

        {/* RIGHT — vertical spec column + photographic plate */}
        <div className="md:col-span-4">
          <ParallaxLayer speed={0.12}>
            <div className="relative">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-4 pb-8">
                <SpecRow k="Mode"   v="Mobile · we arrive" />
                <SpecRow k="Region" v={serviceArea ?? "WA / OR"} />
                <SpecRow k="Built"  v="By one detailer" />
                <SpecRow k="Booking" v="Direct, no agent" />
              </div>

              <div className="group relative aspect-[4/5] overflow-hidden rounded-[2px] border border-white/10 bg-gradient-to-br from-obsidian-800 to-obsidian-950">
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt=""
                    loading="eager"
                    className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1600ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                ) : (
                  <HeroPlateFallback />
                )}
                {/* gradient overlay so the plate fades into the page below */}
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/80 via-transparent to-transparent" />

                {/* corner tags — paint chip style */}
                <div className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-200/80">
                  Plate 01
                </div>
                <div className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-200/80">
                  in studio
                </div>
              </div>
            </div>
          </ParallaxLayer>
        </div>
      </div>

      {/* scroll cue */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center md:bottom-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-platinum-300"
        >
          <span>Scroll</span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          >
            <ArrowDown className="h-3 w-3" />
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">{k}</span>
      <span className="text-[12.5px] tracking-wide text-platinum-100">{v}</span>
    </>
  );
}

function HeroPlateFallback() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(221,41,20,0.10),transparent_70%)]" />
      <CarbonWeave opacity={0.6} />
      <svg
        viewBox="0 0 200 250"
        className="absolute inset-0 h-full w-full opacity-40"
        aria-hidden
      >
        {/* abstract car silhouette */}
        <defs>
          <linearGradient id="silv" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%"  stopColor="#c7c9cf" />
            <stop offset="60%" stopColor="#6e7280" />
            <stop offset="100%" stopColor="#2a2d34" />
          </linearGradient>
        </defs>
        <g transform="translate(0,40)">
          <path
            d="M22,130 C40,82 60,68 100,68 C140,68 162,82 180,130 L168,150 L130,150 C126,140 116,134 100,134 C84,134 74,140 70,150 L32,150 Z"
            fill="url(#silv)"
            opacity="0.85"
          />
          <ellipse cx="78"  cy="150" rx="14" ry="14" fill="#0a0c10" stroke="#2a2d34" strokeWidth="1.4" />
          <ellipse cx="124" cy="150" rx="14" ry="14" fill="#0a0c10" stroke="#2a2d34" strokeWidth="1.4" />
          <path d="M58,100 L142,100 L162,124 L40,124 Z" fill="#0a0c10" opacity="0.7" />
        </g>
        {/* ember reflection slash */}
        <path d="M28,200 L188,114" stroke="rgba(221,41,20,0.55)" strokeWidth="1.2" />
      </svg>
      <div className="absolute inset-x-0 bottom-6 text-center font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/75">
        plate awaits — add hero in settings
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Manifesto — a single big editorial pull quote on a near-black background.
 *
 * This is the "breath" between hero and services. One italic statement,
 * no decoration except a hairline above and a numbered marker.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * Services
 *
 * NOT a card grid. Each service is a "spec sheet" tile — number, italic
 * service name, tiny scope list, ember price chip, duration tag. Tilt on
 * hover. Discount-bearing tiles flip into a copper border.
 *
 * Asymmetric layout: a 12-col grid where tiles take 7/5 alternating, so
 * the eye traces a diagonal down the page rather than scanning rows.
 * ──────────────────────────────────────────────────────────────────────── */

export function Services({
  services,
  onSelect,
}: {
  services: PublicService[];
  onSelect: (serviceId: string) => void;
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
              // alternating asymmetric spans
              const wide = i % 2 === 0;
              const span = wide ? "md:col-span-7" : "md:col-span-5";
              return (
                <Reveal key={s.id} delay={i * 0.06} className={span}>
                  <ServicePlate service={s} index={i + 1} onSelect={onSelect} />
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
}: {
  service: PublicService;
  index: number;
  onSelect: (serviceId: string) => void;
}) {
  const disc = activeDiscount(s);
  const priceLow = disc ? applyDiscount(s.priceLow, disc) : s.priceLow;
  const priceHigh = disc ? applyDiscount(s.priceHigh, disc) : s.priceHigh;

  // Read more / Show less — measured against the clamped state so the toggle
  // only appears when the description actually overflows. Re-checks on resize
  // so the affordance stays correct as the viewport changes.
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
        {/* corner ember accent */}
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
            <h3 className="mt-3 font-sans text-2xl font-light tracking-tight text-platinum-50 md:text-[28px]">
              <span className="block">{s.name.split(" ").slice(0, -1).join(" ")}</span>
              <span className="block font-display italic font-light text-ember-200/95">
                {s.name.split(" ").slice(-1).join(" ") || s.name}
              </span>
            </h3>
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/70">
              From
            </span>
            {disc ? (
              <>
                <p className="font-mono text-[12px] text-platinum-300/50 line-through">${s.priceLow}</p>
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Process — vertical timeline with hairlines drawing in as user scrolls.
 *
 * Each step is a stacked row: number, italic title, body. The connecting
 * thread on the left is a single SVG path that draws itself via stroke-
 * dashoffset on view-enter. Cleaner than 5 separate icons in a grid.
 * ──────────────────────────────────────────────────────────────────────── */

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
            {/* vertical thread */}
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Gallery — Before / After
 *
 * Staggered photo grid. When real featured photos exist they take the
 * stage; otherwise a set of editorial placeholder plates renders with
 * scope labels. Each tile parallaxes on scroll, hover triggers a slow
 * zoom + reveals a caption strip.
 * ──────────────────────────────────────────────────────────────────────── */

export function Gallery({ featuredPhotos }: { featuredPhotos?: PublicFeaturedPhoto[] }) {
  const photos = featuredPhotos ?? [];
  const hasPhotos = photos.length > 0;
  // Editorial placeholders when no real photos are configured yet.
  const placeholders = [
    { label: "Exterior · Paint Decon" },
    { label: "Interior · Steam + Vacuum" },
    { label: "Wheel Barrels" },
    { label: "Trim · UV Restoration" },
    { label: "Engine Bay" },
    { label: "Glass · Streak-Free" },
  ];

  return (
    <section
      id="gallery"
      className="relative isolate overflow-hidden bg-obsidian-900/60 py-24 md:py-40 scroll-mt-24"
    >
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionMarker index="04" label="Recent Work" />
            <RevealText
              text="Receipts, not renderings."
              italics={[0, 2]}
              as="h2"
              className="mt-8 font-sans text-[clamp(2rem,5vw,3.6rem)] font-extralight leading-[1.02] tracking-[-0.02em] text-platinum-50"
            />
          </div>
          <Reveal delay={0.15}>
            <p className="max-w-[38ch] text-[14.5px] leading-relaxed text-platinum-300/85">
              Real cars. Real driveways. Mid-job and post-job. No staged studio shots — what you see is
              what shows up to your house.
            </p>
          </Reveal>
        </div>

        {/*
         * Uniform compact grid — 2 cols mobile, 3 on tablet, 4 on desktop, 5 on
         * wide screens. Aspect kept portrait-leaning (4/5) so a row of clean
         * car photography reads as a contact sheet rather than billboard tiles.
         */}
        <div className="mt-14 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {hasPhotos
            ? photos.map((p, i) => (
                <GalleryTile key={p.id} i={i} caption={p.caption} src={p.url} />
              ))
            : placeholders.map((p, i) => <GalleryTile key={i} i={i} caption={p.label} />)}
        </div>

        {hasPhotos ? (
          <Reveal delay={0.3}>
            <p className="mt-8 text-center font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/55">
              {photos.length} {photos.length === 1 ? "frame" : "frames"} on file
            </p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function GalleryTile({
  i,
  caption,
  src,
}: {
  i: number;
  caption?: string;
  src?: string;
}) {
  return (
    <Reveal delay={(i % 5) * 0.05}>
      <figure
        className="group relative aspect-[4/5] overflow-hidden border border-white/10 bg-obsidian-850"
        style={{ borderRadius: 2 }}
      >
        {src ? (
          <img
            src={src}
            alt={caption ?? "Detail work"}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1400ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
        ) : (
          <GalleryPlaceholder />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/95 via-obsidian-950/10 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
          <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.24em] text-platinum-100/90">
            {caption ?? "Detail"}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-ember-300">
            {String(i + 1).padStart(2, "0")}
          </span>
        </figcaption>
        {/* shine on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        >
          <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/12 to-transparent group-hover:animate-lx-shine" />
        </span>
      </figure>
    </Reveal>
  );
}

function GalleryPlaceholder() {
  return (
    <>
      <CarbonWeave opacity={0.6} />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(80% 50% at 50% 30%, rgba(221,41,20,0.10), transparent 60%)",
        }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-25">
        <path
          d="M0,140 C40,120 90,110 130,118 C170,126 200,150 200,150 L200,200 L0,200 Z"
          fill="rgba(255,255,255,0.05)"
        />
      </svg>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * WhyUs — pull-quote + numbered reasons
 * ──────────────────────────────────────────────────────────────────────── */

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
                  {/* hover ember underline */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 left-0 h-px w-0 bg-ember-400 transition-all duration-700 group-hover:w-full"
                  />
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        {/* small stats strip */}
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

/* ─────────────────────────────────────────────────────────────────────────────
 * WaterPower — "What I need from you" info block. Calmer section.
 * Two-column ascii-feeling layout with a hand-set diagram.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * Testimonial — single anchor quote in the rotation. Calmer beat after WhyUs.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * BookingSection — the chrome that wraps the multi-step form.
 *
 * This file only renders the *frame*; the actual form lives in form-steps.tsx
 * and is passed in as children so the orchestrator can keep state.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * FAQ — accordion with hairlines, no boxes
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * Final CTA — big italic call, ember orb behind
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * Footer — vertical hairlines, end-of-file feel
 * ──────────────────────────────────────────────────────────────────────── */

export function Footer({
  businessName,
  serviceArea,
  phone,
  email,
  logoUrl,
}: {
  businessName: string;
  serviceArea?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}) {
  return (
    <footer className="relative bg-obsidian-950/85 border-t border-white/10 text-platinum-200">
      <CarbonWeave opacity={0.35} />
      <div className="relative mx-auto max-w-[1320px] px-5 py-16 md:px-10 md:py-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12 md:gap-12">
          <div className="col-span-2 md:col-span-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-obsidian-900">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display italic text-[16px] text-ember-300">jm</span>
                )}
              </span>
              <span className="font-display italic text-2xl font-light text-platinum-50">
                {businessName}
              </span>
            </div>
            <p className="mt-5 max-w-[40ch] text-[13.5px] leading-relaxed text-platinum-300/85">
              A one-person mobile detail studio. Care that scales down, not up — fewer cars, more hours,
              every detail seen to.
            </p>
            <Hairline className="mt-8 max-w-[280px]" />
            <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/70">
              {serviceArea ?? "Vancouver, WA — Portland, OR"}
            </p>
          </div>

          <div className="col-span-1 md:col-span-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">Reach</p>
            <ul className="mt-5 space-y-3 text-[13px]">
              {phone ? (
                <li className="flex items-center gap-3"><Phone className="h-3.5 w-3.5 text-platinum-300" /><a href={`tel:${phone}`} className="hover:text-ember-200">{phone}</a></li>
              ) : null}
              {email ? (
                <li className="flex items-center gap-3"><Mail  className="h-3.5 w-3.5 text-platinum-300" /><a href={`mailto:${email}`} className="hover:text-ember-200">{email}</a></li>
              ) : null}
              {!phone && !email ? (
                <li className="text-platinum-300/70 text-[12px]">Configure on this page — the form is the fastest way to reach me.</li>
              ) : null}
              <li className="flex items-center gap-3 text-platinum-300/85"><MapPin className="h-3.5 w-3.5 text-platinum-300" /> {serviceArea ?? "PNW · WA / OR"}</li>
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">Browse</p>
            <ul className="mt-5 space-y-3 text-[13px]">
              {["manifesto","services","process","gallery","faq"].map((id) => (
                <li key={id}>
                  <button onClick={() => scrollToId(id)} className="capitalize text-platinum-200 transition-colors hover:text-ember-200">
                    {id}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">Trust</p>
            <ul className="mt-5 space-y-3 text-[13px]">
              <li className="flex items-center gap-2 text-platinum-200"><ShieldCheck className="h-3.5 w-3.5 text-ember-300" /> Insured</li>
              <li className="flex items-center gap-2 text-platinum-200"><Sparkles    className="h-3.5 w-3.5 text-ember-300" /> Studio-grade tools</li>
              <li className="flex items-center gap-2 text-platinum-200"><Clock       className="h-3.5 w-3.5 text-ember-300" /> On-time, always</li>
            </ul>
          </div>
        </div>

        <Hairline className="mt-16" />

        <div className="mt-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/70">
            © {new Date().getFullYear()} {businessName} · Mobile detailing, done right.
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.4em] text-platinum-300/60">
            — end of file —
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MobileBookDock — bottom floating dock on mobile only.
 *
 * Hides when the form is in view (orchestrator passes `hidden`). Sits
 * inside a safe-area-aware container so it doesn't collide with iOS bars.
 * ──────────────────────────────────────────────────────────────────────── */

export function MobileBookDock({
  hidden,
  onBook,
  estimatedPrice,
}: {
  hidden: boolean;
  onBook: () => void;
  estimatedPrice: number;
}) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-40 md:hidden"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="bg-gradient-to-t from-obsidian-950 via-obsidian-950/95 to-transparent pb-[max(env(safe-area-inset-bottom),16px)] pt-6">
            <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3 rounded-full border border-white/15 bg-obsidian-900/85 px-3 py-2 backdrop-blur-xl">
              <div className="flex items-center gap-3 pl-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                  Estimate
                </span>
                <span className="font-sans text-base text-platinum-50">
                  {estimatedPrice > 0 ? `~$${estimatedPrice}` : "Pick a package"}
                </span>
              </div>
              <EmberCTA onClick={onBook} size="sm">
                Configure
                <ArrowRight className="h-3.5 w-3.5" />
              </EmberCTA>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ScrollProgress — top-edge ember progress bar tracking page scroll.
 * Subtle but immediately reads "expensive."
 * ──────────────────────────────────────────────────────────────────────── */

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  const width = useTransform(scrollYProgress, (v) => `${v * 100}%`);
  if (reduced) return null;
  return (
    <motion.span
      aria-hidden
      className="fixed inset-x-0 top-0 z-[55] h-[2px] origin-left bg-gradient-to-r from-ember-700 via-ember-400 to-copper-200"
      style={{ width }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BootIntro — first-render cinematic intro (~1.2s). One-time per page load.
 * "JM" mark + hairline + ember sweep, then dissolves.
 * ──────────────────────────────────────────────────────────────────────── */

export function BootIntro({ businessName }: { businessName: string }) {
  const [done, setDone] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setDone(true), 1500);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-obsidian-950"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative flex flex-col items-center">
            <motion.span
              initial={{ scale: 0.85, opacity: 0, filter: "blur(14px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0)" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-display italic font-extralight text-platinum-50 text-[64px] md:text-[112px]"
            >
              {businessName.split(" ")[0]}
            </motion.span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="mt-3 h-px w-44 origin-left bg-gradient-to-r from-transparent via-ember-400 to-transparent"
            />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-3 font-mono text-[10px] uppercase tracking-[0.45em] text-platinum-300/80"
            >
              Mobile detail · est. PNW
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
