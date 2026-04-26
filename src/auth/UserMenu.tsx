import { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;
  const display = user.user_metadata?.full_name || user.email || "";

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-soft ring-focus"
        aria-label="Account menu"
      >
        {display ? initials(display) : <UserIcon className="h-4 w-4" />}
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 top-11 z-50 w-56 rounded-xl border bg-popover p-2 shadow-lift animate-fade-in"
          )}
        >
          <div className="border-b border-border px-2 pb-2">
            <p className="truncate text-sm font-semibold">{display}</p>
            <p className="truncate text-[11px] text-muted-foreground">Signed in</p>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
