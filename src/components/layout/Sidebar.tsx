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
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.06] bg-obsidian-950/85 backdrop-blur-xl",
          "transition-transform duration-normal ease-smooth lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Faint ember bloom anchored top-left, ties the sidebar to the ambient atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48 motion-reduce:opacity-50"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, rgba(221,41,20,0.06), transparent 60%)",
          }}
        />

        {/* Brand */}
        <div className="relative flex h-16 items-center gap-3 border-b border-white/[0.06] px-5">
          <div className="relative">
            <img
              src={settings.logoUrl || "/logo.svg"}
              alt={settings.businessName || "Detail Command"}
              className="h-9 w-9 rounded-md object-cover ring-1 ring-white/15 [box-shadow:0_6px_18px_-8px_rgba(221,41,20,0.45)]"
            />
          </div>
          <div className="leading-tight min-w-0">
            <p className="truncate font-sans text-[13px] font-light tracking-tight text-platinum-50">
              {settings.businessName || "Detail Command"}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ember-300/80">
              Mobile detailing hub
            </p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="relative flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <ul className="space-y-5">
            {NAV_GROUPS.map((group, gi) => (
              <li key={gi}>
                {group.label ? (
                  <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.28em] text-platinum-300/55">
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
                            "text-[13px] font-light tracking-tight",
                            "transition-all duration-150",
                            isActive
                              ? "bg-ember-500/10 text-platinum-50"
                              : "text-platinum-300/75 hover:bg-white/[0.03] hover:text-platinum-100"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Left rail accent on active */}
                            {isActive ? (
                              <span
                                aria-hidden
                                className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-ember-400"
                                style={{ boxShadow: "0 0 8px rgba(248,114,72,0.6)" }}
                              />
                            ) : null}
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                isActive
                                  ? "text-ember-300"
                                  : "text-platinum-300/65 group-hover:text-platinum-100"
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
        <div className="relative border-t border-white/[0.06] p-3">
          <NavLink
            to="/settings"
            onClick={onClose}
            className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/[0.03]"
          >
            <ProfileAvatar
              name={displayName}
              avatarUrl={settings.avatarUrl}
              size={36}
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-sans text-[13px] font-light text-platinum-50">{displayName}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/55">
                {settings.serviceArea || "Set your profile →"}
              </p>
            </div>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
