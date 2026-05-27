/* ============================================================================
 * Interactive primitives — buttons + tilt.
 *
 * MagneticButton, EmberCTA, GlassCTA, TiltCard.
 *
 * GlassCTA and EmberCTA are thin variant wrappers around a shared
 * `GlassButtonShell` that owns the full cinematic glass treatment:
 *
 *   L0  outer bloom         (radial glow that intensifies on hover, scaled
 *                            by cursor proximity)
 *   L1  magnetic content    (spring-driven x/y pull toward cursor)
 *   L2  glass body          (backdrop-blur(28px) + saturate(1.7); vertical
 *                            gradient + dual inset shadows fake top
 *                            highlight + bottom shade so the surface reads
 *                            as curved)
 *   L3  top specular        (warm highlight on the upper half — mimics
 *                            light catching the top edge of curved glass)
 *   L4  cursor-reactive     (radial that follows pointer via CSS vars
 *                            driven by motion values — no re-renders)
 *   L5  rim shimmer         (slow conic gradient rotation on the border —
 *                            cinematic idle tell, freezes on hover so it
 *                            doesn't compete with the cursor light)
 *   L6  sheen sweep         (one-shot diagonal -skew-x highlight on
 *                            hover enter)
 *   L7  hairline border     (warm-at-top, dark-at-bottom 1px gradient via
 *                            mask-composite)
 *   L7.5 chromatic dispersion (near-invisible prismatic ring on hover —
 *                            the detail that separates "glass-like" from
 *                            "Apple-level glass")
 *   L8  content             (text + icon, lifted on top via z-10)
 *
 * Press behavior is choreographed (scale [1.02 → 0.93 → 1] across 320ms)
 * rather than a single-frame snap, so the click feels physical. Loading
 * state freezes cursor lighting + dims interactions but keeps the body
 * vibrant so the button doesn't look broken while submitting.
 *
 * Reduced motion: magnetic pull, cursor light, rim shimmer, and sheen all
 * freeze. Press / focus styling still works. Outer bloom remains static
 * at base opacity.
 * ========================================================================== */

import { useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Loader2 } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
 * MagneticButton — generic cursor-tracking wrapper. Used standalone on
 * non-glass call sites (currently none, but kept for future). Glass buttons
 * implement their own magnetic via the shell below — they don't compose
 * MagneticButton because the shell's bloom needs to live OUTSIDE the
 * magnetic transform so it doesn't drift with the press.
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

/* ═════════════════════════════════════════════════════════════════════════════
 * GlassButtonShell — internal. Holds the entire cinematic glass treatment.
 *
 * Tone palette:
 *   ember-primary  — strong ember bloom, warm body tint, copper-tinted
 *                    chromatic ring. The dominant action color.
 *   clear          — neutral white bloom, cool body, blue-magenta ring.
 *                    Secondary/quiet glass.
 *   ghost          — translucent border-first treatment; bloom is minimal,
 *                    the edge does the heavy lifting. For tertiary actions.
 *   ink            — dark obsidian glass with subtle white edge. For
 *                    contexts where ember would compete with surroundings.
 * ════════════════════════════════════════════════════════════════════════ */

type Tone = "ember-primary" | "clear" | "ghost" | "ink";
type Size = "sm" | "md" | "lg";

interface ToneStyles {
  bloom: string;
  bloomOpacityRest: number;
  body: string;
  bodyShadow: (pressed: boolean) => string;
  topHighlight: string;
  cursorLight: string;
  rimBorder: string;
  chromaticRing: string;
  textColor: string;
  textShadow: string;
}

