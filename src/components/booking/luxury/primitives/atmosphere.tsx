/* ============================================================================
 * Atmospheric primitives — decorative background layers.
 *
 * MouseSpotlight, GrainOverlay, CarbonWeave, FloatingParticles, VolumetricFog,
 * CinematicVignette, EmberOrb. All purely visual, all absolute-positioned by
 * default, all pointer-events:none. Compose into hero/manifesto/water-power
 * sections to layer atmosphere without inline gradients.
 * ========================================================================== */

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────────
 * MouseSpotlight — fixed radial ember glow that tracks the cursor.
 * Disabled on touch devices via pointer-coarse media query.
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
 * GrainOverlay — SVG turbulence baked as a data URI. Multiply mode keeps
 * the background's color but adds tactile noise.
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
 * water/power card.
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
 * keyframes (`lx-mote-float` / `lx-mote-float-rev`).
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
 * (`lx-fog-drift`). Cheaper than HeroAmbient's motion-driven smoke blobs.
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
