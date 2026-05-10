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
  TrendingUp,
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
  X,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { openCommandPalette } from "@/components/search/CommandPalette";

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
  { to: "/checklists", label: "Checklists", icon: ListChecks },
  { to: "/templates", label: "Templates", icon: MessageSquare },
  { to: "/revenue", label: "Revenue", icon: TrendingUp },
  { to: "/receipts", label: "Receipts", icon: ReceiptText },
  { to: "/tax-center", label: "Tax Center", icon: FileBarChart2 },
  { to: "/mileage", label: "Mileage", icon: Car },
  { to: "/expenses", label: "Expenses", icon: Receipt },
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 backdrop-blur-md lg:hidden"
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
                  "relative flex flex-col items-center justify-center gap-0.5 py-2.5",
                  "text-[10px] font-medium tracking-tight transition-colors duration-fast",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Top accent bar on active */}
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
                    />
                  ) : null}
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-fast",
                      isActive ? "scale-110" : "scale-100"
                    )}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5",
              "text-[10px] font-medium tracking-tight",
              moreOpen ? "text-primary" : "text-muted-foreground"
            )}
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
        className={[
          "fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lift",
          "active:scale-95 transition-transform duration-fast lg:hidden",
        ].join(" ")}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Floating search button — mirrors the FAB on the left */}
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search"
        className={[
          "fixed left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full",
          "bg-card text-foreground border border-border shadow-lift",
          "active:scale-95 transition-transform duration-fast lg:hidden",
        ].join(" ")}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)" }}
      >
        <Search className="h-5 w-5" />
      </button>
      <AppointmentDialog open={apptOpen} onOpenChange={setApptOpen} />

      {/* "More" sheet */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMoreOpen(false)}
        >
          <div
            ref={sheetRef}
            className={cn(
              "absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-card",
              "p-4 shadow-elevated animate-slide-up"
            )}
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold tracking-tight">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent transition-colors"
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
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border border-border/80 bg-card",
                    "p-3 text-center text-[11px] font-medium",
                    "transition-colors duration-fast hover:bg-hover hover:border-border"
                  )}
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
