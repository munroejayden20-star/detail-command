/**
 * Iris orb — the signature animated element of the intelligence layer.
 * Canvas-based particle + lightning + radial gradient system.
 *
 * Visual identity: automotive-aggressive, premium. Red-dominant, charcoal
 * sphere, electric arcs across the surface, orbital particles, breathing
 * halo, expanding pulse waves.
 *
 * Render layers (bottom → top):
 *   1. Outer halo glow (radial, breathing)
 *   2. Pulse waves (expanding rings, state-driven cadence)
 *   3. Background orbit particles (behind core sphere)
 *   4. Core sphere (multi-stop radial gradient with animated highlight)
 *   5. Specular shine (parallax highlight on top-left)
 *   6. Inner shimmer arc
 *   7. Foreground orbit particles
 *   8. Energy arcs (jagged lightning, fade out)
 *   9. Center heart dot
 *
 * States:
 *   - idle:     calm, slow drift, occasional spark
 *   - thinking: faster orbit, frequent white-blue arcs, brighter breathing
 *   - alert:    aggressive red, dense particles, frequent red lightning
 *   - success:  warm gold flare; particles + arcs in amber tones
 *
 * Sizes (px):
 *   xs 20 | sm 32 | md 72 | lg 140 | xl 220
 *
 * For sizes < 60px (xs, sm) the particle + arc layers are skipped — they
 * don't read at small scale and would burn cycles for nothing. The core
 * + halo + heart still animate.
 *
 * Motion: respects `prefers-reduced-motion` — falls back to a static
 * radial-gradient sphere with no canvas.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "thinking" | "alert" | "success";
export type OrbSize = "xs" | "sm" | "md" | "lg" | "xl";

interface IrisOrbProps {
  state?: OrbState;
  size?: OrbSize;
  /** Hide outer halo (useful when embedding in tight spaces). */
  noHalo?: boolean;
  /** Override the rendered pixel size; defaults to the size preset. */
  pixelSize?: number;
  className?: string;
}

const SIZE_PX: Record<OrbSize, number> = {
  xs: 20,
  sm: 32,
  md: 72,
  lg: 140,
  xl: 220,
};

/** Canvas field grows beyond the nominal orb size so halo + pulses have room. */
const FIELD_MULTIPLIER = 1.55;

interface StateConfig {
  particles: number;
  particleSpeed: number;            // base angular speed (rad/ms)
  arcChancePerFrame: number;        // probability of spawning an arc each frame
  arcMaxDurationMs: number;
  arcColor: [number, number, number]; // rgb
  arcWidth: number;
  coreStops: string[];              // 4 hex colors innermost → outermost
  haloRgba: string;
  haloIntensity: number;
  pulseIntervalMs: number;
  pulseColor: [number, number, number];
  pulseWidth: number;
  breatheAmp: number;
  breatheSpeed: number;             // rad/ms
  heartGlow: [number, number, number];
  heartRadiusMul: number;           // multiplier on px
  particleHueRange: [number, number]; // hsl hue range
}

