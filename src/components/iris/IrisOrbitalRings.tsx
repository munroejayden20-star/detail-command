/**
 * IrisOrbitalRings — HUD ring system wrapping the Iris orb.
 *
 * Three concentric circles rotating at different speeds, tick marks at
 * 30° intervals, and four compass-pinned stat labels (live time, jobs,
 * revenue, attention). Fills its parent — parent positions/sizes it.
 *
 * Pure SVG + CSS animations. The orb renders centered on top of the
 * rings — they're absolutely positioned and pointer-events-none.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface IrisOrbitalRingsProps {
  jobsToday: number;
  weekRevenue: string;
  monthPace: string;
  attention: number;
  className?: string;
}

export function IrisOrbitalRings({
  jobsToday,
  weekRevenue,
  monthPace,
  attention,
  className,
}: IrisOrbitalRingsProps) {
  // Live ticking clock for the top label.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "America/Los_Angeles",
  });
  const date = now
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    })
    .toUpperCase();

  // viewBox is 0..100 so percentage-based geometry is responsive.
  const CX = 50;
  const CY = 50;
  const R1 = 22; // inner
  const R2 = 30; // middle (with ticks)
  const R3 = 38; // outer (with rotating markers)

  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="iris-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Inner ring */}
        <g
          className="animate-iris-ring-spin-slow"
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle
            cx={CX}
            cy={CY}
            r={R1}
            fill="none"
            stroke="url(#iris-ring-grad)"
            strokeWidth="0.35"
            strokeDasharray="0.6 1.4"
          />
        </g>

        {/* Middle ring with tick marks */}
        <g
          className="animate-iris-ring-spin-med"
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle
            cx={CX}
            cy={CY}
            r={R2}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.35"
            strokeWidth="0.25"
            strokeDasharray="0.4 2.4"
          />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const inner = R2 - 1.4;
            const outer = R2 + 1.4;
            const x1 = CX + Math.cos(angle) * inner;
            const y1 = CY + Math.sin(angle) * inner;
            const x2 = CX + Math.cos(angle) * outer;
            const y2 = CY + Math.sin(angle) * outer;
            const major = i % 3 === 0;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--primary))"
                strokeOpacity={major ? "0.8" : "0.35"}
                strokeWidth={major ? "0.5" : "0.3"}
              />
            );
          })}
        </g>

        {/* Outer ring with three rotating markers */}
        <g
          className="animate-iris-ring-spin-fast"
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle
            cx={CX}
            cy={CY}
            r={R3}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.18"
            strokeWidth="0.25"
          />
          {[0, 120, 240].map((deg) => {
            const angle = (deg * Math.PI) / 180;
            const x = CX + Math.cos(angle) * R3;
            const y = CY + Math.sin(angle) * R3;
            return (
              <g key={deg}>
                <circle cx={x} cy={y} r="0.9" fill="hsl(var(--primary))" opacity="0.85" />
                <circle cx={x} cy={y} r="1.8" fill="hsl(var(--primary))" opacity="0.2" />
              </g>
            );
          })}
        </g>

        {/* Corner brackets — fixed to viewport, scribed inside outer ring */}
        {[
          { x: 10, y: 10, path: "M 10 16 L 10 10 L 16 10" },
          { x: 90, y: 10, path: "M 84 10 L 90 10 L 90 16" },
          { x: 10, y: 90, path: "M 10 84 L 10 90 L 16 90" },
          { x: 90, y: 90, path: "M 90 84 L 90 90 L 84 90" },
        ].map((b, i) => (
          <path
            key={i}
            d={b.path}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.45"
            strokeWidth="0.4"
          />
        ))}
      </svg>

      {/* Compass labels — fixed, not rotated */}
      <div className="absolute inset-0">
        {/* Top — live timestamp */}
        <div
          className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.18em] uppercase whitespace-nowrap"
          style={{ top: "6%" }}
        >
          <div className="flex items-center gap-1.5 text-primary/80">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-pulse" />
            <span className="tabular-nums">{time}</span>
            <span className="text-foreground/40">·</span>
            <span className="text-foreground/60">{date} · PT</span>
          </div>
        </div>

        {/* Right — jobs/attention */}
        <div
          className="absolute font-mono text-[10px] tracking-[0.14em] uppercase whitespace-nowrap"
          style={{ right: "4%", top: "50%", transform: "translateY(-50%)" }}
        >
          <div className="text-right text-foreground/55">
            <div>
              <span className="text-foreground font-semibold tabular-nums text-[12px]">
                {jobsToday}
              </span>
              <span className="ml-1">jobs</span>
            </div>
            <div className="mt-0.5">
              <span
                className={cn(
                  "font-semibold tabular-nums text-[12px]",
                  attention > 0 ? "text-primary" : "text-foreground",
                )}
              >
                {attention}
              </span>
              <span className="ml-1">attn</span>
            </div>
          </div>
        </div>

        {/* Bottom — weekly revenue + monthly pace */}
        <div
          className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.14em] uppercase whitespace-nowrap"
          style={{ bottom: "6%" }}
        >
          <div className="flex items-baseline gap-2 text-foreground/55">
            <span>
              <span className="text-foreground font-semibold tabular-nums text-[12px]">
                {weekRevenue}
              </span>{" "}
              wk
            </span>
            <span className="text-foreground/30">·</span>
            <span>
              <span className="text-foreground font-semibold tabular-nums text-[12px]">
                {monthPace}
              </span>{" "}
              mo
            </span>
          </div>
        </div>

        {/* Left — status pip */}
        <div
          className="absolute font-mono text-[10px] tracking-[0.16em] uppercase"
          style={{ left: "4%", top: "50%", transform: "translateY(-50%)" }}
        >
          <div className="flex flex-col items-start gap-0.5 text-foreground/55">
            <div className="flex items-center gap-1">
              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgb(16_185_129)]" />
              <span className="text-foreground/70 font-semibold">Iris</span>
            </div>
            <span className="text-foreground/40">online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
