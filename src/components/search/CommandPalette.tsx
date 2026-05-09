import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Search,
  Users,
  CalendarDays,
  UserPlus,
  CheckSquare,
  Sparkles,
  ReceiptText,
  Car,
  ArrowRight,
  CornerDownLeft,
  LayoutDashboard,
  BarChart2,
  FileBarChart2,
  Image as ImageIcon,
  ListChecks,
  Calculator,
  Hammer,
  Settings as SettingsIcon,
  Receipt,
} from "lucide-react";
import { useStore } from "@/store/store";
import type {
  Appointment,
  Customer,
  Lead,
  MileageEntry,
  Receipt as ReceiptType,
  Service,
  Task,
} from "@/lib/types";
import { cn, vehicleStr } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Custom DOM event that any button can fire to open the palette. */
export const OPEN_SEARCH_EVENT = "detail-command:open-search";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT));
}

type ResultGroup =
  | "customers"
  | "appointments"
  | "leads"
  | "tasks"
  | "services"
  | "receipts"
  | "mileage"
  | "navigation";

interface BaseResult {
  id: string;
  group: ResultGroup;
  groupLabel: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Higher = ranked higher within its group. */
  score: number;
  /** Where to navigate / what to do on activation. */
  action: () => void;
}

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: React.ElementType;
  keywords: string[];
}> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, keywords: ["home"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, keywords: ["schedule"] },
  { to: "/customers", label: "Customers", icon: Users, keywords: ["crm", "clients"] },
  { to: "/leads", label: "Leads", icon: UserPlus, keywords: ["prospects"] },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, keywords: ["todo"] },
  { to: "/services", label: "Services", icon: Sparkles, keywords: ["packages"] },
  { to: "/calculator", label: "Quote Calculator", icon: Calculator, keywords: ["quote", "estimate"] },
  { to: "/photos", label: "Photos", icon: ImageIcon, keywords: ["gallery"] },
  { to: "/checklists", label: "Checklists", icon: ListChecks, keywords: [] },
  { to: "/revenue", label: "Business Stats", icon: BarChart2, keywords: ["revenue", "income", "stats"] },
  { to: "/receipts", label: "Receipts", icon: ReceiptText, keywords: ["invoices"] },
  { to: "/tax-center", label: "Tax Center", icon: FileBarChart2, keywords: ["taxes", "irs"] },
  { to: "/mileage", label: "Mileage", icon: Car, keywords: ["miles", "trips", "deduction"] },
  { to: "/expenses", label: "Expenses", icon: Receipt, keywords: ["spend", "costs"] },
  { to: "/work", label: "Work Mode", icon: Hammer, keywords: ["detailer", "field"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, keywords: ["profile", "config"] },
];

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Score how well a query matches a target string.
 * - exact full match: 100
 * - prefix match: 70
 * - word-prefix match (after a space): 50
 * - substring match: 30
 * - no match: 0
 */
function scoreMatch(target: string | undefined, query: string): number {
  if (!target) return 0;
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 70;
  const words = t.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 50;
  if (t.includes(q)) return 30;
  return 0;
}

/** Combine multiple scored fields, weighted. */
function bestScore(query: string, fields: Array<[string | undefined, number]>): number {
  let best = 0;
  for (const [val, weight] of fields) {
    const s = scoreMatch(val, query);
    if (s * weight > best) best = s * weight;
  }
  return best;
}

