import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasLegacyContent, loadLegacyData, clearLegacyData } from "@/lib/storage";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/AuthProvider";
import { useStore } from "@/store/store";

export function MigrationBanner() {
  const { user } = useAuth();
  const { reload } = useStore();
  const [show, setShow] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setShow(hasLegacyContent());
  }, []);

  if (!show || !user) return null;

  async function doImport() {
    if (!user) return;
    const legacy = loadLegacyData();
    if (!legacy) {
      toast.error("No local data found to import");
      setShow(false);
      return;
    }
    setImporting(true);
    try {
      await api.bulkImport(legacy, user.id);
      clearLegacyData();
      await reload();
      setShow(false);
      toast.success("Local data imported to your account — now synced across all devices");
    } catch (e) {
      console.error("[migration]", e);
      toast.error("Import failed — check your connection and try again");
    } finally {
      setImporting(false);
    }
  }

  function dismiss() {
    setShow(false);
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
          This device has local-only data that isn't synced to your account.
          Import it so it appears on all your devices.
        </p>
        <Button
          size="sm"
          onClick={doImport}
          disabled={importing}
        >
          <Upload className="h-3.5 w-3.5" />
          {importing ? "Importing…" : "Import now"}
        </Button>
        <button
          onClick={dismiss}
          className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
