import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  X,
  AlertCircle,
  CalendarDays,
  Clock,
  CheckCircle2,
  CheckSquare,
  CloudRain,
  DollarSign,
  Download,
  ImageOff,
  ListChecks,
  Repeat,
  Star,
  Wrench,
  CalendarPlus,
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { toast } from "sonner";
import { NOTIFICATION_TYPE_META, type Notification, type NotificationGroup } from "@/lib/types";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

const ICONS = {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  Clock,
  CheckCircle2,
  CheckSquare,
  CloudRain,
  DollarSign,
  Download,
  ImageOff,
  ListChecks,
  Repeat,
  Star,
  Wrench,
  Bell,
} as const;

type CategoryFilter = "all" | NotificationGroup;

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "appointments", label: "Jobs" },
  { id: "payments", label: "Payments" },
  { id: "tasks", label: "Tasks" },
  { id: "followups", label: "Follow-ups" },
];

function groupByDate(notifications: Notification[]) {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const older: Notification[] = [];
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isToday(d)) today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else if (isThisWeek(d, { weekStartsOn: 1 })) thisWeek.push(n);
    else older.push(n);
  }
  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "This week", items: thisWeek },
    { label: "Older", items: older },
  ].filter((g) => g.items.length > 0);
}

export function NotificationCenter() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);
  const [pulse, setPulse] = useState(false);

  const notifications = data.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Pulse the bell when new unread notifications arrive while panel is closed
  useEffect(() => {
    if (!open && unreadCount > prevUnreadRef.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1800);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, open]);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { all: 0 };
    for (const n of notifications) {
      if (!n.read) {
        m.all = (m.all ?? 0) + 1;
        const group = NOTIFICATION_TYPE_META[n.type]?.group ?? "info";
        m[group] = (m[group] ?? 0) + 1;
      }
    }
    return m;
  }, [notifications]);

  const visible = useMemo(() => {
    let list = [...notifications];
    if (category !== "all") {
      list = list.filter((n) => NOTIFICATION_TYPE_META[n.type]?.group === category);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, category]);

  const grouped = useMemo(() => groupByDate(visible), [visible]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    dispatch({ type: "markAllNotificationsRead" });
    toast.success("All notifications marked read");
  }

  function handleClearAll() {
    if (notifications.length === 0) return;
    if (!window.confirm(`Clear all ${notifications.length} notifications?`)) return;
    dispatch({ type: "deleteAllNotifications" });
    toast.success("Notifications cleared");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setPulse(false); }}
        aria-label="Notifications"
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
          pulse && "animate-bounce"
        )}
      >
        <Bell className={cn("h-4 w-4 transition-colors", pulse && "text-primary")} />
        {unreadCount > 0 ? (
          <span className={cn(
            "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground",
            pulse && "animate-pulse"
          )}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-11 z-40 w-[360px] sm:w-[420px] rounded-xl border bg-card shadow-lift animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-primary" />
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                title="Mark all read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-30"
                title="Clear all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const count = categoryCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategory(tab.id)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                    category === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="ml-1 rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="max-h-[65vh] overflow-y-auto scrollbar-thin">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {category === "all" ? "All caught up" : `No ${CATEGORY_TABS.find(t => t.id === category)?.label.toLowerCase()} notifications`}
                </p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-sm px-3 py-1.5 border-b">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                  </div>
                  <ul className="divide-y">
                    {group.items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        onMarkRead={(read) => dispatch({ type: "markNotificationRead", id: n.id, read })}
                        onDelete={() => dispatch({ type: "deleteNotification", id: n.id })}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-3 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">
                {notifications.length} total · {unreadCount} unread
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  n,
  onMarkRead,
  onDelete,
  onClose,
}: {
  n: Notification;
  onMarkRead: (read: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const meta = NOTIFICATION_TYPE_META[n.type];
  const Icon = (ICONS[meta.icon as keyof typeof ICONS] ?? Bell) as typeof Bell;
  const created = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });
  const tone = meta.tone;
  const toneClasses =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : tone === "rose" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
    : tone === "violet" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
    : "bg-muted text-muted-foreground";

  const Body = (
    <div className="flex items-start gap-3 px-3 py-3">
      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", toneClasses)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-tight", !n.read && "font-semibold")}>{n.title}</p>
        {n.message ? (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
        ) : null}
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{created}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {!n.read ? (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead(true); }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Mark read"
          >
            <Check className="h-3 w-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          title="Delete"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );

  if (n.linkUrl) {
    return (
      <li>
        <Link
          to={n.linkUrl}
          onClick={() => { if (!n.read) onMarkRead(true); onClose(); }}
          className={cn("block transition-colors hover:bg-accent", !n.read && "bg-primary/[0.03]")}
        >
          {Body}
        </Link>
      </li>
    );
  }
  return (
    <li className={cn("transition-colors hover:bg-accent", !n.read && "bg-primary/[0.03]")}>
      {Body}
    </li>
  );
}