/**
 * Global wrapper — mount once at the layout root. Handles:
 *  - the Cmd/Ctrl+K shortcut from anywhere
 *  - a custom DOM event so non-React code (or anything) can trigger it
 *  - "/" key to focus when not typing in an input
 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function isTyping(): boolean {
      const a = document.activeElement;
      if (!a) return false;
      const tag = a.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (a as HTMLElement).isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isTyping() && !open) {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    };
  }, [open]);

  return <CommandPalette open={open} onOpenChange={setOpen} />;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { data } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus the input after the dialog mount transition
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    return computeResults(query, data, navigate, () => onOpenChange(false));
  }, [query, data, navigate, onOpenChange]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);

  // Reset selection when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep selected item in view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, results]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.action();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100"
          )}
        />
        <DialogPrimitive.Content
          aria-label="Search"
          className={cn(
            "fixed left-1/2 top-[10vh] z-50 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-lift",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=open]:duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100"
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search across customers, appointments, leads, tasks, services, receipts, and mileage.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search anything — customers, jobs, leads, tasks, services…"
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              esc
            </kbd>
          </div>

          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto scrollbar-thin py-1"
          >
            {flat.length === 0 ? (
              <EmptyState query={query} />
            ) : (
              results.map((group) => (
                <div key={group.key} className="px-1">
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map((item) => {
                      const flatIndex = flat.indexOf(item);
                      const active = flatIndex === activeIndex;
                      return (
                        <li key={`${group.key}:${item.id}`}>
                          <button
                            type="button"
                            data-index={flatIndex}
                            onClick={item.action}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              active
                                ? "bg-primary/10 text-foreground"
                                : "text-foreground hover:bg-accent"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                                active
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <item.icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {item.title}
                              </span>
                              {item.subtitle ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {item.subtitle}
                                </span>
                              ) : null}
                            </span>
                            {item.badge ? (
                              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {item.badge}
                              </span>
                            ) : null}
                            <ArrowRight
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 transition-opacity",
                                active ? "opacity-100 text-primary" : "opacity-0"
                              )}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <KbdKey>↑</KbdKey>
              <KbdKey>↓</KbdKey>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KbdKey>
                <CornerDownLeft className="h-2.5 w-2.5" />
              </KbdKey>
              open
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <KbdKey>esc</KbdKey>
              close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-card px-1 font-mono text-[10px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Search className="h-6 w-6 text-muted-foreground/60" />
      {query ? (
        <>
          <p className="text-sm font-medium">No results for "{query}"</p>
          <p className="text-xs text-muted-foreground">
            Try a customer name, vehicle, phone, or job address.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Search across your business</p>
          <p className="text-xs text-muted-foreground">
            Customers, jobs, leads, tasks, services, receipts, mileage — and jump straight to it.
          </p>
        </>
      )}
    </div>
  );
}

interface ResultGroupOutput {
  key: ResultGroup;
  label: string;
  items: BaseResult[];
}

const PER_GROUP_LIMIT = 5;

function computeResults(
  query: string,
  data: ReturnType<typeof useStore>["data"],
  navigate: ReturnType<typeof useNavigate>,
  close: () => void
): ResultGroupOutput[] {
  const q = query.trim();

  // Empty state: show common quick-jumps + recent customers/appointments
  if (!q) {
    const recentCustomers = [...(data.customers ?? [])]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 3);
    const upcoming = [...(data.appointments ?? [])]
      .filter((a) => parseISO(a.start).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 3);

    const out: ResultGroupOutput[] = [];
    if (upcoming.length) {
      out.push({
        key: "appointments",
        label: "Upcoming jobs",
        items: upcoming.map((a) => apptResult(a, data.customers ?? [], navigate, close)),
      });
    }
    if (recentCustomers.length) {
      out.push({
        key: "customers",
        label: "Recent customers",
        items: recentCustomers.map((c) => customerResult(c, data.appointments ?? [], navigate, close)),
      });
    }
    out.push({
      key: "navigation",
      label: "Jump to",
      items: NAV_ITEMS.map((n, i) => ({
        id: n.to,
        group: "navigation" as ResultGroup,
        groupLabel: "Jump to",
        icon: n.icon,
        title: n.label,
        score: 100 - i,
        action: () => {
          navigate(n.to);
          close();
        },
      })),
    });
    return out;
  }

  // Active search
  const customerById = new Map((data.customers ?? []).map((c) => [c.id, c]));

  const customers: BaseResult[] = [];
  for (const c of data.customers ?? []) {
    const score = bestScore(q, [
      [c.name, 1.5],
      [c.phone, 1.0],
      [digits(c.phone), 1.0],
      [c.email, 0.9],
      [c.address, 0.7],
      ...c.vehicles.flatMap((v) => [
        [`${v.year} ${v.make} ${v.model}`, 0.8] as [string, number],
        [v.color, 0.4] as [string, number],
      ]),
      [c.notes, 0.3],
    ]);
    // phone digit-only search: if query is mostly digits, also compare digits
    const dq = digits(q);
    let phoneScore = 0;
    if (dq.length >= 3) {
      phoneScore = scoreMatch(digits(c.phone), dq);
    }
    const finalScore = Math.max(score, phoneScore);
    if (finalScore > 0) {
      customers.push(customerResult(c, data.appointments ?? [], navigate, close, finalScore));
    }
  }

  const appointments: BaseResult[] = [];
  for (const a of data.appointments ?? []) {
    const cust = customerById.get(a.customerId);
    const vstr = vehicleStr(a.vehicle);
    const score = bestScore(q, [
      [cust?.name, 1.3],
      [vstr, 1.0],
      [a.address, 0.8],
      [a.customerNotes, 0.5],
      [a.internalNotes, 0.5],
      [a.status, 0.3],
    ]);
    if (score > 0) {
      appointments.push(apptResult(a, data.customers ?? [], navigate, close, score));
    }
  }

  const leads: BaseResult[] = [];
  for (const l of data.leads ?? []) {
    const score = bestScore(q, [
      [l.name, 1.5],
      [l.phone, 1.0],
      [digits(l.phone ?? ""), 1.0],
      [l.vehicle, 0.8],
      [l.notes, 0.4],
      [l.source, 0.3],
    ]);
    if (score > 0) leads.push(leadResult(l, navigate, close, score));
  }

  const tasks: BaseResult[] = [];
  for (const t of data.tasks ?? []) {
    const score = bestScore(q, [
      [t.title, 1.5],
      [t.notes, 0.5],
      [t.category, 0.3],
    ]);
    if (score > 0) tasks.push(taskResult(t, navigate, close, score));
  }

  const services: BaseResult[] = [];
  for (const s of data.services ?? []) {
    const score = bestScore(q, [
      [s.name, 1.5],
      [s.description, 0.6],
    ]);
    if (score > 0) services.push(serviceResult(s, navigate, close, score));
  }

  const receipts: BaseResult[] = [];
  for (const r of data.receipts ?? []) {
    const cust = r.customerId ? customerById.get(r.customerId) : undefined;
    const score = bestScore(q, [
      [r.receiptNumber, 1.5],
      [cust?.name, 1.0],
      [r.customerSnapshot?.name, 1.0],
      [r.notes, 0.3],
    ]);
    if (score > 0) receipts.push(receiptResult(r, cust, navigate, close, score));
  }

  const mileage: BaseResult[] = [];
  for (const m of data.mileageEntries ?? []) {
    const cust = m.customerId ? customerById.get(m.customerId) : undefined;
    const score = bestScore(q, [
      [m.purpose, 1.2],
      [m.startLocation, 0.8],
      [m.destination, 0.8],
      [cust?.name, 0.8],
      [m.notes, 0.4],
    ]);
    if (score > 0) mileage.push(mileageResult(m, cust, navigate, close, score));
  }

  const navMatches: BaseResult[] = [];
  for (const n of NAV_ITEMS) {
    const score = bestScore(q, [
      [n.label, 1.5],
      ...n.keywords.map((k) => [k, 0.8] as [string, number]),
    ]);
    if (score > 0) {
      navMatches.push({
        id: n.to,
        group: "navigation",
        groupLabel: "Jump to",
        icon: n.icon,
        title: n.label,
        subtitle: n.to,
        score,
        action: () => {
          navigate(n.to);
          close();
        },
      });
    }
  }

  const out: ResultGroupOutput[] = [];
  const push = (key: ResultGroup, label: string, items: BaseResult[]) => {
    if (!items.length) return;
    items.sort((a, b) => b.score - a.score);
    out.push({ key, label, items: items.slice(0, PER_GROUP_LIMIT) });
  };

  push("customers", "Customers", customers);
  push("appointments", "Jobs", appointments);
  push("leads", "Leads", leads);
  push("tasks", "Tasks", tasks);
  push("services", "Services", services);
  push("receipts", "Receipts", receipts);
  push("mileage", "Mileage", mileage);
  push("navigation", "Jump to", navMatches);

  return out;
}

/* ----- Result builders ----- */

