import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Building2,
  Clock,
  Sliders,
  Bell,
  Palette,
  Shield,
  Sparkles,
  ChevronDown,
  Download,
  Upload,
  RefreshCcw,
  AlertTriangle,
  Cloud,
  CloudUpload,
  Loader2,
  CheckCircle2,
  Trash2,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Star,
  Search,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useStore } from "@/store/store";
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
import type { Settings } from "@/lib/types";

/* ─────────────────────────────────────────────
   Collapsible section card
───────────────────────────────────────────── */
function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card id={id} className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/40 transition-colors lg:cursor-pointer"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{title}</p>
            {badge ? (
              <Badge variant="secondary" className="text-[10px]">{badge}</Badge>
            ) : null}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-border">
          <div className="px-5 py-5 space-y-5">{children}</div>
        </div>
      ) : null}
    </Card>
  );
}

/* ─────────────────────────────────────────────
   Toggle row helper
───────────────────────────────────────────── */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border p-3 text-sm transition-colors",
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-accent/40"
      )}
    >
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

/* ─────────────────────────────────────────────
   Field row helper (label + input)
───────────────────────────────────────────── */
function Field({
  label,
  hint,
  children,
  col,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  col?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", col && "")}>
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Settings Page
───────────────────────────────────────────── */
export function SettingsPage() {
  const { data, dispatch } = useStore();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const s = data.settings;
  const [search, setSearch] = useState("");

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    dispatch({ type: "updateSettings", patch: { [key]: value } as Partial<Settings> });
  }

  // Sections are shown/hidden by search
  const searchLower = search.toLowerCase();
  function matches(...terms: string[]) {
    if (!searchLower) return true;
    return terms.some((t) => t.toLowerCase().includes(searchLower));
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your business profile, scheduling, defaults, and app preferences.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search settings…"
          className="pl-9"
        />
      </div>

      {/* ── 1. Profile & Business ──────────────────────────── */}
      {matches("profile", "business", "name", "phone", "email", "avatar", "area", "description", "google", "review") ? (
        <SettingsSection
          id="profile"
          title="Profile & Business"
          description="Your name, contact info, service area, and branding."
          icon={User}
          defaultOpen
        >
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <ProfileAvatar
              name={s.ownerName || s.businessName || "Detail"}
              avatarUrl={s.avatarUrl}
              size={60}
            />
            <Field label="Profile picture URL" hint="Paste any image URL, or leave blank for an initials avatar.">
              <Input
                value={s.avatarUrl ?? ""}
                onChange={(e) => update("avatarUrl", e.target.value || undefined)}
                placeholder="https://…"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name">
              <Input
                value={s.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                placeholder="Jayden Munroe"
              />
            </Field>
            <Field label="Business name">
              <Input
                value={s.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder="Detail Command"
              />
            </Field>
            <Field label="Contact phone">
              <Input
                value={s.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                placeholder="(555) 555-5555"
              />
            </Field>
            <Field label="Contact email">
              <Input
                type="email"
                value={s.email ?? ""}
                onChange={(e) => update("email", e.target.value || undefined)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Service area" hint="City, region, or zip range you cover.">
              <Input
                value={s.serviceArea ?? ""}
                onChange={(e) => update("serviceArea", e.target.value || undefined)}
                placeholder="Greater Charlotte, NC"
              />
            </Field>
            <Field label="Service radius (miles)">
              <Input
                type="number"
                min="0"
                value={s.serviceAreaRadius ?? ""}
                onChange={(e) =>
                  update("serviceAreaRadius", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="25"
              />
            </Field>
          </div>

          <Field label="Business description" hint="A short pitch for social bios, quotes, and messages.">
            <Textarea
              rows={3}
              value={s.businessDescription ?? ""}
              onChange={(e) => update("businessDescription", e.target.value || undefined)}
              placeholder="Mobile auto detailing — we come to you. Fully equipped, insured, and guaranteed."
            />
          </Field>

          <Field label="Google review link" hint="Paste the direct Google review URL. Used in follow-up messages.">
            <div className="flex gap-2">
              <Input
                value={s.googleReviewLink ?? ""}
                onChange={(e) => update("googleReviewLink", e.target.value || undefined)}
                placeholder="https://g.page/r/…/review"
                className="flex-1"
              />
              {s.googleReviewLink ? (
                <a
                  href={s.googleReviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-md border hover:bg-accent"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </Field>
        </SettingsSection>
      ) : null}

      {/* ── 2. Scheduling & Availability ──────────────────── */}
      {matches("schedule", "scheduling", "availability", "hours", "buffer", "jobs", "weekend", "evening", "duration") ? (
        <SettingsSection
          id="scheduling"
          title="Scheduling & Availability"
          description="Work hours, buffer time, and daily job limits."
          icon={Clock}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Work day start">
              <Input
                type="time"
                value={s.workdayStart ?? "08:00"}
                onChange={(e) => update("workdayStart", e.target.value)}
              />
            </Field>
            <Field label="Work day end">
              <Input
                type="time"
                value={s.workdayEnd ?? "18:00"}
                onChange={(e) => update("workdayEnd", e.target.value)}
              />
            </Field>
            <Field label="Buffer between jobs (min)" hint="Travel + setup time to block between appointments.">
              <Input
                type="number"
                min="0"
                value={s.bufferMinutes}
                onChange={(e) => update("bufferMinutes", Number(e.target.value))}
              />
            </Field>
            <Field label="Max jobs per day">
              <Input
                type="number"
                min="1"
                value={s.maxJobsPerDay}
                onChange={(e) => update("maxJobsPerDay", Number(e.target.value))}
              />
            </Field>
            <Field label="Default appointment duration (min)">
              <Input
                type="number"
                min="15"
                step="15"
                value={s.defaultAppointmentDuration ?? 90}
                onChange={(e) => update("defaultAppointmentDuration", Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <ToggleRow
              label="Weekend availability"
              hint="Accept appointments on Saturdays and Sundays."
              checked={s.weekendAvailability ?? true}
              onChange={(v) => update("weekendAvailability", v)}
            />
            <ToggleRow
              label="Allow weekday evening jobs"
              hint="Accept jobs after your unavailable block ends on weekdays."
              checked={s.weekdayEvenings}
              onChange={(v) => update("weekdayEvenings", v)}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Weekday unavailable block</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Block out hours when you can't detail on weekdays (e.g. day job hours).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <Input
                  type="time"
                  value={s.weekdayUnavailableStart}
                  onChange={(e) => update("weekdayUnavailableStart", e.target.value)}
                />
              </Field>
              <Field label="End">
                <Input
                  type="time"
                  value={s.weekdayUnavailableEnd}
                  onChange={(e) => update("weekdayUnavailableEnd", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </SettingsSection>
      ) : null}

      {/* ── 3. Services & Pricing (link to /services) ─────── */}
      {matches("service", "pricing", "price", "addon", "package", "duration") ? (
        <SettingsSection
          id="services"
          title="Services & Pricing"
          description="Manage your service packages, add-ons, prices, and durations."
          icon={Sparkles}
          badge={`${data.services.length} services`}
        >
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">
                {data.services.filter((s) => !s.isAddon).length} package
                {data.services.filter((s) => !s.isAddon).length === 1 ? "" : "s"} · {data.services.filter((s) => s.isAddon).length} add-on
                {data.services.filter((s) => s.isAddon).length === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Edit names, descriptions, price ranges, and durations.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/services" className="gap-1.5">
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </SettingsSection>
      ) : null}

      {/* ── 4. Defaults & Messaging ───────────────────────── */}
      {matches("default", "tax", "travel", "fee", "disclaimer", "quote", "confirmation", "follow", "review", "message") ? (
        <SettingsSection
          id="defaults"
          title="Defaults & Messaging"
          description="Default rates, fees, and message templates used across the app."
          icon={Sliders}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default tax rate (%)" hint="Applied automatically in the quote calculator.">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={s.defaultTaxRate ?? ""}
                onChange={(e) =>
                  update("defaultTaxRate", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="8.5"
              />
            </Field>
            <Field label="Default travel fee ($)" hint="Pre-filled in new quotes.">
              <Input
                type="number"
                min="0"
                step="1"
                value={s.defaultTravelFee ?? ""}
                onChange={(e) =>
                  update("defaultTravelFee", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="0"
              />
            </Field>
            <Field label="Follow-up after (days)" hint="Days after a completed job to send a follow-up reminder.">
              <Input
                type="number"
                min="1"
                value={s.defaultFollowUpDays ?? 2}
                onChange={(e) => update("defaultFollowUpDays", Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Default quote disclaimer" hint="Shown at the bottom of quotes sent to customers.">
            <Textarea
              rows={2}
              value={s.defaultQuoteDisclaimer ?? ""}
              onChange={(e) => update("defaultQuoteDisclaimer", e.target.value || undefined)}
              placeholder="Quote valid for 7 days. Final price may vary based on vehicle condition."
            />
          </Field>

          <Field label="Default confirmation message" hint="Pre-filled when confirming a new appointment via Reach Out.">
            <Textarea
              rows={3}
              value={s.defaultConfirmationMessage ?? ""}
              onChange={(e) => update("defaultConfirmationMessage", e.target.value || undefined)}
              placeholder={`Hi {name}! Just confirming your detail on {date} at {address}. See you then! — ${s.ownerName || s.businessName || "Your Detailer"}`}
            />
          </Field>

          <Field label="Default review request message" hint="Sent to customers after a completed job.">
            <Textarea
              rows={3}
              value={s.defaultReviewRequestMessage ?? ""}
              onChange={(e) => update("defaultReviewRequestMessage", e.target.value || undefined)}
              placeholder={`Hey {name}! Thanks for having me out — hope your ride is looking fresh! If you have a minute, a Google review means the world to a small business. ${s.googleReviewLink ?? "{review_link}"}`}
            />
          </Field>
        </SettingsSection>
      ) : null}

      {/* ── 5. Booking Page (coming soon) ─────────────────── */}
      {matches("booking", "book", "deposit", "slug", "auto", "confirm") ? (
        <SettingsSection
          id="booking"
          title="Booking Page"
          description="Public booking page for customers to request appointments."
          icon={Star}
          badge="Coming soon"
        >
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center space-y-2">
            <Star className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-sm">Public booking page is coming soon</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              A shareable link where customers can request appointments, view your services, and pay a deposit — all without a back-and-forth.
            </p>
          </div>
          <div className="space-y-2 opacity-50 pointer-events-none">
            <ToggleRow
              label="Enable booking page"
              hint="Allow customers to request appointments online."
              checked={s.bookingPageEnabled ?? false}
              onChange={(v) => update("bookingPageEnabled", v)}
            />
            <ToggleRow
              label="Auto-confirm bookings"
              hint="Incoming requests go straight to Confirmed status."
              checked={s.autoConfirmBookings ?? false}
              onChange={(v) => update("autoConfirmBookings", v)}
            />
            <ToggleRow
              label="Require deposit"
              checked={s.depositRequired ?? false}
              onChange={(v) => update("depositRequired", v)}
            />
            <Field label="Deposit amount ($)">
              <Input
                type="number"
                min="0"
                value={s.depositAmount ?? ""}
                onChange={(e) =>
                  update("depositAmount", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="50"
              />
            </Field>
            <Field label="Booking page URL slug" hint="yoursite.com/book/your-slug">
              <Input
                value={s.bookingPageSlug ?? ""}
                onChange={(e) => update("bookingPageSlug", e.target.value || undefined)}
                placeholder="my-detail-co"
              />
            </Field>
          </div>
        </SettingsSection>
      ) : null}

      {/* ── 6. Notifications ──────────────────────────────── */}
      {matches("notification", "reminder", "alert", "appointment", "payment", "follow", "review", "weather", "update") ? (
        <SettingsSection
          id="notifications"
          title="Notifications"
          description="What the app alerts you about and when."
          icon={Bell}
        >
          <ToggleRow
            label="Enable notifications"
            hint="Master switch — when off, no in-app notifications fire."
            checked={s.notificationsEnabled ?? true}
            onChange={(v) => update("notificationsEnabled", v)}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Individual alerts</p>
            <div className={cn("space-y-2", !(s.notificationsEnabled ?? true) && "opacity-50 pointer-events-none")}>
              <ToggleRow
                label="Appointment reminders"
                hint="Fires before upcoming jobs based on reminder timing below."
                checked={s.notifyAppointments ?? true}
                onChange={(v) => update("notifyAppointments", v)}
              />
              <ToggleRow
                label="Payment & invoice alerts"
                hint="Unpaid jobs, deposits received, overdue invoices."
                checked={s.notifyPayments ?? true}
                onChange={(v) => update("notifyPayments", v)}
              />
              <ToggleRow
                label="Follow-up reminders"
                hint="When leads or completed jobs need a follow-up."
                checked={s.notifyFollowUps ?? true}
                onChange={(v) => update("notifyFollowUps", v)}
              />
              <ToggleRow
                label="Review request reminders"
                hint="Prompts to send a review request after a completed job."
                checked={s.notifyReviews ?? true}
                onChange={(v) => update("notifyReviews", v)}
              />
              <ToggleRow
                label="Weather warnings"
                checked={s.notifyWeather ?? true}
                onChange={(v) => update("notifyWeather", v)}
              />
              <ToggleRow
                label="App update notifications"
                checked={s.notifyUpdates ?? true}
                onChange={(v) => update("notifyUpdates", v)}
              />
            </div>
          </div>

          <Field label="Reminder timing">
            <select
              value={s.reminderMinutes ?? 60}
              onChange={(e) => update("reminderMinutes", Number(e.target.value))}
              disabled={!(s.notificationsEnabled ?? true)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
              <option value={1440}>1 day before</option>
            </select>
          </Field>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!(s.notificationsEnabled ?? true)}
            onClick={() => {
              dispatch({
                type: "addNotification",
                notification: {
                  id: `test_${Date.now()}`,
                  type: "info",
                  title: "Test notification",
                  message: "Notifications are working.",
                  read: false,
                  createdAt: new Date().toISOString(),
                },
              });
              toast.success("Test notification sent");
            }}
          >
            Send test notification
          </Button>

          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-200">
            Notifications fire while the app is open. Push notifications that wake your phone when closed require a server piece and will come in a future update.
          </p>
        </SettingsSection>
      ) : null}

      {/* ── 7. Appearance ─────────────────────────────────── */}
      {matches("appearance", "theme", "light", "dark", "system", "accent", "color") ? (
        <SettingsSection
          id="appearance"
          title="Appearance"
          description="Theme and accent color."
          icon={Palette}
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Theme</p>
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
                  type="button"
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
          </div>

          <Field label="Accent color" hint="HEX or CSS color. Leave blank to use the default brand blue.">
            <div className="flex gap-2">
              <Input
                value={s.accentColor ?? ""}
                onChange={(e) => update("accentColor", e.target.value || undefined)}
                placeholder="#2f7bff"
                className="flex-1"
              />
              {s.accentColor ? (
                <div
                  className="h-10 w-10 shrink-0 rounded-md border"
                  style={{ backgroundColor: s.accentColor }}
                />
              ) : null}
            </div>
          </Field>
        </SettingsSection>
      ) : null}

      {/* ── 8. Data & Account ─────────────────────────────── */}
      {matches("data", "account", "export", "import", "backup", "sign out", "logout", "reset", "cloud", "sync") ? (
        <SettingsSection
          id="data"
          title="Data & Account"
          description="Backup, restore, and account management."
          icon={Shield}
        >
          <AccountInfo />
          <Separator />
          <DataTools />
          <Separator />
          <SignOutButton signOut={signOut} />
          <Separator />
          <DangerZone />
        </SettingsSection>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Account info sub-section
───────────────────────────────────────────── */
function AccountInfo() {
  const { user } = useAuth();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-emerald-500" />
        <div>
          <p className="text-sm font-medium">{user?.email}</p>
          <p className="text-xs text-muted-foreground">All data synced to Supabase</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Synced
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Data tools sub-section
───────────────────────────────────────────── */
function DataTools() {
  const { data, reload } = useStore();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [migrationState, setMigrationState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [migrationMsg, setMigrationMsg] = useState<string | null>(null);
  const [hasLegacy, setHasLegacy] = useState(false);

  useEffect(() => {
    setHasLegacy(hasLegacyContent());
  }, []);

  function handleExport() {
    const blob = new Blob([exportSnapshot(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detail-command-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  async function handleImportFile(file: File) {
    if (!user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const json = String(reader.result || "");
      const parsed = importSnapshot(json);
      if (!parsed) {
        setImportStatus("error");
        toast.error("Invalid backup file");
        return;
      }
      try {
        await api.bulkImport(parsed, user.id);
        await reload();
        toast.success("Backup imported and synced");
        setImportStatus("done");
      } catch (e) {
        toast.error("Could not sync — check connection");
        console.error(e);
      }
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
    try {
      await api.bulkImport(legacy, user.id);
      clearLegacyData();
      await reload();
      setHasLegacy(false);
      setMigrationState("done");
      setMigrationMsg("Local data imported into your account.");
      toast.success("Local data imported and synced");
    } catch (e) {
      console.error(e);
      setMigrationState("error");
      setMigrationMsg(e instanceof Error ? e.message : "Failed to migrate data.");
    }
  }

  return (
    <div className="space-y-3">
      {hasLegacy ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm font-medium">Local-only data detected</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Data from an older version of the app is stored only in this browser. Import it to sync everywhere.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={migrateLegacy} disabled={migrationState === "running"}>
              {migrationState === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CloudUpload className="h-3.5 w-3.5" />
              )}
              Import device data
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Discard local-only data without importing?")) {
                  clearLegacyData();
                  setHasLegacy(false);
                }
              }}
            >
              Discard
            </Button>
            {migrationState === "done" ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> {migrationMsg}
              </span>
            ) : null}
            {migrationState === "error" ? (
              <span className="text-xs text-destructive">{migrationMsg}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Export backup
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Import backup
        </Button>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCcw className="h-3.5 w-3.5" /> Refresh from cloud
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
      </div>
      {importStatus === "done" ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> Backup imported and synced to cloud
        </p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sign-out
───────────────────────────────────────────── */
function SignOutButton({ signOut }: { signOut: () => void }) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (window.confirm("Sign out of Detail Command?")) signOut();
      }}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}

/* ─────────────────────────────────────────────
   Danger zone
───────────────────────────────────────────── */
function DangerZone() {
  const { data, dispatch, reload } = useStore();
  const [busy, setBusy] = useState(false);

  const totalRows =
    data.customers.length +
    data.appointments.length +
    data.leads.length +
    data.tasks.length +
    data.services.length +
    data.checklists.length +
    data.expenses.length +
    data.startup.length +
    data.blocks.length +
    (data.photos?.length ?? 0);

  async function handleReset() {
    const confirm1 = window.confirm(
      "Wipe ALL data? This deletes every customer, appointment, lead, task, service, checklist, expense, and calendar block. Settings stay. Cannot be undone."
    );
    if (!confirm1) return;
    const confirm2 = window.prompt("Type RESET to confirm.");
    if (confirm2 !== "RESET") {
      toast.message("Reset cancelled");
      return;
    }
    setBusy(true);
    try {
      data.appointments.forEach((a) => dispatch({ type: "deleteAppointment", id: a.id }));
      data.tasks.forEach((t) => dispatch({ type: "deleteTask", id: t.id }));
      (data.photos ?? []).forEach((p) => dispatch({ type: "deletePhoto", id: p.id }));
      data.checklists.forEach((c) => dispatch({ type: "deleteChecklist", id: c.id }));
      data.startup.forEach((i) => dispatch({ type: "deleteStartup", id: i.id }));
      data.expenses.forEach((e) => dispatch({ type: "deleteExpense", id: e.id }));
      data.leads.forEach((l) => dispatch({ type: "deleteLead", id: l.id }));
      data.services.forEach((s) => dispatch({ type: "deleteService", id: s.id }));
      data.blocks.forEach((b) => dispatch({ type: "deleteBlock", id: b.id }));
      data.customers.forEach((c) => dispatch({ type: "deleteCustomer", id: c.id }));
      await new Promise((r) => setTimeout(r, 800));
      await reload();
      toast.success("All data cleared.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-destructive uppercase tracking-wide">Danger zone</p>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Reset all data</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Wipe every record from your account. Settings and profile stay.{" "}
            <span className="font-medium">{totalRows} record{totalRows === 1 ? "" : "s"}</span> will be permanently deleted.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={handleReset}
          disabled={busy || totalRows === 0}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {totalRows === 0 ? "Already empty" : `Reset all data`}
        </Button>
      </div>
    </div>
  );
}