const TONES: Record<Tone, ToneStyles> = {
  "ember-primary": {
    bloom:
      "radial-gradient(circle, rgba(221,41,20,0.55) 0%, rgba(248,114,72,0.22) 38%, transparent 72%)",
    bloomOpacityRest: 0.6,
    body:
      "linear-gradient(180deg, rgba(255,235,220,0.22) 0%, rgba(255,255,255,0.05) 45%, rgba(221,41,20,0.26) 100%)",
    bodyShadow: (pressed) =>
      pressed
        ? "0 8px 22px -14px rgba(221,41,20,0.60), 0 2px 8px -4px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,225,210,0.22), inset 0 -1px 0 0 rgba(0,0,0,0.55), inset 0 4px 14px -6px rgba(0,0,0,0.45)"
        : "0 28px 60px -18px rgba(221,41,20,0.60), 0 8px 20px -8px rgba(0,0,0,0.50), inset 0 1px 0 0 rgba(255,225,210,0.34), inset 0 -1px 0 0 rgba(0,0,0,0.42)",
    topHighlight:
      "linear-gradient(180deg, rgba(255,235,220,0.34) 0%, rgba(255,235,220,0.06) 55%, transparent 100%)",
    cursorLight:
      "radial-gradient(220px circle at var(--gx) var(--gy), rgba(255,200,170,0.45), transparent 65%)",
    rimBorder:
      "linear-gradient(180deg, rgba(255,210,180,0.60) 0%, rgba(255,210,180,0.10) 40%, rgba(0,0,0,0.40) 100%)",
    chromaticRing:
      "conic-gradient(from 220deg at 50% 50%, rgba(140,180,255,0.0) 0deg, rgba(140,180,255,0.32) 80deg, rgba(255,160,210,0.30) 200deg, rgba(255,210,180,0.32) 290deg, rgba(140,180,255,0.0) 360deg)",
    textColor: "text-platinum-50",
    textShadow: "0 1px 10px rgba(221,41,20,0.50)",
  },
  "clear": {
    bloom:
      "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 40%, transparent 72%)",
    bloomOpacityRest: 0.4,
    body:
      "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.07) 100%)",
    bodyShadow: (pressed) =>
      pressed
        ? "0 8px 22px -16px rgba(0,0,0,0.75), 0 2px 6px -3px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 -1px 0 0 rgba(0,0,0,0.55), inset 0 4px 12px -6px rgba(0,0,0,0.40)"
        : "0 26px 56px -22px rgba(0,0,0,0.75), 0 6px 16px -6px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.20), inset 0 -1px 0 0 rgba(0,0,0,0.45)",
    topHighlight:
      "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 55%, transparent 100%)",
    cursorLight:
      "radial-gradient(220px circle at var(--gx) var(--gy), rgba(255,255,255,0.20), transparent 65%)",
    rimBorder:
      "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 45%, rgba(0,0,0,0.42) 100%)",
    chromaticRing:
      "conic-gradient(from 200deg at 50% 50%, rgba(180,220,255,0.0) 0deg, rgba(180,220,255,0.26) 90deg, rgba(255,200,230,0.24) 220deg, rgba(180,220,255,0.0) 360deg)",
    textColor: "text-platinum-100",
    textShadow: "0 1px 10px rgba(0,0,0,0.58)",
  },
  "ghost": {
    bloom:
      "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 45%, transparent 75%)",
    bloomOpacityRest: 0.2,
    body:
      "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 50%, rgba(255,255,255,0.03) 100%)",
    bodyShadow: (pressed) =>
      pressed
        ? "0 4px 14px -10px rgba(0,0,0,0.75), inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 0 0 rgba(0,0,0,0.40), inset 0 3px 10px -5px rgba(0,0,0,0.40)"
        : "0 16px 40px -22px rgba(0,0,0,0.70), inset 0 1px 0 0 rgba(255,255,255,0.14), inset 0 -1px 0 0 rgba(0,0,0,0.35)",
    topHighlight:
      "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 55%, transparent 100%)",
    cursorLight:
      "radial-gradient(200px circle at var(--gx) var(--gy), rgba(255,255,255,0.14), transparent 65%)",
    rimBorder:
      "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 50%, rgba(0,0,0,0.30) 100%)",
    chromaticRing:
      "conic-gradient(from 200deg at 50% 50%, rgba(180,220,255,0.0) 0deg, rgba(180,220,255,0.18) 90deg, rgba(255,200,230,0.16) 220deg, rgba(180,220,255,0.0) 360deg)",
    textColor: "text-platinum-100",
    textShadow: "0 1px 8px rgba(0,0,0,0.55)",
  },
  "ink": {
    bloom:
      "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, transparent 72%)",
    bloomOpacityRest: 0.25,
    body:
      "linear-gradient(180deg, rgba(34,38,46,0.85) 0%, rgba(20,24,30,0.95) 50%, rgba(12,14,18,1) 100%)",
    bodyShadow: (pressed) =>
      pressed
        ? "0 4px 14px -10px rgba(0,0,0,0.75), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 -1px 0 0 rgba(0,0,0,0.60), inset 0 3px 10px -5px rgba(0,0,0,0.55)"
        : "0 18px 40px -18px rgba(0,0,0,0.80), inset 0 1px 0 0 rgba(255,255,255,0.10), inset 0 -1px 0 0 rgba(0,0,0,0.50)",
    topHighlight:
      "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 55%, transparent 100%)",
    cursorLight:
      "radial-gradient(200px circle at var(--gx) var(--gy), rgba(255,255,255,0.10), transparent 65%)",
    rimBorder:
      "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.50) 100%)",
    chromaticRing:
      "conic-gradient(from 200deg at 50% 50%, rgba(180,220,255,0.0) 0deg, rgba(180,220,255,0.10) 90deg, rgba(255,200,230,0.10) 220deg, rgba(180,220,255,0.0) 360deg)",
    textColor: "text-platinum-50",
    textShadow: "0 1px 8px rgba(0,0,0,0.70)",
  },
};

