import { Menu, Moon, Sun, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useStore } from "@/store/store";
import { useState } from "react";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { UserMenu } from "@/auth/UserMenu";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface TopBarProps {
  onMenu: () => void;
}

export function TopBar({ onMenu }: TopBarProps) {
  const { toggle } = useTheme();
  const { data } = useStore();
  const navigate = useNavigate();
  const [appOpen, setAppOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/customers?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
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
          <p className="text-sm font-medium">{format(new Date(), "EEEE, MMMM d")}</p>
          <p className="text-xs text-muted-foreground">
            {todayCount} {todayCount === 1 ? "job" : "jobs"} today · {openTaskCount} open task
            {openTaskCount === 1 ? "" : "s"}
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="ml-auto flex flex-1 items-center justify-end gap-2 md:ml-0 md:flex-initial md:max-w-xs"
        >
          <div className="relative hidden flex-1 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-focus placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <div className="flex items-center gap-1.5">
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
