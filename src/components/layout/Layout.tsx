import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useTheme } from "@/hooks/useTheme";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";
import { useUpdateChecker } from "@/hooks/useUpdateChecker";
import { UpdateBanner } from "@/components/updates/UpdateBanner";
import { MigrationBanner } from "@/components/migration/MigrationBanner";
import { GlobalCommandPalette } from "@/components/search/CommandPalette";
import { IrisPageContextProvider } from "@/components/iris/PageContext";
import { IrisDock } from "@/components/iris/IrisDock";

export function Layout() {
  const [open, setOpen] = useState(false);
  useTheme();
  useNotificationScheduler();
  useUpdateChecker();

  return (
    <IrisPageContextProvider>
      <div className="relative flex h-full w-full bg-obsidian-950 text-platinum-100">
        {/* Atmospheric ember orbs that bleed through the whole admin shell,
            tying the dark surface together regardless of which page is mounted. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div
            className="absolute -left-32 -top-32 h-[55vh] w-[55vh] rounded-full blur-3xl motion-reduce:opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(221,41,20,0.07) 0%, rgba(221,41,20,0.015) 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute -right-40 bottom-0 h-[60vh] w-[60vh] rounded-full blur-3xl motion-reduce:opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(168,114,70,0.05) 0%, transparent 65%)",
            }}
          />
        </div>

        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setOpen((o) => !o)} />
          <UpdateBanner />
          <MigrationBanner />
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
        <GlobalCommandPalette />
        <IrisDock />
      </div>
    </IrisPageContextProvider>
  );
}
