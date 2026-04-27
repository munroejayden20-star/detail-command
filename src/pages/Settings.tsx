import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  Sun,
  Moon,
  Monitor,
  RefreshCcw,
  AlertTriangle,
  Cloud,
  CloudUpload,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/ui/section-header";
import { useStore } from "@/store/store";
import { initials } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  exportSnapshot,
  importSnapshot,
  loadLegacyData,
  hasLegacyContent,
  clearLegacyData,
} from "@/lib/storage";
import { api } from "@/lib/api";

export function SettingsPage() {
  const { data, dispatch, reload } = useStore();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [migrationState, setMigrationState] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [migrationMsg, setMigrationMsg] = useState<string | null>(null);
  const [hasLegacy, setHasLegacy] = useState(false);

  const settings = data.settings;

  useEffect(() => {
    setHasLegacy(hasLegacyContent());
  }, []);

  function update<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    dispatch({ type: "updateSettings", patch: { [key]: value } as any });
  }

  function handleExport() {
    const blob = new Blob([exportSnapshot(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detail-command-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    if (!user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const json = String(reader.result || "");
      const parsed = importSnapshot(json);
      if (!parsed) {
        setImportStatus("✗ Invalid backup file");
        setTimeout(() => setImportStatus(null), 3000);
        return;
      }
      try {
        await api.bulkImport(parsed, user.id);
        await reload();
        setImportStatus("✓ Backup imported and synced to cloud");
      } catch (e) {
        setImportStatus("✗ Could not sync to cloud — check connection");
        console.error(e);
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
  }

  async function migrateLegacy() {
    if (!user) return;
    const legacy = loadLegacyData();
    if (!legacy) {
      setMigrationState("error");
      setMigrationMsg("No local-only data found.");
      return;
    }
    setMigrationState("running");
    setMigrationMsg(null);
    try {
      await api.bulkImport(legacy, user.id);
      clearLegacyData();
      await reload();
      setHasLegacy(false);
      setMigrationState("done");
      setMigrationMsg("Local data imported into your account.");
    } catch (e) {
      console.error(e);
      setMigrationState("error");
      setMigrationMsg(e instanceof Error ? e.message : "Failed to migrate data.");
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        description="Business profile, scheduling rules, theme, and data."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Account</CardTitle>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <Cloud className="h-3.5 w-3.5" />
            Cloud-synced
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Signed in as <span className="font-semibold">{user?.email}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your data syncs across phone, tablet, and desktop. Every record is stored in your
            Supabase project and protected by Row-Level Security — no one else can read or write
            it.
          </p>
        </CardContent>
      </Card>

      {hasLegacy ? (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-amber-500" />
              Local-only data found on this device
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              An older version of this app stored data only in this browser. We detected records
              there. Import them into your cloud account so they sync everywhere?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={migrateLegacy} disabled={migrationState === "running"}>
                {migrationState === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                Import this device's data
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Delete the local-only data without importing?")) {
                    clearLegacyData();
                    setHasLegacy(false);
                  }
                }}
              >
                Discard
              </Button>
              {migrationState === "done" ? (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {migrationMsg}
                </span>
              ) : null}
              {migrationState === "error" ? (
                <span className="text-sm text-destructive">{migrationMsg}</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <ProfileAvatar
              name={settings.ownerName || settings.businessName || "Detail"}
              avatarUrl={settings.avatarUrl}
              size={56}
            />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="avatar">Profile picture URL (optional)</Label>
              <Input
                id="avatar"
                value={settings.avatarUrl ?? ""}
                onChange={(e) => update("avatarUrl", e.target.value || (undefined as any))}
                placeholder="https://… (or leave blank for an initials avatar)"
              />
              <p className="text-[11px] text-muted-foreground">
                Direct file uploads are coming with the photos system in Phase 4. For now you can
                paste any image URL.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="biz">Business name</Label>
              <Input
                id="biz"
                value={settings.businessName}
                onChange={(e) => update("businessName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner">Your name</Label>
              <Input
                id="owner"
                value={settings.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                placeholder="Used in dashboard greeting"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Contact phone</Label>
              <Input
                id="cphone"
                value={settings.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cemail">Contact email</Label>
              <Input
                id="cemail"
                type="email"
                value={settings.email ?? ""}
                onChange={(e) => update("email", e.target.value || (undefined as any))}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="area">Service area</Label>
              <Input
                id="area"
                value={settings.serviceArea ?? ""}
                onChange={(e) =>
                  update("serviceArea", e.target.value || (undefined as any))
                }
                placeholder="e.g. Greater Charlotte, NC — within 25 miles of 28202"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bizdesc">Business description</Label>
              <Textarea
                id="bizdesc"
                rows={3}
                value={settings.businessDescription ?? ""}
                onChange={(e) =>
                  update("businessDescription", e.target.value || (undefined as any))
                }
                placeholder="A short pitch you can paste into messages, social bios, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal">Starter budget goal</Label>
              <Input
                id="goal"
                type="number"
                min="0"
                value={settings.startupGoal}
                onChange={(e) => update("startupGoal", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accent">Accent color (CSS color or HEX)</Label>
              <Input
                id="accent"
                value={settings.accentColor ?? ""}
                onChange={(e) =>
                  update("accentColor", e.target.value || (undefined as any))
                }
                placeholder="#2f7bff"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="buffer">Buffer between jobs (min)</Label>
              <Input
                id="buffer"
                type="number"
                min="0"
                value={settings.bufferMinutes}
                onChange={(e) => update("bufferMinutes", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxJ">Max jobs per day</Label>
              <Input
                id="maxJ"
                type="number"
                min="1"
                value={settings.maxJobsPerDay}
                onChange={(e) => update("maxJobsPerDay", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Weekday work-hour block</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Default: Monday–Friday during day-job hours you can't take detail work.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ws">Start</Label>
                <Input
                  id="ws"
                  type="time"
                  value={settings.weekdayUnavailableStart}
                  onChange={(e) => update("weekdayUnavailableStart", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="we">End</Label>
                <Input
                  id="we"
                  type="time"
                  value={settings.weekdayUnavailableEnd}
                  onChange={(e) => update("weekdayUnavailableEnd", e.target.value)}
                />
              </div>
            </div>
            <label className="mt-3 flex items-center justify-between rounded-md bg-card border p-3 text-sm">
              <span>Allow weekday evening jobs after work</span>
              <Switch
                checked={settings.weekdayEvenings}
                onCheckedChange={(v) => update("weekdayEvenings", v)}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-all",
                  theme === opt.value
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export backup
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.currentTarget.value = "";
              }}
            />
            <Button variant="ghost" onClick={() => reload()}>
              <RefreshCcw className="h-4 w-4" /> Refresh from cloud
            </Button>
          </div>
          {importStatus ? (
            <p className="text-sm text-muted-foreground">{importStatus}</p>
          ) : null}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Cloud is the source of truth.</p>
                <p>
                  Every change writes to your Supabase project immediately. Use Export to grab a
                  manual JSON backup whenever you want — Import will upload that backup to the
                  cloud.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProfileAvatar({
  name,
  avatarUrl,
  size = 36,
  className,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className={cn(
          "rounded-full object-cover shadow-soft",
          className
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white shadow-soft",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name) || "DC"}
    </div>
  );
}
