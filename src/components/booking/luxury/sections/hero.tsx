/* ============================================================================
 * Hero
 *
 * Layout (desktop):  asymmetric two-thirds left / one-third right
 *   Left:   tiny coordinate marker, oversized italic display headline, sub,
 *           dual-CTA, marquee of brand values, scroll cue.
 *   Right:  full-bleed image plate.
 *
 * Mobile: single-column. Plate shrinks to a thumbprint at the bottom.
 *
 * Mouse spotlight + ember orb give the section atmosphere; ParallaxLayer
 * slides the plate independently of the headline. The headline itself is
 * a RevealText with letter-stagger, with one word italicized (Fraunces).
 *
 * Hero-only sub-components (HeroContentParallax, HeroImagePlate, HeroAmbient,
 * HeroPlateFallback) live in this file too — they are intentionally not
 * exported because Hero is their only consumer.
 * ========================================================================== */

import { useRef } from "react";
import type { ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Z_CLASS } from "@/design-system";
import {
  CarbonWeave,
  CinematicVignette,
  EmberOrb,
  FloatingParticles,
  GlassCTA,
  GrainOverlay,
  Marquee,
  MouseSpotlight,
  Reveal,
  RevealText,
  useIsMobile,
  VolumetricFog,
} from "../primitives";
import { FALLBACK_HERO_HEADLINE, FALLBACK_HERO_SUB, MANIFESTO_LINES } from "./constants";

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
      {/* ─── L0 — base atmosphere ─────────────────────────────────────────── */}
      <div aria-hidden className={`absolute inset-0 ${Z_CLASS.base}`}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#0f1218_0%,#06070a_55%,#040506_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.14] animate-lx-grid-pan"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <CarbonWeave opacity={0.35} />
        <GrainOverlay opacity={0.10} />
      </div>

      <HeroImagePlate heroImageUrl={heroImageUrl} />
      <HeroAmbient />

      <VolumetricFog intensity={0.85} className={Z_CLASS.ambient} />
      <FloatingParticles className={Z_CLASS.ambient} />
      <CinematicVignette intensity={0.5} className={Z_CLASS.accent} />

      <MouseSpotlight color="rgba(221,41,20,0.22)" size={620} />
      <div className={`pointer-events-none absolute -right-32 -top-20 ${Z_CLASS.accent} opacity-90`}>
        <EmberOrb size={520} />
      </div>

      <HeroContentParallax className={`relative ${Z_CLASS.content} mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 items-end gap-12 px-5 pb-16 pt-32 md:grid-cols-12 md:gap-10 md:px-10 md:pb-24 md:pt-36`}>
        <div className="md:col-span-7 lg:col-span-7">
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
              className="font-sans text-[clamp(2.7rem,9vw,7.4rem)] font-extralight leading-[0.96] tracking-[-0.02em] text-platinum-50 [text-shadow:0_2px_30px_rgba(0,0,0,0.7)]"
            />
          </div>

          <Reveal delay={0.45} y={18}>
            <p className="mt-8 max-w-[44ch] text-[15px] leading-relaxed text-platinum-200/90 md:text-base [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
              {sub}
            </p>
          </Reveal>

          <Reveal delay={0.6}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <GlassCTA onClick={onBook} variant="primary" size="lg">
                Configure a Detail
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/glass:translate-x-0.5" />
              </GlassCTA>
              <GlassCTA onClick={onServicesClick} variant="secondary" size="lg">
                See the work
                <ArrowDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover/glass:translate-y-0.5" />
              </GlassCTA>
            </div>
          </Reveal>

          <Reveal delay={0.75}>
            <div className="mt-14 border-y border-white/10 bg-obsidian-950/35 py-5 backdrop-blur-[2px]">
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

      </HeroContentParallax>

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 ${Z_CLASS.bleed} h-56 bg-[linear-gradient(180deg,transparent_0%,rgba(6,7,10,0.25)_30%,rgba(6,7,10,0.65)_65%,#06070a_100%)]`}
      />

      <div className={`pointer-events-none absolute inset-x-0 bottom-6 ${Z_CLASS.cue} flex justify-center md:bottom-10`}>
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

/* ─────────────────────────────────────────────────────────────────────────────
 * HeroContentParallax — scroll-linked opacity + Y-lift on hero text.
 * Disabled on mobile to avoid iOS-address-bar/parallax interaction jank.
 * ──────────────────────────────────────────────────────────────────────── */

function HeroContentParallax({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const isMobile = useIsMobile();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.7, 0.25]);

  return (
    <motion.div
      ref={ref}
      style={reduced || isMobile ? undefined : { y, opacity }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * HeroImagePlate — full-bleed photographic backdrop with masked vignette.
 * Parallax disabled on mobile (see HeroContentParallax note).
 * ──────────────────────────────────────────────────────────────────────── */

function HeroImagePlate({ heroImageUrl }: { heroImageUrl?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const reduced = useReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], ["32px", "-32px"]);
  const disableParallax = reduced || isMobile;

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${Z_CLASS.plate} overflow-hidden`}
    >
      <div
        className="absolute right-[2%] top-[28%] h-[65vh] w-[65vh] rounded-full blur-3xl animate-lx-ember-pulse"
        style={{
          background:
            "radial-gradient(circle, rgba(221,41,20,0.30) 0%, rgba(248,114,72,0.08) 35%, transparent 65%)",
        }}
      />
      <div
        className="absolute right-[28%] top-[10%] h-[45vh] w-[45vh] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(168,114,70,0.10) 0%, transparent 65%)",
        }}
      />

      <motion.div
        className="absolute inset-y-0 right-0 w-full opacity-[0.92] md:w-[68%] lg:w-[60%]"
        style={{
          y: disableParallax ? 0 : y,
          WebkitMaskImage:
            "radial-gradient(ellipse 72% 78% at 62% 50%, #000 32%, rgba(0,0,0,0.55) 65%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 72% 78% at 62% 50%, #000 32%, rgba(0,0,0,0.55) 65%, transparent 100%)",
        }}
      >
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt=""
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[60%_45%]"
          />
        ) : (
          <HeroPlateFallback />
        )}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_85%_at_55%_55%,transparent_28%,rgba(6,7,10,0.5)_72%,#06070a_100%)]" />
        <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-obsidian-950/85 via-obsidian-950/35 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-obsidian-950/95 via-obsidian-950/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent via-obsidian-950/55 to-obsidian-950" />
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * HeroAmbient — cinematic atmosphere: rays, smoke, scanline.
 * ──────────────────────────────────────────────────────────────────────── */

function HeroAmbient() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${Z_CLASS.ambient} overflow-hidden`}>
      <div
        className="absolute -top-[10%] right-[18%] h-[130vh] w-[100vh] opacity-[0.32] mix-blend-screen"
        style={{
          background:
            "conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(248,114,72,0.18) 12deg, rgba(248,114,72,0.04) 22deg, transparent 32deg)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 0%, black 0%, black 28%, transparent 70%)",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, black 0%, black 28%, transparent 70%)",
        }}
      />
      <div
        className="absolute -top-[20%] right-[36%] h-[110vh] w-[80vh] opacity-[0.18] mix-blend-screen"
        style={{
          background:
            "conic-gradient(from 215deg at 50% 0%, transparent 0deg, rgba(255,255,255,0.07) 7deg, transparent 16deg)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 0%, black 0%, transparent 60%)",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, black 0%, transparent 60%)",
        }}
      />

      <motion.div
        className="absolute left-[6%] top-[12%] h-[60vh] w-[60vh] rounded-full blur-3xl will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(168,114,70,0.10) 0%, transparent 65%)",
        }}
        animate={reduced ? undefined : { x: [0, 38, -18, 0], y: [0, -28, 14, 0] }}
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[20%] h-[50vh] w-[50vh] rounded-full blur-3xl will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(221,41,20,0.07) 0%, transparent 60%)",
        }}
        animate={reduced ? undefined : { x: [0, -30, 16, 0], y: [0, 20, -10, 0] }}
        transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[24%] left-[34%] h-[42vh] w-[42vh] rounded-full blur-2xl will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 72%)",
        }}
        animate={reduced ? undefined : { x: [0, 22, -16, 0], y: [0, -16, 12, 0] }}
        transition={{ duration: 48, repeat: Infinity, ease: "easeInOut" }}
      />

      {!reduced && (
        <motion.div
          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-ember-400/65 to-transparent will-change-transform"
          initial={{ top: "18%", opacity: 0 }}
          animate={{ top: "72%", opacity: [0, 0.6, 0] }}
          transition={{ duration: 2.6, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
        />
      )}
    </div>
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
        <path d="M28,200 L188,114" stroke="rgba(221,41,20,0.55)" strokeWidth="1.2" />
      </svg>
      <div className="absolute inset-x-0 bottom-6 text-center font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/75">
        plate awaits — add hero in settings
      </div>
    </>
  );
}
