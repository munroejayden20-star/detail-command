import { Menu, Moon, Sun, Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useStore } from "@/store/store";
import { useEffect, useState } from "react";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { format } from "date-fns";
import { UserMenu } from "@/auth/UserMenu";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
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
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/80 bg-background/75 px-4 backdrop-blur-md md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden md:block">
          <p className="text-sm font-semibold tracking-tight">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            <span className="tabular-nums">{todayCount}</span>{" "}
            {todayCount === 1 ? "job" : "jobs"} today ·{" "}
            <span className="tabular-nums">{openTaskCount}</span> open task
            {openTaskCount === 1 ? "" : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search"
          className={[
            "ml-auto md:ml-0 md:w-72",
            "flex h-9 items-center gap-2 rounded-md border border-border bg-background/60 px-3 text-sm",
            "text-muted-foreground transition-colors duration-fast",
            "hover:bg-hover hover:border-foreground/15 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          ].join(" ")}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">Search anything…</span>
          <kbd className="ml-auto hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {isMac ? "⌘" : "Ctrl"}K
          </kbd>
        </button>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setTaskOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Task
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setCustOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Customer
          </Button>
          <Button
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setAppOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Appointment
          </Button>

          {/* Subtle separator between primary actions and utility row */}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border md:block" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing || loading ? "animate-spin" : ""}`}
            />
          </Button>
          <NotificationCenter />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            className="hidden sm:inline-flex"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          <UserMenu />
        </div>
      </header>

      <AppointmentDialog open={appOpen} onOpenChange={setAppOpen} />
      <CustomerDialog open={custOpen} onOpenChange={setCustOpen} />
      <TaskQuickAdd open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}