const STATE_CONFIG: Record<OrbState, StateConfig> = {
  idle: {
    particles: 70,
    particleSpeed: 0.0007,
    arcChancePerFrame: 0.0025,
    arcMaxDurationMs: 260,
    arcColor: [255, 210, 210],
    arcWidth: 1.1,
    coreStops: ["#ffe1e1", "#ef4444", "#7f1d1d", "#0a0203"],
    haloRgba: "rgba(220,38,38,0.42)",
    haloIntensity: 1,
    pulseIntervalMs: 2600,
    pulseColor: [244, 63, 94],
    pulseWidth: 1.1,
    breatheAmp: 0.05,
    breatheSpeed: 0.0009,
    heartGlow: [255, 90, 90],
    heartRadiusMul: 0.022,
    particleHueRange: [350, 14],
  },
  thinking: {
    particles: 110,
    particleSpeed: 0.0016,
    arcChancePerFrame: 0.006,
    arcMaxDurationMs: 220,
    arcColor: [240, 246, 255],
    arcWidth: 1.3,
    coreStops: ["#fff0f0", "#fb7185", "#9f1239", "#0d0306"],
    haloRgba: "rgba(244,63,94,0.55)",
    haloIntensity: 1.15,
    pulseIntervalMs: 1300,
    pulseColor: [251, 113, 133],
    pulseWidth: 1.4,
    breatheAmp: 0.09,
    breatheSpeed: 0.0015,
    heartGlow: [255, 255, 255],
    heartRadiusMul: 0.026,
    particleHueRange: [340, 20],
  },
  alert: {
    particles: 150,
    particleSpeed: 0.0024,
    arcChancePerFrame: 0.038,
    arcMaxDurationMs: 190,
    arcColor: [255, 70, 70],
    arcWidth: 1.6,
    coreStops: ["#ffeaea", "#ff3838", "#7f1d1d", "#170303"],
    haloRgba: "rgba(255,38,38,0.7)",
    haloIntensity: 1.4,
    pulseIntervalMs: 850,
    pulseColor: [255, 50, 50],
    pulseWidth: 1.8,
    breatheAmp: 0.13,
    breatheSpeed: 0.0026,
    heartGlow: [255, 60, 60],
    heartRadiusMul: 0.034,
    particleHueRange: [355, 12],
  },
  success: {
    particles: 90,
    particleSpeed: 0.0013,
    arcChancePerFrame: 0.012,
    arcMaxDurationMs: 240,
    arcColor: [255, 230, 170],
    arcWidth: 1.3,
    coreStops: ["#fff5dc", "#fbbf24", "#9a3412", "#1c0a04"],
    haloRgba: "rgba(251,191,36,0.55)",
    haloIntensity: 1.2,
    pulseIntervalMs: 2000,
    pulseColor: [251, 191, 36],
    pulseWidth: 1.2,
    breatheAmp: 0.08,
    breatheSpeed: 0.0014,
    heartGlow: [255, 220, 140],
    heartRadiusMul: 0.026,
    particleHueRange: [28, 56],
  },
};

interface Particle {
  baseRadius: number;     // base orbit radius (fraction of orb radius)
  radius: number;         // current orbit radius (with wobble)
  angle: number;
  angularSpeed: number;
  size: number;
  baseAlpha: number;
  hue: number;
  saturation: number;
  light: number;
  wobbleAmp: number;
  wobblePhase: number;
  wobbleSpeed: number;
  /** True if particle's orbit radius is greater than the core sphere radius (drawn around/over orb). */
  outer: boolean;
  /** Z-position fakery for parallax glow when crossing in front of the core. */
  z: number;
}

interface PulseWave {
  startedAt: number;
}

interface Arc {
  startedAt: number;
  duration: number;
  points: Array<{ x: number; y: number }>;
  width: number;
  color: [number, number, number];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hueInRange(range: [number, number]): number {
  // hue range may wrap past 360 (e.g. 350..14 means red wrapping through 0)
  const [a, b] = range;
  if (a <= b) return rand(a, b);
  const span = 360 - a + b;
  const t = Math.random() * span;
  return (a + t) % 360;
}

function createParticles(count: number, cfg: StateConfig): Particle[] {
  const ps: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // 70% on outer orbital rings (around/beyond the core), 30% inside the sphere
    const outer = Math.random() < 0.7;
    const baseRadius = outer
      ? rand(0.52, 0.92) // orbits around the core, fanning into halo
      : rand(0.18, 0.46); // smaller orbits inside the sphere
    ps.push({
      baseRadius,
      radius: baseRadius,
      angle: Math.random() * Math.PI * 2,
      angularSpeed:
        cfg.particleSpeed *
        rand(0.6, 1.7) *
        (Math.random() < 0.5 ? 1 : -1) *
        // Inner particles drift slower
        (outer ? 1 : 0.45),
      size: outer ? rand(0.6, 1.9) : rand(0.4, 1.1),
      baseAlpha: outer ? rand(0.35, 0.95) : rand(0.5, 1),
      hue: hueInRange(cfg.particleHueRange),
      saturation: rand(70, 100),
      light: outer ? rand(60, 88) : rand(78, 96),
      wobbleAmp: rand(0.015, 0.05),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: rand(0.0008, 0.003),
      outer,
      z: rand(-1, 1),
    });
  }
  return ps;
}

