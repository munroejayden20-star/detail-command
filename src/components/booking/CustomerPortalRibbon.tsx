/**
 * CustomerPortalRibbon — slim returning-customer banner on /book.
 *
 * Fixed at the very top (z-[60]), above the TopNav. Exports its height as
 * `RIBBON_HEIGHT_PX` so the page can offset the TopNav and Hero below it.
 * Pointer events land on the ribbon (not swallowed by the fixed nav).
 *
 * Content:
 *   "Welcome back, {first} · Next: Tue 2:00 PM   [View dashboard →]"
 */
import { ArrowUpRight, CalendarClock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { CustomerPortalData } from "@/lib/booking-api";

/** Exported so BookingPage can offset the fixed TopNav by this many pixels
 *  when the ribbon is rendered. Keep in sync with the visual height below. */
export const RIBBON_HEIGHT_PX = 48;

const LA_TZ = "America/Los_Angeles";

interface Props {
  data: CustomerPortalData;
}

export function CustomerPortalRibbon({ data }: Props) {
  const first = (data.customer.name || "").trim().split(/\s+/)[0] || "there";
  const next = data.upcoming[0];

  return (
    <div
      role="region"
      aria-label="Returning customer"
      style={{ height: RIBBON_HEIGHT_PX }}
      className="fixed inset-x-0 top-0 z-[60] isolate w-full border-b border-white/[0.08] bg-obsidian-950/92 backdrop-blur-xl"
    >
      {/* Ember accent stripe — bottom edge (separates ribbon from nav) */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ember-500/45 to-transparent"
      />
      {/* Subtle radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_50%_0%,rgba(221,41,20,0.10),transparent_70%)]"
      />

      <div className="relative mx-auto flex h-full w-full max-w-[1320px] items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6 md:px-10">
        {/* Welcome + next appointment */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
            <p className="truncate text-[13px] font-medium text-platinum-50">
              <span className="hidden sm:inline">Welcome back, </span>
              <span className="sm:hidden">Hi, </span>
              {first}
            </p>
            {/* Next-appointment chip — hides on very narrow screens to keep
                the line breathing room. CTA stays accessible regardless. */}
            <p className="hidden min-w-0 items-center gap-1.5 truncate font-mono text-[10.5px] uppercase tracking-[0.18em] text-platinum-300/80 sm:flex">
              {next ? (
                <>
                  <CalendarClock className="h-3 w-3 shrink-0 text-ember-300" />
                  <span className="truncate">
                    Next · {formatApptShort(next.startAt)}
                  </span>
                </>
              ) : (
                <span className="truncate">No upcoming appointments yet</span>
              )}
            </p>
          </div>
        </div>

        {/* View dashboard CTA */}
        <Link
          to="/portal"
          className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 text-[10.5px] font-medium uppercase tracking-[0.2em] text-platinum-100 transition-all duration-300 hover:border-ember-400/40 hover:bg-ember-500/10 hover:text-platinum-50 sm:px-4 sm:text-[11px] sm:tracking-[0.22em]"
        >
          <span className="hidden sm:inline">View dashboard</span>
          <span className="sm:hidden">Dashboard</span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function formatApptShort(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: LA_TZ,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}