const SIZE_CLS: Record<Size, string> = {
  lg: "px-8 py-4 text-[12px]",
  md: "px-6 py-3 text-[11.5px]",
  sm: "px-4 py-2.5 text-[10.5px]",
};

function GlassButtonShell({
  children,
  onClick,
  tone,
  size = "lg",
  loading = false,
  disabled,
  type = "button",
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone: Tone;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);

  // Magnetic pull (button content drifts toward cursor — capped at ±10px).
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.7 });

  // Cursor position inside the button, in % — drives the radial light layer.
  const cx = useMotionValue(50);
  const cy = useMotionValue(50);
  const lightX = useTransform(cx, (v) => `${v}%`);
  const lightY = useTransform(cy, (v) => `${v}%`);

  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const inert = disabled || loading;
  const styles = TONES[tone];

  function handleMove(e: ReactMouseEvent<HTMLButtonElement>) {
    if (reduced || inert) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    x.set(Math.max(-1, Math.min(1, dx)) * 10);
    y.set(Math.max(-1, Math.min(1, dy)) * 10);
    cx.set(((e.clientX - r.left) / r.width) * 100);
    cy.set(((e.clientY - r.top) / r.height) * 100);
  }

  function reset() {
    x.set(0);
    y.set(0);
    setHovered(false);
    setPressed(false);
  }

  // Choreographed press → release. Snaps to 0.93 on press, springs back to
  // 1.02 (hover-rest) or 1.0 (idle). Gives the click a physical weight.
  const contentScale = pressed ? 0.93 : hovered ? 1.02 : 1;

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={inert}
      onMouseMove={handleMove}
      onMouseEnter={() => !inert && setHovered(true)}
      onMouseLeave={reset}
      onMouseDown={() => !inert && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => !inert && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
      className={`group/glass relative isolate inline-flex items-center justify-center font-medium uppercase tracking-[0.2em] transition-opacity duration-300 disabled:cursor-not-allowed ${
        loading ? "opacity-95" : disabled ? "opacity-45 saturate-50" : ""
      } ${className}`}
    >
      {/* L0 — outer bloom. Grows AND brightens on hover; cinematic
       *  intensity means we reach 1.08x scale and pull bloom out to
       *  -inset-8 so the halo extends generously past the rim. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-full blur-2xl"
        style={{ background: styles.bloom }}
        animate={{
          opacity: hovered ? 1 : styles.bloomOpacityRest,
          scale: hovered ? 1.08 : 1,
        }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* L1 — magnetic content holder. Inner press scale composes with the
       *  spring-driven x/y so the press feels grounded, not abstract. */}
      <motion.span
        className="relative inline-flex"
        style={{ x: sx, y: sy }}
        animate={{ scale: contentScale }}
        transition={{
          duration: pressed ? 0.12 : 0.32,
          ease: pressed ? [0.34, 0, 0.64, 1] : [0.22, 1.2, 0.36, 1],
        }}
      >
        {/* L2 — glass body. backdrop-blur(28px) + saturate(1.7) gives the
         *  real refractive look; the vertical gradient + dual inset shadows
         *  fake a top highlight + bottom shade so the surface reads as a
         *  curved piece of crystal, not a flat panel. */}
        <span
          className={`group/glass-body relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full backdrop-blur-[28px] backdrop-saturate-[1.7] ${SIZE_CLS[size]}`}
          style={{
            background: styles.body,
            boxShadow: styles.bodyShadow(pressed),
            transition: "box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* L3 — top specular highlight */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
            style={{ background: styles.topHighlight }}
          />

          {/* L4 — cursor-reactive light (CSS vars driven by motion values,
           *  no re-renders). Brightens on hover via opacity transition. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300"
            style={{
              opacity: hovered ? 1 : 0,
              background: styles.cursorLight,
              ["--gx" as never]: lightX,
              ["--gy" as never]: lightY,
            } as CSSProperties}
          />

          {/* L5 — (removed) rotating rim shimmer.
           *  The conic-gradient rotation with mix-blend-mode: screen inside
           *  a mask-composite: exclude ring produced visible white pixels
           *  at the rounded corners that accumulated as the animation ran.
           *  The bloom + cursor light + chromatic ring on hover already
           *  carry the "alive" feel without this layer. */}

          {/* L6 — diagonal sheen sweep on hover-enter */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          >
            <span
              className={`absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 ${
                hovered && !inert ? "animate-lx-shine opacity-100" : ""
              }`}
            />
          </span>

          {/* L7 — hairline gradient border */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: styles.rimBorder,
              padding: "1px",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          {/* L7.5 — chromatic dispersion (hover only). The refractive
           *  fringing that separates "glass-like" from "Apple-level glass." */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover/glass-body:opacity-100"
            style={{
              background: styles.chromaticRing,
              padding: "1px",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              mixBlendMode: "screen",
            }}
          />

          {/* L8 — content. Loading swaps to a spinner; original children
           *  stay rendered with opacity 0 so the button width doesn't
           *  pop while submitting. */}
          <span
            className={`relative z-10 inline-flex items-center gap-2 ${styles.textColor}`}
            style={{ textShadow: styles.textShadow }}
          >
            {loading ? (
              <>
                <span className="inline-flex items-center gap-2 opacity-0" aria-hidden>
                  {children}
                </span>
                <span className="absolute inset-0 inline-flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              </>
            ) : (
              children
            )}
          </span>
        </span>
      </motion.span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GlassCTA — VisionOS-style layered glass button. Hero CTA family.
 *
 * variant: primary | secondary
 *   primary   → ember-tinted glass (the dominant action)
 *   secondary → clear smoked glass (supportive, non-competing)
 * ──────────────────────────────────────────────────────────────────────── */

export function GlassCTA({
  children,
  onClick,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  type = "button",
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <GlassButtonShell
      tone={variant === "primary" ? "ember-primary" : "clear"}
      size={size}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      type={type}
      ariaLabel={ariaLabel}
      className={className}
    >
      {children}
    </GlassButtonShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EmberCTA — workhorse action button. Used for form submit, FAQ open,
 * FinalCTA, "Try again" — the buttons you actually click to perform actions
 * (vs. GlassCTA which is the marketing pitch button).
 *
 * Shares the GlassButtonShell so the interaction language is identical to
 * GlassCTA. The variant maps to the same tone palette so the hero "Configure"
 * and the form-step "Submit request" feel like siblings of the same family.
 *
 * variant: ember | ghost | ink
 *   ember → ember-tinted glass (default — most action buttons)
 *   ghost → translucent edge-first treatment (tertiary actions)
 *   ink   → dark obsidian glass (when ember would compete with surroundings)
 * ──────────────────────────────────────────────────────────────────────── */

export function EmberCTA({
  children,
  onClick,
  disabled,
  loading,
  type = "button",
  size = "md",
  variant = "ember",
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  size?: Size;
  variant?: "ember" | "ghost" | "ink";
  className?: string;
  ariaLabel?: string;
}) {
  const tone: Tone =
    variant === "ember" ? "ember-primary" : variant === "ghost" ? "ghost" : "ink";
  return (
    <GlassButtonShell
      tone={tone}
      size={size}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      type={type}
      ariaLabel={ariaLabel}
      className={className}
    >
      {children}
    </GlassButtonShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * TiltCard — perspective tilt that follows the cursor.
 *
 * Tilt strength is intentionally subtle (max ~6deg). Glare overlay tracks
 * the cursor too — the subtle gloss that makes the surface feel like a
 * coated paint chip rather than a flat tile.
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
