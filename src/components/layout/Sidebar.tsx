import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserPlus,
  CheckSquare,
  Sparkles,
  MessageSquareText,
  TrendingUp,
  Receipt,
  Wrench,
  ListChecks,
  Settings as SettingsIcon,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/leads", label: "Leads", icon: UserPlus },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/services", label: "Services", icon: Sparkles },
  { to: "/templates", label: "Templates", icon: MessageSquareText },
  { to: "/revenue", label: "Revenue", icon: TrendingUp },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/startup", label: "Startup", icon: Wrench },
  { to: "/checklists", label: "Checklists", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card/80 glass transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <Droplets className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Detail Command</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mobile detailing hub
            </p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-gradient-to-br from-brand-500/10 to-brand-700/10 p-3 text-xs">
            <p className="font-semibold text-foreground">Weekend warrior mode</p>
            <p className="mt-1 text-muted-foreground">
              Sat & Sun are your main booking days. Weekday evenings optional.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
