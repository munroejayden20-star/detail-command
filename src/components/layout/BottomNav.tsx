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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-obsidian-950/85 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Top hairline of light */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
          }}
        />
        <div className="grid grid-cols-5">
          {PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2.5",
                  "font-mono text-[9.5px] uppercase tracking-[0.18em] transition-colors duration-150",
                  isActive ? "text-ember-200" : "text-platinum-300/75"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-ember-400"
                      style={{ boxShadow: "0 0 8px rgba(248,114,72,0.6)" }}
                    />
                  ) : null}
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-150",
                      isActive ? "scale-110 text-ember-300" : "scale-100 text-platinum-300/75"
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
              "font-mono text-[9.5px] uppercase tracking-[0.18em] transition-colors duration-150",
              moreOpen ? "text-ember-200" : "text-platinum-300/75"
            )}
          >
            <MoreHorizontal className={cn("h-5 w-5", moreOpen ? "text-ember-300" : "text-platinum-300/75")} />
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
          "border border-ember-400/45 bg-gradient-to-b from-ember-500/95 to-ember-600/95 text-platinum-50",
          "active:scale-95 transition-transform duration-fast lg:hidden",
        ].join(" ")}
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)",
          boxShadow: "0 18px 40px -12px rgba(221,41,20,0.6)",
        }}
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
          "border border-white/12 bg-obsidian-900/90 text-platinum-100 backdrop-blur-md",
          "active:scale-95 transition-transform duration-fast lg:hidden",
        ].join(" ")}
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)",
          boxShadow: "0 10px 24px -10px rgba(0,0,0,0.6)",
        }}
      >
        <Search className="h-5 w-5" />
      </button>
      <AppointmentDialog open={apptOpen} onOpenChange={setApptOpen} />

      {/* "More" sheet */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMoreOpen(false)}
        >
          <div
            ref={sheetRef}
            className={cn(
              "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/[0.08] bg-obsidian-950/95 backdrop-blur-xl",
              "p-4 animate-slide-up"
            )}
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-300">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-md p-1 text-platinum-300/65 transition-colors hover:bg-white/[0.05] hover:text-platinum-50"
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
                    "flex flex-col items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02]",
                    "p-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-platinum-200/85",
                    "transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.04] hover:text-platinum-50"
                  )}
                >
                  <item.icon className="h-5 w-5 text-platinum-300/75" />
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
