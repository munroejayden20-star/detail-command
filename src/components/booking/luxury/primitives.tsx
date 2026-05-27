/* ============================================================================
 * Luxury primitives — public booking page only.
 *
 * Why these exist as separate primitives instead of inline JSX:
 *   - the booking page is a 7-step form on top of an 11-section landing
 *     page; if these animation/visual hooks lived inline, the page would
 *     be unreadable. Each primitive is a single responsibility (one motion
 *     hook, one visual idea) and composes by import.
 *
 * GPU rules: only `transform` + `opacity` are animated in the hot path.
 * Reduced-motion is honored by framer-motion's `useReducedMotion`.
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Z_CLASS } from "@/design-system";

/* ─────────────────────────────────────────────────────────────────────────────
 * useIsMobile — matchMedia hook tied to Tailwind's md breakpoint (<768px).
 *
 * Used to short-circuit decorative scroll-driven layers on mobile, where
 * fixed full-viewport parallax + many useScroll listeners turn the first
 * scroll into a jank fest. Returns true on phones / narrow viewports.
 * SSR-safe (defaults to false when window is undefined).
 * ──────────────────────────────────────────────────────────────────────── */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MouseSpotlight — a fixed radial ember glow that tracks the cursor.
 *
 * The glow lives inside a wrapper that already establishes a stacking
 * context, so we can sit at z-0 behind content while the wrapper itself
 * is positioned where we want the effect to appear. Disabled on touch
 * devices via pointer-coarse media query.
 * ──────────────────────────────────────────────────────────────────────── */