function generateArcPoints(
  cx: number,
  cy: number,
  orbR: number,
  segments: number,
): Array<{ x: number; y: number }> {
  // Pick start + end on the orb surface (slight inset)
  const a0 = Math.random() * Math.PI * 2;
  const a1 = a0 + rand(0.8, 2.3) * (Math.random() < 0.5 ? 1 : -1);
  const r0 = orbR * rand(0.62, 0.96);
  const r1 = orbR * rand(0.62, 0.96);
  const x0 = cx + Math.cos(a0) * r0;
  const y0 = cy + Math.sin(a0) * r0;
  const x1 = cx + Math.cos(a1) * r1;
  const y1 = cy + Math.sin(a1) * r1;

  const pts: Array<{ x: number; y: number }> = [{ x: x0, y: y0 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const baseX = x0 + (x1 - x0) * t;
    const baseY = y0 + (y1 - y0) * t;
    // Jagged perpendicular offset, larger near middle
    const taper = Math.sin(t * Math.PI);
    const jitter = orbR * 0.12 * taper;
    pts.push({
      x: baseX + rand(-jitter, jitter),
      y: baseY + rand(-jitter, jitter),
    });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

export function IrisOrb({
  state = "idle",
  size = "md",
  noHalo = false,
  pixelSize,
  className,
}: IrisOrbProps) {
  const px = pixelSize ?? SIZE_PX[size];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const noHaloRef = useRef<boolean>(noHalo);

  // Track props in refs so the animation loop sees fresh values without restart.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    noHaloRef.current = noHalo;
  }, [noHalo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Honor prefers-reduced-motion — skip animation entirely.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    // Skip the particle/arc layer at very small sizes — won't read anyway.
    const enableParticleLayer = px >= 60;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fieldPx = Math.round(px * FIELD_MULTIPLIER);
    canvas.width = fieldPx * dpr;
    canvas.height = fieldPx * dpr;
    canvas.style.width = `${fieldPx}px`;
    canvas.style.height = `${fieldPx}px`;
    ctx.scale(dpr, dpr);

    const cx = fieldPx / 2;
    const cy = fieldPx / 2;
    const orbR = px / 2;
    const haloR = fieldPx / 2; // outer halo radius

    let cfg = STATE_CONFIG[stateRef.current];
    let particles: Particle[] = enableParticleLayer
      ? createParticles(cfg.particles, cfg)
      : [];
    let activeState: OrbState = stateRef.current;
    let pulses: PulseWave[] = [];
    let arcs: Arc[] = [];
    let lastPulseAt = 0;
    let raf = 0;
    let running = true;
    let startTs = performance.now();

    // Pause animation when off-screen (saves CPU when multiple orbs exist).
    let visible = true;
    let observer: IntersectionObserver | null = null;
    const container = containerRef.current;
    if (container && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0 },
      );
      observer.observe(container);
    }

    function draw(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      if (!visible) return;

      // Hot-swap state config without losing particle continuity.
      if (stateRef.current !== activeState) {
        activeState = stateRef.current;
        const next = STATE_CONFIG[activeState];
        // Re-tune existing particle angular speeds + colors instead of full recreate
        // (keeps motion smooth across state transitions).
        const scale = next.particleSpeed / cfg.particleSpeed;
        for (const p of particles) {
          p.angularSpeed *= scale;
          p.hue = hueInRange(next.particleHueRange);
        }
        // Adjust count by adding or trimming.
        if (enableParticleLayer && next.particles > particles.length) {
          particles = particles.concat(
            createParticles(next.particles - particles.length, next),
          );
        } else if (next.particles < particles.length) {
          particles.length = next.particles;
        }
        cfg = next;
      }

      const tElapsed = now - startTs;

      // ── CLEAR ─────────────────────────────────────────────────────
      ctx!.clearRect(0, 0, fieldPx, fieldPx);

      // Breathing scale [1-amp .. 1+amp]
      const breathe = 1 + Math.sin(tElapsed * cfg.breatheSpeed) * cfg.breatheAmp;

      // ── 1. OUTER HALO ─────────────────────────────────────────────
      if (!noHaloRef.current) {
        const haloRadius = haloR * breathe;
        const grad = ctx!.createRadialGradient(cx, cy, orbR * 0.4, cx, cy, haloRadius);
        // Parse rgba in cfg.haloRgba
        grad.addColorStop(0, cfg.haloRgba);
        grad.addColorStop(0.45, cfg.haloRgba.replace(/,([0-9.]+)\)/, ",0.12)"));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.globalCompositeOperation = "source-over";
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, fieldPx, fieldPx);
      }

      // ── 2. PULSE WAVES (spawn) ────────────────────────────────────
      if (!noHaloRef.current && now - lastPulseAt > cfg.pulseIntervalMs) {
        pulses.push({ startedAt: now });
        lastPulseAt = now;
      }
      // Pulse waves (draw + cull)
      pulses = pulses.filter((p) => {
        const age = now - p.startedAt;
        const lifeMs = cfg.pulseIntervalMs * 1.4;
        if (age > lifeMs) return false;
        const t = age / lifeMs;
        const r = orbR + (haloR - orbR) * t;
        const alpha = (1 - t) * 0.55;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.lineWidth = cfg.pulseWidth;
        ctx!.strokeStyle = `rgba(${cfg.pulseColor[0]},${cfg.pulseColor[1]},${cfg.pulseColor[2]},${alpha})`;
        ctx!.stroke();
        return true;
      });

      // ── 3. BACKGROUND PARTICLES (behind core) ─────────────────────
      if (enableParticleLayer) {
        ctx!.globalCompositeOperation = "lighter";
        for (const p of particles) {
          if (!p.outer) continue;
          p.angle += p.angularSpeed * 16; // approximate per-frame at ~60fps
          p.radius =
            p.baseRadius + Math.sin(now * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;
          const r = p.radius * orbR * breathe;
          const x = cx + Math.cos(p.angle) * r;
          const y = cy + Math.sin(p.angle) * r;
          // Particles "behind" core — drawn only when on far side (z < 0)
          if (Math.sin(p.angle + p.z) < 0) {
            const alpha = p.baseAlpha * 0.7;
            ctx!.fillStyle = `hsla(${p.hue},${p.saturation}%,${p.light}%,${alpha})`;
            ctx!.beginPath();
            ctx!.arc(x, y, p.size, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
        ctx!.globalCompositeOperation = "source-over";
      }

      // ── 4. CORE SPHERE ────────────────────────────────────────────
      const coreR = orbR * breathe;
      // Animated highlight position (subtle parallax wobble)
      const highlightX = cx - coreR * (0.28 + Math.sin(tElapsed * 0.0006) * 0.04);
      const highlightY = cy - coreR * (0.32 + Math.cos(tElapsed * 0.0005) * 0.04);
      const coreGrad = ctx!.createRadialGradient(
        highlightX,
        highlightY,
        coreR * 0.05,
        cx,
        cy,
        coreR,
      );
      coreGrad.addColorStop(0, cfg.coreStops[0]);
      coreGrad.addColorStop(0.22, cfg.coreStops[1]);
      coreGrad.addColorStop(0.62, cfg.coreStops[2]);
      coreGrad.addColorStop(1, cfg.coreStops[3]);
      ctx!.fillStyle = coreGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fill();

      // Inset shadow on sphere (subtle, helps it read as 3D against bright halo)
      const shadowGrad = ctx!.createRadialGradient(cx, cy, coreR * 0.85, cx, cy, coreR);
      shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
      shadowGrad.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx!.fillStyle = shadowGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fill();

      // ── 5. SPECULAR SHINE ────────────────────────────────────────
      ctx!.globalCompositeOperation = "screen";
      const shineGrad = ctx!.createRadialGradient(
        highlightX,
        highlightY,
        0,
        highlightX,
        highlightY,
        coreR * 0.55,
      );
      shineGrad.addColorStop(0, "rgba(255,255,255,0.85)");
      shineGrad.addColorStop(0.35, "rgba(255,255,255,0.18)");
      shineGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = shineGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";

      // ── 6. INNER SHIMMER ARC ─────────────────────────────────────
      // A short bright arc that travels around the sphere just inside its edge
      const shimmerAngle = (tElapsed * 0.0009) % (Math.PI * 2);
      const shimmerR = coreR * 0.94;
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(shimmerAngle);
      ctx!.beginPath();
      ctx!.arc(0, 0, shimmerR, -0.35, 0.35);
      const shimmerGrad = ctx!.createLinearGradient(
        Math.cos(-0.35) * shimmerR,
        Math.sin(-0.35) * shimmerR,
        Math.cos(0.35) * shimmerR,
        Math.sin(0.35) * shimmerR,
      );
      shimmerGrad.addColorStop(0, "rgba(255,255,255,0)");
      shimmerGrad.addColorStop(0.5, "rgba(255,255,255,0.55)");
      shimmerGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.strokeStyle = shimmerGrad;
      ctx!.lineWidth = 1.5;
      ctx!.globalCompositeOperation = "screen";
      ctx!.stroke();
      ctx!.restore();
      ctx!.globalCompositeOperation = "source-over";

      // ── 7. FOREGROUND PARTICLES ──────────────────────────────────
      if (enableParticleLayer) {
        ctx!.globalCompositeOperation = "lighter";
        for (const p of particles) {
          // Outer particles drawn on near side (z >= 0)
          if (p.outer) {
            if (Math.sin(p.angle + p.z) < 0) continue;
            const r = p.radius * orbR * breathe;
            const x = cx + Math.cos(p.angle) * r;
            const y = cy + Math.sin(p.angle) * r;
            const alpha = p.baseAlpha;
            ctx!.fillStyle = `hsla(${p.hue},${p.saturation}%,${p.light}%,${alpha})`;
            ctx!.beginPath();
            ctx!.arc(x, y, p.size, 0, Math.PI * 2);
            ctx!.fill();
            // Soft glow halo around each foreground particle
            const glow = ctx!.createRadialGradient(x, y, 0, x, y, p.size * 3.5);
            glow.addColorStop(0, `hsla(${p.hue},${p.saturation}%,${p.light}%,${alpha * 0.5})`);
            glow.addColorStop(1, `hsla(${p.hue},${p.saturation}%,${p.light}%,0)`);
            ctx!.fillStyle = glow;
            ctx!.beginPath();
            ctx!.arc(x, y, p.size * 3.5, 0, Math.PI * 2);
            ctx!.fill();
          } else {
            // Inner particles — drift inside the sphere as faint embers
            p.angle += p.angularSpeed * 16;
            p.radius =
              p.baseRadius +
              Math.sin(now * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;
            const r = p.radius * orbR * breathe;
            const x = cx + Math.cos(p.angle) * r;
            const y = cy + Math.sin(p.angle) * r;
            const alpha = p.baseAlpha * 0.55;
            ctx!.fillStyle = `hsla(${p.hue},${p.saturation}%,${p.light}%,${alpha})`;
            ctx!.beginPath();
            ctx!.arc(x, y, p.size * 0.8, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
        ctx!.globalCompositeOperation = "source-over";
      }

      // ── 8. ENERGY ARCS ───────────────────────────────────────────
      if (enableParticleLayer && Math.random() < cfg.arcChancePerFrame) {
        arcs.push({
          startedAt: now,
          duration: rand(120, cfg.arcMaxDurationMs),
          points: generateArcPoints(cx, cy, orbR, Math.round(rand(4, 8))),
          width: cfg.arcWidth * rand(0.8, 1.4),
          color: cfg.arcColor,
        });
        // Hard cap so a flurry doesn't accumulate
        if (arcs.length > 12) arcs.shift();
      }
      arcs = arcs.filter((arc) => {
        const age = now - arc.startedAt;
        if (age > arc.duration) return false;
        const t = age / arc.duration;
        // Fast fade-in (0-15%), slow fade-out
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        const [r, g, b] = arc.color;
        ctx!.globalCompositeOperation = "screen";
        // Glow underlayer (wider, lower alpha)
        ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
        ctx!.lineWidth = arc.width * 3.2;
        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        ctx!.moveTo(arc.points[0].x, arc.points[0].y);
        for (let i = 1; i < arc.points.length; i++) {
          ctx!.lineTo(arc.points[i].x, arc.points[i].y);
        }
        ctx!.stroke();
        // Bright core stroke
        ctx!.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx!.lineWidth = arc.width;
        ctx!.beginPath();
        ctx!.moveTo(arc.points[0].x, arc.points[0].y);
        for (let i = 1; i < arc.points.length; i++) {
          ctx!.lineTo(arc.points[i].x, arc.points[i].y);
        }
        ctx!.stroke();
        ctx!.globalCompositeOperation = "source-over";
        return true;
      });

      // ── 9. CENTER HEART ──────────────────────────────────────────
      const heartR = Math.max(1.4, px * cfg.heartRadiusMul);
      const heartPulse = 0.85 + (Math.sin(tElapsed * cfg.breatheSpeed * 2.2) + 1) * 0.075;
      const [hr, hg, hb] = cfg.heartGlow;
      ctx!.globalCompositeOperation = "screen";
      const heartGlowGrad = ctx!.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        heartR * 6 * heartPulse,
      );
      heartGlowGrad.addColorStop(0, `rgba(${hr},${hg},${hb},0.65)`);
      heartGlowGrad.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
      ctx!.fillStyle = heartGlowGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, heartR * 6, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";
      ctx!.fillStyle = "white";
      ctx!.beginPath();
      ctx!.arc(cx, cy, heartR * heartPulse, 0, Math.PI * 2);
      ctx!.fill();
    }

    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [px]);

  // Static fallback for reduced motion (and SSR / no-canvas).
  const reduceMotionFallback = (
    <div
      aria-hidden
      className="absolute rounded-full"
      style={{
        inset: "12%",
        background:
          "radial-gradient(circle at 30% 25%, #ffd6d6 0%, #ef4444 28%, #7f1d1d 65%, #0a0203 100%)",
        boxShadow:
          "inset 0 2px 8px rgba(0,0,0,0.55), 0 0 24px 6px rgba(220,38,38,0.4)",
      }}
    />
  );

  const fieldPx = Math.round(px * FIELD_MULTIPLIER);
  const fieldOffset = Math.round((fieldPx - px) / 2);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {/* Canvas extends beyond the orb footprint so halo + pulses can render. */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute motion-reduce:hidden"
        style={{
          left: -fieldOffset,
          top: -fieldOffset,
          width: fieldPx,
          height: fieldPx,
        }}
      />
      {/* Reduced-motion fallback */}
      <div className="hidden motion-reduce:block absolute inset-0">
        {reduceMotionFallback}
      </div>
    </div>
  );
}
