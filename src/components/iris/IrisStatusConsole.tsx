/**
 * IrisStatusConsole — terminal-style cycling observation feed.
 *
 * Shows a single line at a time, types it in character by character,
 * holds, then advances to the next. Lines are derived live from store
 * data: what Iris is observing + recent business events.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "@/lib/types";
import {
  runAttentionRules,
  countByPriority,
  buildBusinessInsights,
} from "@/lib/intelligence";
import { cn, formatCurrency } from "@/lib/utils";

interface IrisStatusConsoleProps {
  data: AppData;
  className?: string;
}

function relativeTime(then: Date, now: Date): string {
  const ms = now.getTime() - then.getTime();
  if (ms < 0) return "just now";
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function buildLines(data: AppData, now: Date): string[] {
  const lines: string[] = [];

  // Attention
  const attention = runAttentionRules(data, now);
  const counts = countByPriority(attention);
  if (counts.critical > 0) {
    lines.push(
      `${counts.critical} critical item${counts.critical === 1 ? "" : "s"} flagged`,
    );
  }
  if (counts.high > 0) {
    lines.push(
      `${counts.high} high-priority observation${counts.high === 1 ? "" : "s"}`,
    );
  }

  // Today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayJobs = data.appointments.filter((a) => {
    const d = new Date(a.start);
    return d >= todayStart && d < todayEnd;
  });
  if (todayJobs.length > 0) {
    lines.push(
      `scanning ${todayJobs.length} job${todayJobs.length === 1 ? "" : "s"} on today's calendar`,
    );
  } else {
    lines.push("no jobs scheduled for today");
  }

  // Recent completions
  const recentCompletions = [...data.appointments]
    .filter((a) => a.actualEndAt)
    .sort(
      (a, b) =>
        new Date(b.actualEndAt!).getTime() - new Date(a.actualEndAt!).getTime(),
    )
    .slice(0, 3);
  for (const c of recentCompletions) {
    const when = new Date(c.actualEndAt!);
    const ms = now.getTime() - when.getTime();
    if (ms < 1000 * 60 * 60 * 72) {
      const customer = data.customers.find((cu) => cu.id === c.customerId);
      const firstName = customer?.name?.split(" ")[0];
      lines.push(
        `${relativeTime(when, now)} · job completed${firstName ? ` for ${firstName}` : ""}`,
      );
    }
  }

  // Insights
  const insights = buildBusinessInsights(data, now);
  for (const ins of insights.slice(0, 2)) {
    lines.push(ins.title.toLowerCase());
  }

  // Customers
  if (data.customers.length > 0) {
    lines.push(
      `tracking ${data.customers.length} customer${data.customers.length === 1 ? "" : "s"} across the book`,
    );
  }

  // Open balances
  const openCents = data.receipts.reduce((sum, r) => {
    const balance = (r.totalCents ?? 0) - (r.amountPaidCents ?? 0);
    return sum + Math.max(0, balance);
  }, 0);
  if (openCents > 0) {
    lines.push(
      `${formatCurrency(openCents / 100)} outstanding across receipts`,
    );
  }

  // Recent leads
  const recentLeads = [...data.leads]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 2);
  for (const l of recentLeads) {
    const when = new Date(l.createdAt);
    const ms = now.getTime() - when.getTime();
    if (ms < 1000 * 60 * 60 * 24 * 7) {
      lines.push(`${relativeTime(when, now)} · new lead in the pipeline`);
    }
  }

  // Fallback chatter
  if (lines.length < 3) {
    lines.push("standing by · nothing pressing");
    lines.push("watching every part of the business");
    lines.push("ready when you are");
  }

  return lines;
}

export function IrisStatusConsole({ data, className }: IrisStatusConsoleProps) {
  const [now, setNow] = useState(() => new Date());
  const lines = useMemo(() => buildLines(data, now), [data, now]);

  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const stopRef = useRef(false);

  // Refresh "now" every minute for relative timestamps.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Typewriter cycle.
  useEffect(() => {
    stopRef.current = false;
    setTyped("");
    if (lines.length === 0) return;

    const target = lines[lineIndex % lines.length] ?? "";
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (stopRef.current) return;
      i += 1;
      setTyped(target.slice(0, i));
      if (i < target.length) {
        timer = setTimeout(tick, 26 + Math.random() * 22);
      } else {
        timer = setTimeout(() => {
          if (stopRef.current) return;
          setLineIndex((idx) => (idx + 1) % lines.length);
        }, 2600);
      }
    };
    tick();

    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [lineIndex, lines]);

  return (
    <div
      className={cn(
        "font-mono text-xs text-foreground/75 tabular-nums",
        "flex items-center justify-center gap-2 min-h-[1.75rem]",
        className,
      )}
      aria-live="polite"
    >
      <span className="text-primary">{">"}</span>
      <span className="whitespace-nowrap overflow-hidden">{typed}</span>
      <span className="inline-block h-3 w-[3px] bg-primary animate-iris-cursor-blink shadow-[0_0_6px_hsl(var(--primary))]" />
    </div>
  );
}
