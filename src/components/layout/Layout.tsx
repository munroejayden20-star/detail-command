import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useTheme } from "@/hooks/useTheme";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";
import { useUpdateChecker } from "@/hooks/useUpdateChecker";
import { UpdateBanner } from "@/components/updates/UpdateBanner";

export function Layout() {
  const [open, setOpen] = useState(false);
  useTheme();
  useNotificationScheduler();
  useUpdateChecker();

  return (
    <div className="flex h-full w-full bg-background">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setOpen((o) => !o)} />
        <UpdateBanner />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div
            className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-8"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
          >
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
