import { NavLink } from "react-router-dom";
import { useStore } from "@/store/store";
import { ProfileAvatar } from "@/pages/Settings";
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
  Calculator,
  Image as ImageIcon,
  Settings as SettingsIcon,
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
  { to: "/calculator", label: "Quote Calculator", icon: Calculator },
  { to: "/photos", label: "Photos", icon: ImageIcon },
  { to: "/templates", label: "Templates", icon: MessageSquareText },
  { to: "/revenue", label: "Revenue", icon: TrendingUp },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/startup", label: "Budget & Purchases", icon: Wrench },
  { to: "/checklists", label: "Checklists", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { data } = useStore();
  const settings = data.settings;
  const displayName = settings.ownerName || settings.businessName || "Detail Command";
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
          <img
            src={settings.logoUrl || "/logo.svg"}
            alt={settings.businessName || "Detail Command"}
            className="h-9 w-9 rounded-lg shadow-soft object-cover"
          />
          <div className="leading-tight min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {settings.businessName || "Detail Command"}
            </p>
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
          <NavLink
            to="/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent transition-colors"
          >
            <ProfileAvatar name={displayName} avatarUrl={settings.avatarUrl} size={36} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {settings.serviceArea || "Set your profile →"}
              </p>
            </div>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
