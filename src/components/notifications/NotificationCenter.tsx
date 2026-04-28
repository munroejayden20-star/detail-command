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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  NOTIFICATION_TYPE_META,
  type Notification,
} from "@/lib/types";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";

const ICONS = {
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
  Bell,
} as const;

type Filter = "all" | "unread";

export function NotificationCenter() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("unread");
  const wrapRef = useRef<HTMLDivElement>(null);

  const notifications = data.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const visible = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications;
  }, [notifications, filter]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
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
    if (!window.confirm(`Clear all ${notifications.length} notifications?`))
      return;
    dispatch({ type: "deleteAllNotifications" });
    toast.success("Notifications cleared");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-11 z-40 w-[320px] sm:w-[380px] rounded-xl border bg-card shadow-lift",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150"
          )}
          data-state="open"
        >
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
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

          <div className="flex gap-1 border-b px-3 py-1.5">
            <FilterButton
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
              label={`Unread (${unreadCount})`}
            />
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All (${notifications.length})`}
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {visible.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                {filter === "unread"
                  ? "You're caught up."
                  : "No notifications yet."}
              </div>
            ) : (
              <ul className="divide-y">
                {visible.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onMarkRead={(read) =>
                      dispatch({ type: "markNotificationRead", id: n.id, read })
                    }
                    onDelete={() =>
                      dispatch({ type: "deleteNotification", id: n.id })
                    }
                    onClose={() => setOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </button>
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
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
      : tone === "rose"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
      : tone === "violet"
      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
      : "bg-muted text-muted-foreground";

  const Body = (
    <div className="flex items-start gap-3 px-3 py-3">
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          toneClasses
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-tight", !n.read && "font-semibold")}>
          {n.title}
        </p>
        {n.message ? (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {n.message}
          </p>
        ) : null}
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {created}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {!n.read ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(true);
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Mark read"
          >
            <Check className="h-3 w-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
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
          onClick={() => {
            if (!n.read) onMarkRead(true);
            onClose();
          }}
          className={cn(
            "block transition-colors hover:bg-accent",
            !n.read && "bg-primary/[0.03]"
          )}
        >
          {Body}
        </Link>
      </li>
    );
  }
  return (
    <li
      className={cn(
        "transition-colors hover:bg-accent",
        !n.read && "bg-primary/[0.03]"
      )}
    >
      {Body}
    </li>
  );
}
