/* ============================================================================
 * Interactive primitives — buttons + tilt.
 *
 * MagneticButton, EmberCTA, GlassCTA, TiltCard. All cursor-reactive; reduced
 * motion freezes the spring physics and disables the glare overlay.
 * ========================================================================== */

import { useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────────
 * MagneticButton — wraps any clickable. Tracks the cursor when nearby and
 * tugs the inner content toward it. Outer hit area stays rectangular.
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
 * EmberCTA — the brand button shape used everywhere.
 * Layered: ember body → animated specular sheen → focus ring → magnetic content.
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
 *   5. Cursor-reactive light     — radial gradient that follows pointer
 *   6. Diagonal sheen sweep      — `animate-lx-shine` keyframe on hover
 *   7. Hairline gradient border  — slightly brighter at top, darker at bottom
 *   7.5. Chromatic dispersion    — near-invisible prismatic ring on hover
 *   8. Content                   — text + icon, always on top (z-10)
 *
 * Two variants:
 *   - primary  ("Configure")  : ember-tinted bloom + warm top sheen
 *   - secondary ("See work")  : smoked glass, neutral white-on-dark
 *
 * Reduced motion: magnetic pull + cursor light freeze; press / focus
 * styling still works. Outer bloom remains static at base opacity.
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
      {/* L1 — outer bloom */}
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

      {/* L2 — magnetic content holder */}
      <motion.span
        className="relative inline-flex"
        style={{ x: sx, y: sy }}
        animate={{ scale: pressed ? 0.96 : hovered ? 1.02 : 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* L3 — glass body */}
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
          {/* L4 — top specular highlight */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
            style={{
              background: isPrimary
                ? "linear-gradient(180deg, rgba(255,235,220,0.30) 0%, rgba(255,235,220,0.06) 55%, transparent 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 55%, transparent 100%)",
            }}
          />

          {/* L5 — cursor-reactive light */}
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

          {/* L6 — diagonal sheen sweep */}
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

          {/* L7 — hairline gradient border */}
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

          {/* L7.5 — chromatic dispersion edge */}
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

          {/* L8 — content */}
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
