import { Download, X } from "lucide-react";
import {
  applyUpdate,
  dismissUpdateBanner,
  useUpdateState,
} from "@/hooks/useUpdateChecker";

export function UpdateBanner() {
  const { available } = useUpdateState();
  if (!available) return null;
  return (
    <div className="sticky top-16 z-30 border-b border-primary/30 bg-primary/10 px-4 py-2.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4 text-primary" />
          <span className="font-medium">New update available</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Reload to get the latest features and fixes.
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={applyUpdate}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Update now
          </button>
          <button
            type="button"
            onClick={dismissUpdateBanner}
            aria-label="Dismiss"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
