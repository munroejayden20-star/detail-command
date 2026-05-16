/**
 * WeatherWatchCard — Phase H3 dashboard surface for upcoming-job weather.
 *
 * For each non-canceled appointment in the next 7 days, looks up the daily
 * forecast for the business's service area and matches it by date. Flags
 * jobs where rain probability is high so you can preempt the customer.
 *
 * Hidden silently when:
 *   - there are no upcoming appointments
 *   - the weather edge function is unreachable (e.g. not deployed yet)
 *
 * That last rule is intentional — failing softly keeps the dashboard tidy
 * for installs that haven't deployed the H3 functions yet.
 */
import { useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import {
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  Cloud,
  Sun,
  CloudFog,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { toBusinessDateKey, formatBusinessMonthDay, formatBusinessTime } from "@/lib/datetime";
import { lookupWeather } from "@/lib/intelligence";
import type { WeatherDay, WeatherFinding } from "@/lib/intelligence";

const WINDOW_DAYS = 7;
const RAIN_THRESHOLD_PCT = 50;

const ACTIVE_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "in_progress",
  "pending_approval",
]);

/* ─────────────────────────────────────────────
   Weather code → icon
───────────────────────────────────────────── */

function weatherIcon(code: number) {
  if (code === 0 || code === 1) return Sun;
  if (code === 2 || code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return CloudRain;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return CloudSnow;
  return Cloud;
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

interface UpcomingWithWeather {
  apptId: string;
  customerName: string;
  start: string;
  weather: WeatherDay | null;
}

export function WeatherWatchCard() {
  const { data } = useStore();
  const [finding, setFinding] = useState<WeatherFinding | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const upcomingAppts = useMemo(() => {
    const now = Date.now();
    const cutoff = now + WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return data.appointments
      .filter((a) => ACTIVE_STATUSES.has(a.status))
      .filter((a) => {
        const t = parseISO(a.start).getTime();
        return t >= now && t <= cutoff;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [data.appointments]);

  // Fire weather lookup once when the upcoming list is non-empty.
  useEffect(() => {
    if (upcomingAppts.length === 0) return;
    let cancelled = false;
    setLoading(true);
    lookupWeather({ forecastDays: WINDOW_DAYS })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok || !r.data) {
          setUnavailable(true);
          setFinding(null);
        } else {
          setUnavailable(false);
          setFinding(r.data);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [upcomingAppts.length]);

  // No upcoming jobs → nothing to render. Same when weather is unreachable
  // (we don't want a stale "unavailable" banner cluttering the dashboard).
  if (upcomingAppts.length === 0) return null;
  if (unavailable && !finding) return null;

  const enriched: UpcomingWithWeather[] = upcomingAppts.map((a) => {
    const key = toBusinessDateKey(a.start);
    const day = finding?.days.find((d) => d.date === key) ?? null;
    return {
      apptId: a.id,
      customerName:
        data.customers.find((c) => c.id === a.customerId)?.name ?? "Customer",
      start: a.start,
      weather: day,
    };
  });

  const riskyCount = enriched.filter(
    (e) =>
      e.weather?.precipitationProbabilityPct != null &&
      e.weather.precipitationProbabilityPct >= RAIN_THRESHOLD_PCT,
  ).length;

  return (
    <Card className="border-sky-500/25">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudRain className="h-4 w-4 text-sky-500" />
              Iris · Weather Watch
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading
                ? "Checking the forecast for the service area…"
                : riskyCount > 0
                  ? `${riskyCount} ${riskyCount === 1 ? "job has" : "jobs have"} high rain risk this week.`
                  : `${enriched.length} upcoming jobs · forecast looks clear so far.`}
            </p>
          </div>
          {finding ? (
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
              title={`Source: open-meteo.com · ${finding.label}`}
            >
              Open-Meteo
            </a>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && !finding ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          enriched.map((e) => <WeatherRow key={e.apptId} entry={e} />)
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────
   Row
───────────────────────────────────────────── */

function WeatherRow({ entry }: { entry: UpcomingWithWeather }) {
  const w = entry.weather;
  const precip = w?.precipitationProbabilityPct ?? null;
  const risky = precip != null && precip >= RAIN_THRESHOLD_PCT;
  const Icon = w ? weatherIcon(w.weatherCode) : Cloud;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
        risky
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border/80 bg-card hover:bg-hover",
      )}
    >
      <div
        className={cn(
          "shrink-0 flex h-8 w-8 items-center justify-center rounded-md border",
          risky
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-border bg-background text-sky-600 dark:text-sky-400",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">
          {entry.customerName}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatBusinessMonthDay(entry.start)} · {formatBusinessTime(entry.start)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {w ? (
          <>
            <p className={cn("text-xs font-semibold", risky ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>
              {w.conditions}
            </p>
            {precip != null ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {precip}% rain
                {w.highF != null ? ` · ${Math.round(w.highF)}°F` : ""}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">No forecast</p>
        )}
      </div>
      {risky ? (
        <div
          className="shrink-0 inline-flex items-center"
          title="High rain probability — consider rescheduling exterior work"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </div>
      ) : null}
    </div>
  );
}
