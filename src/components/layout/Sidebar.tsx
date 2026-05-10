import { NavLink } from "react-router-dom";
import { useStore } from "@/store/store";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserPlus,
  CheckSquare,
  Sparkles,
  BarChart2,
  Receipt,
  ReceiptText,
  FileBarChart2,
  ListChecks,
  Calculator,
  Image as ImageIcon,
  Hammer,
  Car,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/work", label: "Work Mode", icon: Hammer },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Customers & Jobs",
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/leads", label: "Leads", icon: UserPlus },
      { to: "/tasks", label: "Tasks", icon: CheckSquare },
      { to: "/services", label: "Services", icon: Sparkles },
      { to: "/calculator", label: "Quote Calculator", icon: Calculator },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/photos", label: "Photos", icon: ImageIcon },
      { to: "/checklists", label: "Checklists", icon: ListChecks },
      { to: "/templates", label: "Templates", icon: MessageSquare },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/revenue", label: "Business Stats", icon: BarChart2 },
      { to: "/receipts", label: "Receipts", icon: ReceiptText },
      { to: "/tax-center", label: "Tax Center", icon: FileBarChart2 },
      { to: "/mileage", label: "Mileage", icon: Car },
      { to: "/expenses", label: "Expenses", icon: Receipt },
    ],
  },
  {
    items: [{ to: "/settings", label: "Settings", icon: SettingsIcon }],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { data } = useStore();
  const settings = data.settings;
  const displayName =
    settings.ownerName || settings.businessName || "Detail Command";
  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border/80 bg-card/60 glass",
          "transition-transform duration-normal ease-smooth lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border/80 px-5">
          <div className="relative">
            <img
              src={settings.logoUrl || "/logo.svg"}
              alt={settings.businessName || "Detail Command"}
              className="h-9 w-9 rounded-md object-cover ring-1 ring-border/60"
            />
          </div>
          <div className="leading-tight min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {settings.businessName || "Detail Command"}
            </p>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Mobile detailing hub
            </p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <ul className="space-y-5">
            {NAV_GROUPS.map((group, gi) => (
              <li key={gi}>
                {group.label ? (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                    {group.label}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-md px-3 py-2",
                            "text-sm font-medium",
                            "transition-colors duration-fast",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-hover hover:text-foreground"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Left rail accent on active */}
                            {isActive ? (
                              <span
                                aria-hidden
                                className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-primary"
                              />
                            ) : null}
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        {/* Profile */}
        <div className="border-t border-border/80 p-3">
          <NavLink
            to="/settings"
            onClick={onClose}
            className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-hover"
          >
            <ProfileAvatar
              name={displayName}
              avatarUrl={settings.avatarUrl}
              size={36}
            />
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
