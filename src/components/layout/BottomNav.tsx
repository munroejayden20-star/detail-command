import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CheckSquare,
  MoreHorizontal,
  UserPlus,
  Sparkles,
  MessageSquareText,
  TrendingUp,
  Receipt,
  Wrench,
  ListChecks,
  Calculator,
  Image as ImageIcon,
  Hammer,
  Settings as SettingsIcon,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const PRIMARY: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/work", label: "Work", icon: Hammer },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/customers", label: "Customers", icon: Users },
];

const MORE: NavItem[] = [
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/leads", label: "Leads", icon: UserPlus },
  { to: "/services", label: "Services", icon: Sparkles },
  { to: "/calculator", label: "Calculator", icon: Calculator },
  { to: "/photos", label: "Photos", icon: ImageIcon },
  { to: "/templates", label: "Templates", icon: MessageSquareText },
  { to: "/revenue", label: "Revenue", icon: TrendingUp },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/startup", label: "Budget", icon: Wrench },
  { to: "/checklists", label: "Checklists", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const navigate = useNavigate();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5">
          {PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {/* Floating Action Button — quick add appointment on mobile */}
      <button
        type="button"
        onClick={() => setApptOpen(true)}
        aria-label="New appointment"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift active:scale-95 transition-transform lg:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
      >
        <Plus className="h-6 w-6" />
      </button>
      <AppointmentDialog open={apptOpen} onOpenChange={setApptOpen} />

      {/* "More" sheet */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            ref={sheetRef}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 shadow-lift animate-slide-up"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MORE.map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.to);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center text-[11px] font-medium hover:bg-accent transition-colors"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
