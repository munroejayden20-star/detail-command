import { Menu, Moon, Sun, Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { useStore } from "@/store/store";
import { useEffect, useState } from "react";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { format } from "date-fns";
import { UserMenu } from "@/auth/UserMenu";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { IrisLauncher } from "@/components/iris/IrisLauncher";
import { openCommandPalette } from "@/components/search/CommandPalette";

interface TopBarProps {
  onMenu: () => void;
}

export function TopBar({ onMenu }: TopBarProps) {
  const { toggle } = useTheme();
  const { data, reload, loading } = useStore();
  const [appOpen, setAppOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      await reload();
      toast.success("Refreshed");
    } catch (e) {
      toast.error("Refresh failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  const todayCount = data.appointments.filter((a) => {
    const d = new Date(a.start);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }).length;

  const openTaskCount = data.tasks.filter((t) => !t.completed).length;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-obsidian-950/70 px-4 backdrop-blur-xl backdrop-saturate-150 md:px-6">
        {/* Hairline of light at the bottom of the header — "light from above" cue */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
          }}
        />

        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-platinum-300/80 transition-colors hover:bg-white/[0.05] hover:text-platinum-50"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden md:block">
          <p className="font-sans text-[13px] font-light tracking-tight text-platinum-50">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/70">
            <span className="tabular-nums text-ember-300">{todayCount}</span>{" "}
            {todayCount === 1 ? "job" : "jobs"} today ·{" "}
            <span className="tabular-nums text-ember-300">{openTaskCount}</span> open task
            {openTaskCount === 1 ? "" : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search"
          className={[
            "ml-auto md:ml-0 md:w-72",
            "flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-[12.5px]",
            "text-platinum-300/75 transition-all duration-200 backdrop-blur-sm",
            "hover:border-ember-400/40 hover:bg-white/[0.05] hover:text-platinum-100",
            "focus-visible:outline-none focus-visible:border-ember-400/55 focus-visible:[box-shadow:0_0_0_4px_rgba(221,41,20,0.08)]",
          ].join(" ")}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">Search anything…</span>
          <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-platinum-300/65">
            {isMac ? "⌘" : "Ctrl"}K
          </kbd>
        </button>

        <div className="flex items-center gap-1">
          <TopBarAction onClick={() => setTaskOpen(true)} label="Task" hideOnMobile />
          <TopBarAction onClick={() => setCustOpen(true)} label="Customer" hideOnMobile />
          <TopBarAction onClick={() => setAppOpen(true)} label="Appointment" primary hideOnMobile />

          <span aria-hidden className="mx-1 hidden h-5 w-px bg-white/[0.08] md:block" />

          <IconButton
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing || loading ? "animate-spin" : ""}`}
            />
          </IconButton>
          <IrisLauncher className="hidden sm:inline-flex" />
          <NotificationCenter />
          <IconButton
            onClick={toggle}
            aria-label="Toggle theme"
            className="hidden sm:inline-flex"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </IconButton>
          <UserMenu />
        </div>
      </header>

      <AppointmentDialog open={appOpen} onOpenChange={setAppOpen} />
      <CustomerDialog open={custOpen} onOpenChange={setCustOpen} />
      <TaskQuickAdd open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}

function TopBarAction({
  onClick,
  label,
  primary,
  hideOnMobile,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
  hideOnMobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        hideOnMobile ? "hidden md:inline-flex" : "inline-flex",
        "items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-all duration-200",
        primary
          ? "border-ember-500/40 bg-gradient-to-b from-ember-500/14 via-ember-500/10 to-ember-500/16 text-platinum-50 hover:border-ember-400/60 hover:from-ember-500/20 hover:to-ember-500/24"
          : "border-white/10 bg-white/[0.03] text-platinum-200/85 hover:border-white/20 hover:bg-white/[0.05] hover:text-platinum-50",
      ].join(" ")}
    >
      <Plus className={primary ? "h-3.5 w-3.5 text-ember-300" : "h-3.5 w-3.5 text-platinum-300/70"} />
      {label}
    </button>
  );
}

function IconButton({
  onClick,
  disabled,
  className = "",
  children,
  ...props
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label": string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-platinum-300/80 transition-colors duration-150",
        "hover:bg-white/[0.05] hover:text-platinum-50",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