function customerResult(
  c: Customer,
  appts: Appointment[],
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  const apptCount = appts.filter((a) => a.customerId === c.id).length;
  const subtitle = [c.phone, c.address].filter(Boolean).join(" · ");
  return {
    id: c.id,
    group: "customers",
    groupLabel: "Customers",
    icon: Users,
    title: c.name,
    subtitle: subtitle || undefined,
    badge: apptCount > 0 ? `${apptCount} job${apptCount === 1 ? "" : "s"}` : undefined,
    score,
    action: () => {
      navigate(`/customers/${c.id}`);
      close();
    },
  };
}

function apptResult(
  a: Appointment,
  customers: Customer[],
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  const cust = customers.find((c) => c.id === a.customerId);
  const dt = parseISO(a.start);
  const when = format(dt, "EEE MMM d · h:mm a");
  const subtitle = [cust?.name, vehicleStr(a.vehicle)].filter(Boolean).join(" · ");
  return {
    id: a.id,
    group: "appointments",
    groupLabel: "Jobs",
    icon: CalendarDays,
    title: when,
    subtitle: subtitle || a.address || undefined,
    badge: a.status,
    score,
    action: () => {
      navigate(`/calendar?appt=${a.id}`);
      close();
    },
  };
}

function leadResult(
  l: Lead,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  return {
    id: l.id,
    group: "leads",
    groupLabel: "Leads",
    icon: UserPlus,
    title: l.name,
    subtitle: [l.phone, l.vehicle].filter(Boolean).join(" · ") || undefined,
    badge: l.status,
    score,
    action: () => {
      navigate(`/leads?id=${l.id}`);
      close();
    },
  };
}

