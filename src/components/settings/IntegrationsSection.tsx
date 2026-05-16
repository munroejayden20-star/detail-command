/**
 * Settings → Integrations panel for Iris Phase H3.
 *
 * Shows the status of the external-search and weather edge functions and
 * provides a small test surface so the admin can verify keys are deployed
 * correctly without leaving the app.
 *
 * Phase H5 will add Google Calendar / Gmail / Maps / Business Profile
 * integration controls here too.
 */
import { useState } from "react";
import { Cloud, Globe, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  lookupWeather,
  searchWeb,
  type ExternalReason,
  type ExternalFinding,
  type WeatherFinding,
} from "@/lib/intelligence";
import { ExternalSourceChip } from "@/components/intelligence/ExternalSourceChip";

type Status = "unknown" | "ok" | "not_configured" | "error";

const STATUS_PILL: Record<Status, string> = {
  unknown: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  not_configured: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const STATUS_LABEL: Record<Status, string> = {
  unknown: "Not tested",
  ok: "Connected",
  not_configured: "Not configured",
  error: "Error",
};

function reasonToStatus(r: ExternalReason): Status {
  switch (r) {
    case "ok":
      return "ok";
    case "provider_not_configured":
    case "web_search_disabled":
    case "supabase_unconfigured":
      return "not_configured";
    case "unauthorized":
    case "provider_failed":
    case "bad_query":
    case "unknown_error":
    default:
      return "error";
  }
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

export function IntegrationsSection() {
  const [webStatus, setWebStatus] = useState<Status>("unknown");
  const [webMessage, setWebMessage] = useState<string>("");
  const [webQuery, setWebQuery] = useState("");
  const [webResult, setWebResult] = useState<ExternalFinding | null>(null);
  const [webLoading, setWebLoading] = useState(false);

  const [weatherStatus, setWeatherStatus] = useState<Status>("unknown");
  const [weatherMessage, setWeatherMessage] = useState<string>("");
  const [weatherResult, setWeatherResult] = useState<WeatherFinding | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  async function runWebSearch() {
    if (!webQuery.trim()) {
      toast.warning("Type something to search.");
      return;
    }
    setWebLoading(true);
    try {
      const r = await searchWeb(webQuery, { recency: "fresh", limit: 5 });
      const status = reasonToStatus(r.reason);
      setWebStatus(status);
      setWebMessage(r.reason === "ok" ? "" : r.message ?? r.reason);
      setWebResult(r.ok && r.data ? r.data : null);
      if (!r.ok) {
        toast.warning(`Web search: ${r.reason}`, { description: r.message });
      }
    } catch (err) {
      setWebStatus("error");
      setWebMessage(err instanceof Error ? err.message : String(err));
      setWebResult(null);
    } finally {
      setWebLoading(false);
    }
  }

  async function runWeatherTest() {
    setWeatherLoading(true);
    try {
      const r = await lookupWeather({ forecastDays: 3 });
      const status = reasonToStatus(r.reason);
      setWeatherStatus(status);
      setWeatherMessage(r.reason === "ok" ? "" : r.message ?? r.reason);
      setWeatherResult(r.ok && r.data ? r.data : null);
      if (!r.ok) {
        toast.warning(`Weather: ${r.reason}`, { description: r.message });
      }
    } catch (err) {
      setWeatherStatus("error");
      setWeatherMessage(err instanceof Error ? err.message : String(err));
      setWeatherResult(null);
    } finally {
      setWeatherLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          External services Iris uses for real-time information. Keys live
          server-side; this app never sees them. Iris calls these same endpoints
          when answering "current" questions.
        </p>
      </div>

      {/* ── Web Search ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <p className="font-semibold text-sm">Web search</p>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_PILL[webStatus])}>
            {STATUS_LABEL[webStatus]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Powered by the <code className="text-foreground">external-search</code> edge function
          (Tavily by default). Required secret:{" "}
          <code className="text-foreground">TAVILY_API_KEY</code>. Set with{" "}
          <code className="text-foreground">supabase secrets set TAVILY_API_KEY=&hellip;</code> and deploy with{" "}
          <code className="text-foreground">supabase functions deploy external-search</code>.
        </p>

        <div className="space-y-2">
          <Label htmlFor="web-query" className="text-xs">Test query</Label>
          <div className="flex gap-2">
            <Input
              id="web-query"
              value={webQuery}
              onChange={(e) => setWebQuery(e.target.value)}
              placeholder="e.g. current IRS mileage rate 2026"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runWebSearch();
                }
              }}
              disabled={webLoading}
            />
            <Button onClick={runWebSearch} disabled={webLoading} size="sm">
              {webLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Test
            </Button>
          </div>
        </div>

        {webMessage ? (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold">Detail:</span> {webMessage}
          </p>
        ) : null}

        {webResult ? (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <p className="text-xs font-semibold">Summary</p>
            <p className="text-xs leading-relaxed">{webResult.summary}</p>
            {webResult.citations.length > 0 ? (
              <>
                <p className="text-xs font-semibold pt-1">Citations</p>
                <div className="flex flex-wrap gap-1.5">
                  {webResult.citations.map((c, i) => (
                    <ExternalSourceChip key={`${c.url}-${i}`} citation={c} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <Separator />

      {/* ── Weather ────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Cloud className="h-4 w-4 text-sky-500 shrink-0" />
            <p className="font-semibold text-sm">Weather</p>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_PILL[weatherStatus])}>
            {STATUS_LABEL[weatherStatus]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Powered by Open-Meteo via the <code className="text-foreground">weather</code> edge function.
          No API key needed — just deploy with{" "}
          <code className="text-foreground">supabase functions deploy weather</code>. Defaults to Vancouver,
          WA; the dashboard's Weather Watch card uses this to flag rain risk on upcoming jobs.
        </p>
        <Button onClick={runWeatherTest} disabled={weatherLoading} size="sm" variant="outline">
          {weatherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
          Test forecast
        </Button>

        {weatherMessage ? (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold">Detail:</span> {weatherMessage}
          </p>
        ) : null}

        {weatherResult ? (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <p className="text-xs font-semibold">
              Forecast for {weatherResult.label} ({weatherResult.timezone})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {weatherResult.days.map((d) => (
                <div
                  key={d.date}
                  className="rounded-md border border-border/60 bg-background p-2 text-center"
                >
                  <p className="text-[10px] text-muted-foreground">{d.date.slice(5)}</p>
                  <p className="text-xs font-semibold mt-0.5">{d.conditions}</p>
                  {d.precipitationProbabilityPct != null ? (
                    <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {d.precipitationProbabilityPct}% rain
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        Phase H5 (Google integrations) and Iris configuration will add more
        controls to this section.
      </p>
    </div>
  );
}