export function MouseSpotlight({
  color = "rgba(221,41,20,0.18)",
  size = 520,
}: {
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 220, damping: 38, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 38, mass: 0.6 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      x.set(e.clientX - rect.left);
      y.set(e.clientY - rect.top);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, x, y]);

  if (reduced) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block"
      style={{ zIndex: 0 }}
    >
      <motion.div
        className="absolute rounded-full blur-3xl will-change-transform"
        style={{
          x: sx,
          y: sy,
          width: size,
          height: size,
          translateX: "-50%",
          translateY: "-50%",
          background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GrainOverlay — film grain texture. SVG turbulence baked as a data URI
 * so it loads instantly with no extra request. Multiply mode keeps the
 * background's color but adds tactile noise. Looks intentional, not noisy.
 * ──────────────────────────────────────────────────────────────────────── */

export function GrainOverlay({
  opacity = 0.06,
  className = "",
}: {
  opacity?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 mix-blend-overlay ${className}`}
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundSize: "240px 240px",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CarbonWeave — subtle diagonal weave pattern.
 *
 * Used as a low-contrast background detail behind hero plates and the
 * water/power card. Two stacked linear gradients sized small enough that
 * they read as a "weave" rather than a "pinstripe."
 * ──────────────────────────────────────────────────────────────────────── */

export function CarbonWeave({
  className = "",
  opacity = 0.5,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        opacity,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px)",
        backgroundSize: "8px 8px",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * FloatingParticles — sparse drifting motes for atmospheric depth.
 *
 * 10 tiny dots scattered across the parent, each rising slowly on its own
 * loop with a hand-picked delay so the motion never aligns. Pure CSS
 * keyframes (`lx-mote-float` / `lx-mote-float-rev`), transform + opacity
 * only. Reduced-motion: freezes everything at base position.
 *
 * Sized to ~2px so they read as ambient dust, not snow.
 * ──────────────────────────────────────────────────────────────────────── */

interface Mote {
  /** Starting % left position */
  left: number;
  /** Starting % top position */
  top: number;
  /** Animation delay in seconds — staggers each mote out of sync */
  delay: number;
  /** Pixel size — 1.5 to 3 to vary depth */
  size: number;
  /** Reverse drift = opposite arc, gives the field volume */
  reverse?: boolean;
}

const DEFAULT_MOTES: Mote[] = [
  { left:  8, top: 88, delay: 0,  size: 2,   reverse: false },
  { left: 22, top: 92, delay: 4,  size: 2.5, reverse: true  },
  { left: 36, top: 80, delay: 8,  size: 1.5, reverse: false },
  { left: 48, top: 95, delay: 12, size: 3,   reverse: true  },
  { left: 62, top: 84, delay: 2,  size: 2,   reverse: false },
  { left: 74, top: 91, delay: 6,  size: 1.5, reverse: true  },
  { left: 88, top: 86, delay: 10, size: 2.5, reverse: false },
  { left: 14, top: 96, delay: 16, size: 1.5, reverse: true  },
  { left: 56, top: 70, delay: 20, size: 2,   reverse: false },
  { left: 80, top: 76, delay: 14, size: 2,   reverse: true  },
];

export function FloatingParticles({
  motes = DEFAULT_MOTES,
  color = "rgba(255, 210, 180, 0.55)",
  className = "",
}: {
  motes?: Mote[];
  /** Mote fill — defaults to a warm ember-tinted off-white */
  color?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {motes.map((m, i) => (
        <span
          key={i}
          className={`absolute rounded-full will-change-transform ${
            reduced
              ? ""
              : m.reverse
                ? "animate-lx-mote-float-rev"
                : "animate-lx-mote-float"
          }`}
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: color,
            boxShadow: `0 0 ${m.size * 4}px ${m.size}px ${color}`,
            animationDelay: `${m.delay}s`,
            opacity: reduced ? 0.35 : 0,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * VolumetricFog — slow-drifting fog blobs for atmospheric haze.
 *
 * Three large blurred radials breathing on independent CSS-keyframe loops
 * (`lx-fog-drift`). Sits between the image plate and content. Differs from
 * HeroAmbient's motion-driven smoke blobs in that the timing is pure CSS —
 * cheaper to run and one less framer-motion subtree.
 * ──────────────────────────────────────────────────────────────────────── */

export function VolumetricFog({
  className = "",
  intensity = 1,
}: {
  className?: string;
  /** 0.5 = whisper, 1 = default, 1.5 = noticeable */
  intensity?: number;
}) {
  const reduced = useReducedMotion();
  const fogClass = reduced ? "" : "animate-lx-fog-drift will-change-transform";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Warm ember haze — lower-left */}
      <div
        className={`absolute -bottom-[10%] -left-[8%] h-[70vh] w-[70vh] rounded-full blur-3xl ${fogClass}`}
        style={{
          background:
            "radial-gradient(circle, rgba(221,41,20,0.10) 0%, rgba(168,114,70,0.05) 35%, transparent 70%)",
          opacity: 0.28 * intensity,
          animationDelay: "0s",
          animationDuration: "26s",
        }}
      />
      {/* Cool neutral fog — upper-right */}
      <div
        className={`absolute -top-[12%] right-[14%] h-[55vh] w-[55vh] rounded-full blur-3xl ${fogClass}`}
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
          opacity: 0.22 * intensity,
          animationDelay: "-9s",
          animationDuration: "32s",
        }}
      />
      {/* Mid-tone copper drift — center bias */}
      <div
        className={`absolute top-[34%] left-[36%] h-[50vh] w-[50vh] rounded-full blur-3xl ${fogClass}`}
        style={{
          background:
            "radial-gradient(circle, rgba(196,137,90,0.07) 0%, transparent 65%)",
          opacity: 0.26 * intensity,
          animationDelay: "-16s",
          animationDuration: "38s",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CinematicVignette — corner darkening for film-like framing.
 *
 * Four overlapping radial gradients pinned to each corner. Reads as a soft
 * lens-darkening, focuses the eye to center without an obvious frame.
 * ──────────────────────────────────────────────────────────────────────── */

export function CinematicVignette({
  intensity = 0.55,
  className = "",
}: {
  /** 0 = transparent, 1 = heavy. Default 0.55 is "noticeable but elegant." */
  intensity?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 50% 45%, transparent 50%, rgba(4,5,6,${0.45 * intensity}) 100%),
          radial-gradient(ellipse 30% 25% at 0% 0%, rgba(4,5,6,${0.6 * intensity}) 0%, transparent 70%),
          radial-gradient(ellipse 30% 25% at 100% 0%, rgba(4,5,6,${0.55 * intensity}) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 0% 100%, rgba(4,5,6,${0.5 * intensity}) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 100% 100%, rgba(4,5,6,${0.5 * intensity}) 0%, transparent 70%)
        `,
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hairline — an SVG line that draws itself in when scrolled into view.
 * Used between sections instead of a flat border. Has the orientation of
 * "horizontal" by default; vertical mode is used inside hero margins.
 * ──────────────────────────────────────────────────────────────────────── */

export function Hairline({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      className={`relative h-px w-full origin-left bg-gradient-to-r from-transparent via-white/15 to-transparent ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.55 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SectionMarker — numbered editorial label.
 *
 *   "01 — SERVICE PACKAGES"
 *
 * The number font is JetBrains Mono so it reads as a hand-set spec sheet
 * rather than a marketing header. Hairline beneath it gives the eye a
 * baseline before the display headline starts.
 * ──────────────────────────────────────────────────────────────────────── */

export function SectionMarker({
  index,
  label,
  align = "left",
}: {
  index: string;
  label: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`flex items-center gap-3 text-platinum-300/80 ${
        align === "center" ? "justify-center" : ""
      }`}
    >
      <span className="font-mono text-[11px] tracking-[0.18em] text-ember-300">{index}</span>
      <span className="h-px w-8 bg-white/15" />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.34em] text-platinum-200/80">
        {label}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * RevealText — splits a string into words and rises them in on view.
 *
 * Stagger and per-word blur give a printing-press feel rather than a
 * generic "fade-up." Designed for headlines: pass an italic flag and the
 * matching word will be rendered in italic Fraunces. Works for any
 * `as` element so it composes with display heading levels.
 * ──────────────────────────────────────────────────────────────────────── */

type RevealTag = "h1" | "h2" | "h3" | "h4" | "p" | "blockquote";

export function RevealText({
  text,
  italics,
  as = "h2",
  className = "",
  delay = 0,
  stagger = 0.045,
}: {
  text: string;
  italics?: number[]; // indices of words to italicize
  as?: RevealTag;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const reduced = useReducedMotion();
  const words = text.split(" ");

  const inner = (
    <span className="inline-block overflow-hidden align-baseline">
      <motion.span
        initial="hidden"
        animate={inView || reduced ? "show" : "hidden"}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger, delayChildren: delay } },
        }}
        className="inline-flex flex-wrap"
      >
        {words.map((w, i) => {
          const isItalic = italics?.includes(i);
          return (
            <motion.span
              key={`${w}-${i}`}
              className={`inline-block ${
                isItalic
                  ? "font-display italic font-light pr-[0.18em] pl-[0.04em] text-ember-200/95"
                  : "pr-[0.22em]"
              }`}
              variants={{
                hidden: { y: "110%", opacity: 0, filter: "blur(6px)" },
                show: {
                  y: 0,
                  opacity: 1,
                  filter: "blur(0)",
                  transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            >
              {w}
            </motion.span>
          );
        })}
      </motion.span>
    </span>
  );

  // Dispatch concrete elements instead of a dynamic Tag — JSX.IntrinsicElements
  // produces a union too wide for `ref` to typecheck against.
  const refH = ref as React.RefObject<HTMLHeadingElement>;
  const refP = ref as React.RefObject<HTMLParagraphElement>;
  const refQ = ref as React.RefObject<HTMLQuoteElement>;
  switch (as) {
    case "h1": return <h1 ref={refH} className={className}>{inner}</h1>;
    case "h2": return <h2 ref={refH} className={className}>{inner}</h2>;
    case "h3": return <h3 ref={refH} className={className}>{inner}</h3>;
    case "h4": return <h4 ref={refH} className={className}>{inner}</h4>;
    case "p":  return <p  ref={refP} className={className}>{inner}</p>;
    case "blockquote": return <blockquote ref={refQ} className={className}>{inner}</blockquote>;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reveal — generic wrapper. Rises content in when it scrolls into view.
 * Cheaper than RevealText (no per-word split); use for paragraphs, cards.
 * ──────────────────────────────────────────────────────────────────────── */

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0)" }}
      viewport={{ once: true, amount: 0.4, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Marquee — infinite ticker. Duplicates children twice for seamless wrap.
 *
 * Used on the trust bar (brand values: "Mobile-only · PNW · 5-star service"
 * etc.) and would also be how you'd display partner logos. Pause on hover.
 * ──────────────────────────────────────────────────────────────────────── */

export function Marquee({
  children,
  reverse,
  speed = "normal",
  pauseOnHover = true,
  className,
}: {
  children: ReactNode;
  reverse?: boolean;
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
  className?: string;
}) {
  const anim =
    speed === "slow"
      ? "animate-lx-marquee-slow"
      : reverse
      ? "animate-lx-marquee-rev"
      : "animate-lx-marquee";

  return (
    <div className={`group flex w-full overflow-hidden ${className ?? ""}`}>
      <div
        className={`flex shrink-0 items-center gap-12 pr-12 ${anim} ${
          pauseOnHover ? "[animation-play-state:running] group-hover:[animation-play-state:paused]" : ""
        }`}
        // Doubled track for a seamless 50% loop.
        style={{ minWidth: "max-content" }}
      >
        {children}
        <span aria-hidden className="flex shrink-0 items-center gap-12 pr-12">
          {children}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MagneticButton — wraps any clickable. Tracks the cursor when nearby and
 * tugs the inner content toward it, with spring physics on release. The
 * outer hit area stays rectangular so click targets remain reliable.
 *
 * Strength is in pixels — a value of 16 means at extreme cursor positions
 * the inner content moves up to 16px in either axis.
 * ──────────────────────────────────────────────────────────────────────── */

export function MagneticButton({
  children,
  onClick,
  className = "",
  strength = 14,
  disabled,
  ariaLabel,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  strength?: number;
  disabled?: boolean;
  ariaLabel?: string;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 16 });
  const sy = useSpring(y, { stiffness: 180, damping: 16 });
  const reduced = useReducedMotion();

  function handleMove(e: ReactMouseEvent<HTMLButtonElement>) {
    if (reduced || disabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    x.set(Math.max(-1, Math.min(1, dx)) * strength);
    y.set(Math.max(-1, Math.min(1, dy)) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      onClick={onClick}
      disabled={disabled}
      className={`relative isolate inline-flex items-center justify-center transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <motion.span
        className="relative inline-flex items-center justify-center gap-2"
        style={{ x: sx, y: sy }}
      >
        {children}
      </motion.span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EmberCTA — the brand button shape used everywhere. Layered:
 *   1. ember body
 *   2. animated specular sheen on hover
 *   3. focus ring
 *   4. inner magnetic content
 *
 * Kept as a primitive instead of a component-library button because it has
 * very specific layering rules and lives only on the booking page.
 * ──────────────────────────────────────────────────────────────────────── */

export function EmberCTA({
  children,
  onClick,
  disabled,
  type = "button",
  size = "md",
  variant = "ember",
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "sm" | "md" | "lg";
  variant?: "ember" | "ghost" | "ink";
  className?: string;
  ariaLabel?: string;
}) {
  const sizeCls =
    size === "lg"
      ? "px-8 py-4 text-[13px]"
      : size === "sm"
      ? "px-4 py-2.5 text-[11px]"
      : "px-6 py-3.5 text-[12px]";

  // Press-state shadow is tighter + redirected as an inset so the button
  // appears to depress into the page rather than just shrink.
  const variantCls =
    variant === "ember"
      ? "bg-ember-500 text-white shadow-[0_18px_40px_-12px_rgba(221,41,20,0.55)] hover:shadow-[0_28px_56px_-14px_rgba(221,41,20,0.7)] active:shadow-[0_6px_18px_-6px_rgba(221,41,20,0.55),inset_0_2px_6px_rgba(0,0,0,0.35)] border border-ember-400/40 hover:border-ember-300/60"
      : variant === "ghost"
      ? "bg-transparent text-platinum-50 border border-white/20 hover:border-ember-400/60 hover:text-ember-200 active:bg-white/[0.03]"
      : "bg-obsidian-800 text-platinum-50 border border-white/10 hover:border-white/30 active:bg-obsidian-900";

  return (
    <MagneticButton
      onClick={onClick}
      disabled={disabled}
      type={type}
      ariaLabel={ariaLabel}
      className={`group/btn relative overflow-hidden rounded-full font-medium uppercase tracking-[0.18em] transition-colors ${sizeCls} ${variantCls} ${className}`}
    >
      {/* Specular sheen — sweeps across on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100"
      >
        <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent group-hover/btn:animate-lx-shine" />
      </span>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </MagneticButton>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GlassCTA — visionOS-style layered glass button used in the hero.
 *
 * Architecture (back-to-front, all GPU-only — transform + opacity):
 *   1. Outer bloom               — large radial glow that intensifies on hover
 *   2. Magnetic motion holder    — cursor-attracted nudge via useSpring(x,y)
 *   3. Glass body                — backdrop-blur + vertical gradient + inset
 *                                  shadows for top highlight + bottom shade
 *   4. Top specular highlight    — gradient from white/20 → transparent
 *   5. Cursor-reactive light     — radial gradient that follows pointer (CSS
 *                                  variables driven by motion values)
 *   6. Diagonal sheen sweep      — `animate-lx-shine` keyframe on hover
 *   7. Hairline gradient border  — slightly brighter at top, darker at bottom
 *   8. Content                   — text + icon, always on top (z-10)
 *
 * Two variants:
 *   - primary  ("Configure")  : ember-tinted bloom + warm top sheen + brighter
 *                               edge accent; the dominant CTA
 *   - secondary ("See work")  : smoked glass, neutral white-on-dark; reads as
 *                               supportive without competing for attention
 *
 * Reduced motion: magnetic pull + cursor light freeze; press / focus styling
 * still works. Outer bloom remains static at base opacity.
 * ──────────────────────────────────────────────────────────────────────── */

export function GlassCTA({
  children,
  onClick,
  variant = "primary",
  size = "lg",
  disabled,
  type = "button",
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.7 });
  // Cursor position inside the button, in %. Drives the radial light layer.
  const cx = useMotionValue(50);
  const cy = useMotionValue(50);
  const lightX = useTransform(cx, (v) => `${v}%`);
  const lightY = useTransform(cy, (v) => `${v}%`);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  function handleMove(e: ReactMouseEvent<HTMLButtonElement>) {
    if (reduced || disabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    // Gentle magnetic pull — under 10px at the extremes so the button never
    // pulls dramatically away from the cursor.
    x.set(Math.max(-1, Math.min(1, dx)) * 9);
    y.set(Math.max(-1, Math.min(1, dy)) * 9);
    cx.set(((e.clientX - r.left) / r.width) * 100);
    cy.set(((e.clientY - r.top) / r.height) * 100);
  }

  function reset() {
    x.set(0);
    y.set(0);
    setHovered(false);
  }

  const isPrimary = variant === "primary";
  const sizeCls =
    size === "lg"
      ? "px-8 py-4 text-[12px]"
      : size === "md"
      ? "px-6 py-3 text-[11.5px]"
      : "px-4 py-2.5 text-[10.5px]";

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        reset();
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
      className={`group/glass relative isolate inline-flex items-center justify-center font-medium uppercase tracking-[0.2em] transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {/* L1 — outer bloom. Tied to hover, animated with framer-motion so the
       *  intensity ramps smoothly on enter/exit. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-full blur-2xl"
        style={{
          background: isPrimary
            ? "radial-gradient(circle, rgba(221,41,20,0.50) 0%, rgba(248,114,72,0.18) 38%, transparent 70%)"
            : "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, transparent 70%)",
        }}
        animate={{
          opacity: hovered ? 1 : isPrimary ? 0.55 : 0.35,
          scale: hovered ? 1.06 : 1,
        }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* L2 — magnetic content holder. Inner press scale composes with the
       *  spring-driven x/y so the press feels grounded. */}
      <motion.span
        className="relative inline-flex"
        style={{ x: sx, y: sy }}
        animate={{ scale: pressed ? 0.96 : hovered ? 1.02 : 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* L3 — glass body. backdrop-blur for the real glass effect; the
         *  vertical gradient + dual inset shadows fake a top highlight + a
         *  bottom shade so the surface reads as curved, not flat.
         *  backdrop-saturate-[1.4] enriches the color sampled from behind
         *  the button so the glass picks up the scene more richly — the
         *  same trick Apple uses on visionOS controls. */}
        <span
          className={`group/glass-body relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full backdrop-blur-2xl backdrop-saturate-[1.4] ${sizeCls}`}
          style={{
            background: isPrimary
              ? "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.05) 45%, rgba(221,41,20,0.22) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%)",
            boxShadow: isPrimary
              ? pressed
                ? "0 8px 22px -14px rgba(221,41,20,0.55), 0 2px 8px -4px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,225,210,0.20), inset 0 -1px 0 0 rgba(0,0,0,0.55), inset 0 4px 14px -6px rgba(0,0,0,0.45)"
                : "0 22px 50px -18px rgba(221,41,20,0.55), 0 6px 18px -8px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,225,210,0.32), inset 0 -1px 0 0 rgba(0,0,0,0.42)"
              : pressed
                ? "0 8px 22px -16px rgba(0,0,0,0.75), 0 2px 6px -3px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 -1px 0 0 rgba(0,0,0,0.55), inset 0 4px 12px -6px rgba(0,0,0,0.40)"
                : "0 22px 50px -22px rgba(0,0,0,0.75), 0 4px 14px -6px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.18), inset 0 -1px 0 0 rgba(0,0,0,0.45)",
            transition: "box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* L4 — top specular highlight. Sits in the top half so the curve
           *  reads as a glass surface catching light from above. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
            style={{
              background: isPrimary
                ? "linear-gradient(180deg, rgba(255,235,220,0.30) 0%, rgba(255,235,220,0.06) 55%, transparent 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 55%, transparent 100%)",
            }}
          />

          {/* L5 — cursor-reactive light. CSS variables (--gx / --gy) are
           *  driven by framer-motion motion values, so the radial follows
           *  the cursor smoothly without re-renders. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300"
            style={{
              opacity: hovered ? 1 : 0,
              background: isPrimary
                ? "radial-gradient(180px circle at var(--gx) var(--gy), rgba(255,200,170,0.40), transparent 65%)"
                : "radial-gradient(180px circle at var(--gx) var(--gy), rgba(255,255,255,0.18), transparent 65%)",
              ["--gx" as never]: lightX,
              ["--gy" as never]: lightY,
            } as CSSProperties}
          />

          {/* L6 — diagonal sheen sweep. Plays on hover-enter via animate-lx-
           *  shine; sits in an overflow-hidden parent so it never spills. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          >
            <span
              className={`absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 ${
                hovered ? "animate-lx-shine opacity-100" : ""
              }`}
            />
          </span>

          {/* L7 — hairline gradient border. Slightly warmer at top (catches
           *  light) and cooler at bottom (catches shadow), mimicking the
           *  bevel on a real glass element. Drawn via mask so it stays
           *  exactly 1px regardless of zoom. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: isPrimary
                ? "linear-gradient(180deg, rgba(255,210,180,0.55) 0%, rgba(255,210,180,0.10) 40%, rgba(0,0,0,0.35) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 45%, rgba(0,0,0,0.40) 100%)",
              padding: "1px",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          {/* L7.5 — chromatic dispersion edge. A near-invisible prismatic ring
           *  (cool blue → warm magenta) that activates on hover. Reads as the
           *  refractive fringing on a real piece of curved glass — the detail
           *  that separates "glass-like" from "Apple-level glass." */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover/glass-body:opacity-100"
            style={{
              background: isPrimary
                ? "conic-gradient(from 220deg at 50% 50%, rgba(140,180,255,0.0) 0deg, rgba(140,180,255,0.30) 80deg, rgba(255,160,210,0.28) 200deg, rgba(255,210,180,0.30) 290deg, rgba(140,180,255,0.0) 360deg)"
                : "conic-gradient(from 200deg at 50% 50%, rgba(180,220,255,0.0) 0deg, rgba(180,220,255,0.24) 90deg, rgba(255,200,230,0.22) 220deg, rgba(180,220,255,0.0) 360deg)",
              padding: "1px",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              mixBlendMode: "screen",
            }}
          />

          {/* L8 — content. Always on top via z-10. Color leans warm-white on
           *  primary so it picks up the ember surroundings; cool platinum on
           *  secondary so it reads as a stealth chip. */}
          <span
            className={`relative z-10 inline-flex items-center gap-2 ${
              isPrimary ? "text-platinum-50" : "text-platinum-100"
            }`}
            style={{
              textShadow: isPrimary
                ? "0 1px 8px rgba(221,41,20,0.45)"
                : "0 1px 8px rgba(0,0,0,0.55)",
            }}
          >
            {children}
          </span>
        </span>
      </motion.span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * TiltCard — perspective tilt that follows the cursor.
 *
 * Used on the showcase service cards and the Configuration summary card.
 * Tilt strength is intentionally subtle (max ~6deg) so the effect adds
 * dimension without becoming a gimmick. Glare overlay tracks the cursor
 * too — it's the subtle gloss that makes the surface feel like a coated
 * paint chip rather than a flat tile.
 * ──────────────────────────────────────────────────────────────────────── */

export function TiltCard({
  children,
  className = "",
  intensity = 6,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const reduced = useReducedMotion();

  const rotateX = useTransform(my, [-1, 1], [intensity, -intensity]);
  const rotateY = useTransform(mx, [-1, 1], [-intensity, intensity]);
  const glareX = useTransform(mx, [-1, 1], ["0%", "100%"]);
  const glareY = useTransform(my, [-1, 1], ["0%", "100%"]);

  function move(e: ReactMouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
    my.set((e.clientY - (r.top + r.height / 2)) / (r.height / 2));
  }
  function leave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className={`relative isolate ${className}`}
      style={{
        transformPerspective: 1100,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background: "radial-gradient(420px circle at var(--gx) var(--gy), rgba(255,255,255,0.10), transparent 55%)",
          ["--gx" as never]: glareX,
          ["--gy" as never]: glareY,
        } as CSSProperties}
      />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ParallaxLayer — scroll-linked Y translate. Used in the hero to give
 * depth to the headline plate vs the photographic plate. Opt-out under
 * reduced-motion.
 * ──────────────────────────────────────────────────────────────────────── */

export function ParallaxLayer({
  children,
  speed = 0.2,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const reduced = useReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}px`, `${-speed * 100}px`]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LiquidProgress — the booking form's progress strip.
 *
 * Spring-animated width with an ember tip + trailing glow + repeating
 * specular sheen. Reads as a fluid level rising rather than a chopped
 * percentage bar.
 * ──────────────────────────────────────────────────────────────────────── */

export function LiquidProgress({
  value, // 0..1
}: {
  value: number;
}) {
  const sx = useSpring(value, { stiffness: 110, damping: 22 });
  const widthPct = useTransform(sx, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`);
  return (
    <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember-700 via-ember-500 to-ember-300"
        style={{ width: widthPct }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-60 mix-blend-screen"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,180,140,0.7) 65%, transparent 100%)",
          }}
        />
      </motion.div>
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-ember-300 shadow-[0_0_14px_rgba(248,114,72,0.9)]"
        style={{ left: widthPct }}
        initial={false}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EmberOrb — soft animated ember glow used as a decorative anchor.
 *
 * Three layered radial gradients that drift independently. Used in the
 * hero corner and behind the final CTA's headline. Sits inside an
 * absolutely-positioned host — the orb itself doesn't position itself.
 * ──────────────────────────────────────────────────────────────────────── */

export function EmberOrb({
  className = "",
  size = 420,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(248,114,72,0.42),transparent_60%)] animate-lx-ember-pulse" />
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_120deg_at_50%_50%,rgba(221,41,20,0.30),transparent_45%,rgba(200,152,104,0.18)_70%,transparent)] mix-blend-screen animate-lx-conic-spin" />
      <div className="absolute inset-1/4 rounded-full bg-[radial-gradient(circle,rgba(255,200,170,0.42),transparent_55%)] blur-2xl" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * AnimatedCounter — count-up integer used on the trust strip stats.
 * Counts only once when first scrolled into view.
 * ──────────────────────────────────────────────────────────────────────── */

export function AnimatedCounter({
  value,
  prefix,
  suffix,
  duration = 1.6,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;
    function tick(t: number) {
      const p = Math.min(1, (t - start) / (duration * 1000));
      // ease-out cubic
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {n}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ScrollAmbient — fixed full-viewport background that reacts to scroll.
 *
 * Composed of:
 *   1. A dot-grid that pans diagonally with scroll progress.
 *   2. Four vertical hairlines that drift up/down at different rates — reads
 *      like floor markings passing on a service-bay tour.
 *   3. Two large soft ember orbs at extreme parallax — one slow upward, one
 *      slow downward — so the lighting "rotates" subtly as you read.
 *   4. A scanline that crosses once per long scroll travel.
 *
 * Sits at z-0 with pointer-events:none, so all content above it (sections,
 * nav, configurator) sits on top without interaction conflicts. Disabled
 * under reduced-motion.
 * ──────────────────────────────────────────────────────────────────────── */

export function ScrollAmbient() {
  // Mobile short-circuit BEFORE any motion hooks fire. On phones the
  // atmospheric layer is barely visible (it's a backdrop with subtle
  // grid/orbs) but its 7 useTransform + useSpring + useScroll chain was
  // the dominant cost on first-scroll jank. Returning null from this
  // outer wrapper means none of the inner hooks ever mount — no listener,
  // no transforms, no compositor layers.
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <ScrollAmbientInner />;
}

function ScrollAmbientInner() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();

  // Smooth the raw scroll progress so all derived motion values inherit ease.
  // Tighter than a typical "buttery" spring on purpose — the soft profile
  // (stiffness 80 / mass 0.4) had a visible catch-up lag on the first scroll
  // event after page load, which read as jitter. This profile critically
  // tracks scroll (no perceptible lag) while still ironing out trackpad
  // micro-jitter at high scroll resolution.
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 36, mass: 0.3 });

  const gridX = useTransform(smooth, [0, 1], ["0px", "60px"]);
  const gridY = useTransform(smooth, [0, 1], ["0px", "-120px"]);

  // Hairlines — each gets a different translate-y range so they pass at
  // different "speeds." The hairline element itself is twice as tall as the
  // viewport so it never reveals an edge as it drifts.
  const line1Y = useTransform(smooth, [0, 1], ["-25%", "12%"]);
  const line2Y = useTransform(smooth, [0, 1], ["8%",  "-22%"]);
  const line3Y = useTransform(smooth, [0, 1], ["-12%", "20%"]);
  const line4Y = useTransform(smooth, [0, 1], ["18%", "-14%"]);

  // Ember orbs — extreme slow parallax.
  const orbAY = useTransform(smooth, [0, 1], ["10vh",  "-40vh"]);
  const orbAX = useTransform(smooth, [0, 1], ["-10vw", "5vw"]);
  const orbBY = useTransform(smooth, [0, 1], ["0vh",   "55vh"]);
  const orbBX = useTransform(smooth, [0, 1], ["20vw",  "-10vw"]);

  // Horizon — a single bright line that slowly sinks down through the viewport.
  const horizon = useTransform(smooth, [0, 1], ["30%", "75%"]);

  if (reduced) return null;

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 ${Z_CLASS.base} overflow-hidden`}>
      {/* dot grid pan */}
      <motion.div
        className="absolute inset-[-20%]"
        style={{
          x: gridX,
          y: gridY,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 50%, black 35%, transparent 85%)",
          opacity: 0.55,
        }}
      />

      {/* drifting vertical hairlines */}
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[8%] bg-gradient-to-b from-transparent via-white/8 to-transparent" style={{ top: 0, y: line1Y, opacity: 0.55 }} />
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[26%] bg-gradient-to-b from-transparent via-ember-500/15 to-transparent" style={{ top: 0, y: line2Y, opacity: 0.6 }} />
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[64%] bg-gradient-to-b from-transparent via-white/8 to-transparent" style={{ top: 0, y: line3Y, opacity: 0.55 }} />
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[88%] bg-gradient-to-b from-transparent via-copper-300/15 to-transparent" style={{ top: 0, y: line4Y, opacity: 0.55 }} />

      {/* soft horizon line — moves slowly as you read */}
      <motion.div
        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
        style={{ top: horizon, opacity: 0.7 }}
      />

      {/* ember orb — left-top, drifting up + right */}
      <motion.div
        className="absolute h-[55vh] w-[55vh] rounded-full blur-3xl"
        style={{
          left: "-15%",
          top: "5%",
          x: orbAX,
          y: orbAY,
          background:
            "radial-gradient(circle, rgba(221,41,20,0.18) 0%, rgba(221,41,20,0.04) 35%, transparent 65%)",
        }}
      />
      {/* copper orb — right-bottom, drifting down + left */}
      <motion.div
        className="absolute h-[60vh] w-[60vh] rounded-full blur-3xl"
        style={{
          right: "-20%",
          bottom: "0%",
          x: orbBX,
          y: orbBY,
          background:
            "radial-gradient(circle, rgba(168,114,70,0.16) 0%, rgba(168,114,70,0.05) 40%, transparent 70%)",
        }}
      />

      {/* faint vignette to keep edges grounded */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_40%,#06070a_100%)]" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ScrollTelemetry — fixed right-edge readout. Shows the current scroll %
 * in a hand-set mono frame, plus a tiny tick that travels down the rail as
 * you read. Looks like a film-counter on the side of a reel.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Fixed right-edge film-counter that reacts to page scroll.
 *
 * Two design choices worth flagging:
 *   - The tick is driven by a `y` transform (GPU) in pixels, not `top: %` —
 *     framer-motion subscribes motion values to inline styles, and using
 *     `top` with a percent string fails silently if the parent isn't fully
 *     resolved at hook time. `y` is the canonical hot-path target.
 *   - The rail height comes from a layout effect after first paint, so the
 *     tick range matches the real rendered height at any viewport.
 */
export function ScrollTelemetry() {
  // Already CSS-hidden on mobile (`hidden md:flex`) but the inner hooks
  // still ran — including a `useMotionValueEvent` that called setState on
  // every scroll tick. That's pure waste on mobile and a contributor to
  // first-scroll jank. Short-circuit before any hooks mount.
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <ScrollTelemetryInner />;
}

function ScrollTelemetryInner() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  const [pct, setPct] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [railH, setRailH] = useState(220);

  useEffect(() => {
    if (!railRef.current) return;
    const measure = () => {
      const h = railRef.current?.getBoundingClientRect().height ?? 220;
      setRailH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(railRef.current);
    return () => ro.disconnect();
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setPct(Math.round(v * 100));
  });

  const tickY = useTransform(scrollYProgress, [0, 1], [0, Math.max(0, railH - 7)]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed right-3 top-1/2 ${Z_CLASS.navInternal} hidden -translate-y-1/2 flex-col items-center gap-3 md:flex`}
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.4em] text-platinum-300/55 [writing-mode:vertical-rl] rotate-180">
        Telemetry
      </span>
      <div ref={railRef} className="relative h-[240px] w-px bg-white/12">
        {/* hash marks every 25% so motion has reference */}
        <span className="absolute -left-1 top-0 h-px w-2.5 bg-white/30" />
        <span className="absolute -left-1 top-1/4 h-px w-1.5 bg-white/18" />
        <span className="absolute -left-1 top-1/2 h-px w-1.5 bg-white/18" />
        <span className="absolute -left-1 top-3/4 h-px w-1.5 bg-white/18" />
        <span className="absolute -left-1 bottom-0 h-px w-2.5 bg-white/30" />

        {/* ember tick — driven by transform y in pixels */}
        <motion.span
          className="absolute left-[-3.5px] top-0 h-[8px] w-[8px] rounded-full bg-ember-400 shadow-[0_0_14px_3px_rgba(248,114,72,0.7)]"
          style={{ y: tickY }}
        />
        {/* faint ember trail above the tick */}
        <motion.span
          className="absolute left-0 top-0 w-px -translate-x-px bg-gradient-to-b from-transparent via-ember-500/40 to-ember-400"
          style={{ height: tickY }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-platinum-300/85">
        {String(pct).padStart(3, "0")}<span className="text-platinum-300/40">%</span>
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Modal — fullscreen dimmed overlay with scale+blur in.
 * Only used for the post-submit "Configuration Confirmed" celebratory
 * sheet. Scroll-locks the body while open.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 ${Z_CLASS.modal} flex items-center justify-center px-4 backdrop-blur-md`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-obsidian-950/85" />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