function taskResult(
  t: Task,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  return {
    id: t.id,
    group: "tasks",
    groupLabel: "Tasks",
    icon: CheckSquare,
    title: t.title,
    subtitle: [t.category, t.dueDate ? `Due ${format(parseISO(t.dueDate), "MMM d")}` : null]
      .filter(Boolean)
      .join(" · ") || undefined,
    badge: t.completed ? "done" : t.priority,
    score,
    action: () => {
      navigate(`/tasks?id=${t.id}`);
      close();
    },
  };
}

function serviceResult(
  s: Service,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  const range =
    s.priceLow === s.priceHigh ? `$${s.priceLow}` : `$${s.priceLow}–$${s.priceHigh}`;
  return {
    id: s.id,
    group: "services",
    groupLabel: "Services",
    icon: Sparkles,
    title: s.name,
    subtitle: s.description || undefined,
    badge: s.isAddon ? "add-on" : range,
    score,
    action: () => {
      navigate(`/services?id=${s.id}`);
      close();
    },
  };
}

function receiptResult(
  r: ReceiptType,
  cust: Customer | undefined,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  return {
    id: r.id,
    group: "receipts",
    groupLabel: "Receipts",
    icon: ReceiptText,
    title: r.receiptNumber || "Receipt",
    subtitle: [cust?.name ?? r.customerSnapshot?.name, format(parseISO(r.createdAt), "MMM d, yyyy")]
      .filter(Boolean)
      .join(" · "),
    badge: r.paymentStatus,
    score,
    action: () => {
      navigate(`/receipts?id=${r.id}`);
      close();
    },
  };
}

function mileageResult(
  m: MileageEntry,
  cust: Customer | undefined,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  score = 50
): BaseResult {
  const route = [m.startLocation, m.destination].filter(Boolean).join(" → ");
  return {
    id: m.id,
    group: "mileage",
    groupLabel: "Mileage",
    icon: Car,
    title: `${m.miles.toFixed(1)} mi · ${format(parseISO(m.entryDate), "MMM d")}`,
    subtitle: route || cust?.name || m.purpose || undefined,
    badge: m.isBusiness ? "business" : "personal",
    score,
    action: () => {
      navigate(`/mileage?id=${m.id}`);
      close();
    },
  };
}
