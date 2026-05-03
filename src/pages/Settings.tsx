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
  ArrowUp,
  ArrowDown,
  Plus,
  Image as ImageIcon,
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
import { PhotoImage } from "@/components/photos/PhotoImage";
import { useStore, makeId } from "@/store/store";
import { uploadBookingPhoto } from "@/lib/booking-api";
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

      {/* ── 5. Booking Page ───────────────────────────────── */}
      {matches("booking", "book", "deposit", "slug", "auto", "confirm", "hero", "headline", "subheadline", "water", "power", "faq", "featured", "photos", "phone", "email") ? (
        <SettingsSection
          id="booking"
          title="Booking Page"
          description="Public booking page for customers to request appointments."
          icon={Star}
          badge={s.bookingPageEnabled ? "Live" : undefined}
        >
          <ToggleRow
            label="Enable booking page"
            hint="Allow customers to request appointments at your-site.com/book."
            checked={s.bookingPageEnabled ?? false}
            onChange={(v) => update("bookingPageEnabled", v)}
          />

          {s.bookingPageEnabled ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Booking page is live</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Share <span className="font-mono">/book</span> with customers to start receiving requests.
                </p>
              </div>
              <a
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  Preview
                </Button>
              </a>
            </div>
          ) : null}

          <div className={cn("space-y-2", !s.bookingPageEnabled && "opacity-50 pointer-events-none")}>
            <ToggleRow
              label="Auto-confirm bookings"
              hint="Incoming requests go straight to Confirmed. Leave off to review each request first."
              checked={s.autoConfirmBookings ?? false}
              onChange={(v) => update("autoConfirmBookings", v)}
            />
            <ToggleRow
              label="Require deposit"
              hint="Deposit collection requires Stripe setup (coming soon)."
              checked={s.depositRequired ?? false}
              onChange={(v) => update("depositRequired", v)}
              disabled
            />
          </div>

          <Field label="Default quote disclaimer" hint="Shown at the bottom of the booking review step.">
            <Textarea
              rows={2}
              value={s.defaultQuoteDisclaimer ?? ""}
              onChange={(e) => update("defaultQuoteDisclaimer", e.target.value || undefined)}
              placeholder="Estimated price may vary based on actual vehicle condition. Final price confirmed on-site."
            />
          </Field>

          {/* ── Phase 6B — Landing-page customization ─────────────────── */}
          <Separator />
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Landing page content</p>
            <p className="text-[11px] text-muted-foreground">
              Override the default copy and pick what shows in the photo gallery. Leave a field blank to use the default.
            </p>
          </div>

          <Field label="Hero headline" hint="Main heading at the top of the page. Use — (em dash) to make the text after it red.">
            <Input
              value={s.bookingHeroHeadline ?? ""}
              onChange={(e) => update("bookingHeroHeadline", e.target.value || undefined)}
              placeholder="Premium Mobile Detailing — We Come To You"
              maxLength={120}
            />
          </Field>

          <Field label="Hero subheadline" hint="One-sentence sub-text below the headline.">
            <Textarea
              rows={2}
              value={s.bookingHeroSubheadline ?? ""}
              onChange={(e) => update("bookingHeroSubheadline", e.target.value || undefined)}
              placeholder="Professional interior and exterior detailing brought to your driveway. Serving Vancouver / Portland."
              maxLength={280}
            />
          </Field>

          <SingleImageUploader
            label="Logo / favicon"
            hint="Small square image — appears next to your business name on /book and as the browser tab icon. Used in nav, footer, and as the favicon."
            value={s.logoUrl}
            onChange={(url) => update("logoUrl", url)}
            aspectRatio="square"
            recommendation="Square works best. PNG with transparent background looks cleanest."
          />

          <SingleImageUploader
            label="Hero image"
            hint="Big image at the top-right of /book. A real photo of your work makes a huge difference."
            value={s.bookingHeroImageUrl}
            onChange={(url) => update("bookingHeroImageUrl", url)}
            aspectRatio="4/3"
            recommendation="Landscape (4:3) works best."
          />

          <Field label="Water & power section text" hint="Replaces the default 'What I need from you' paragraph.">
            <Textarea
              rows={4}
              value={s.bookingWaterPowerText ?? ""}
              onChange={(e) => update("bookingWaterPowerText", e.target.value || undefined)}
              placeholder="I bring all the detailing tools and products. I just need access to an outdoor water spigot and a standard power outlet — unless we work something out beforehand."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Booking page phone" hint="Shown in the footer. Defaults to your contact phone if blank.">
              <Input
                value={s.bookingPhone ?? ""}
                onChange={(e) => update("bookingPhone", e.target.value || undefined)}
                placeholder="(360) 555-1234"
              />
            </Field>
            <Field label="Booking page email" hint="Shown in the footer. Defaults to your contact email if blank.">
              <Input
                type="email"
                value={s.bookingEmail ?? ""}
                onChange={(e) => update("bookingEmail", e.target.value || undefined)}
                placeholder="bookings@example.com"
              />
            </Field>
          </div>

          <Separator />
          <FeaturedPhotosPicker
            selectedIds={s.bookingFeaturedPhotoIds ?? []}
            onChange={(ids) => update("bookingFeaturedPhotoIds", ids)}
          />

          <Separator />
          <FaqEditor
            faqs={s.bookingFaqs ?? []}
            onChange={(next) => update("bookingFaqs", next.length ? next : undefined)}
          />
        </SettingsSection>
      ) : null}

      {/* ── 5b. Deposits & Payments ─────────────────────────── */}
      {matches("deposit", "stripe", "payment", "money", "checkout", "refund") ? (
        <SettingsSection
          id="deposits"
          title="Deposits & Payments"
          description="Stripe deposit collection on booking submissions."
          icon={Sliders}
          badge={s.bookingDepositsEnabled ? "Live" : undefined}
        >
          <ToggleRow
            label="Enable deposits"
            hint="Master switch for the Stripe deposit flow. When off, all bookings are free as before."
            checked={s.bookingDepositsEnabled ?? false}
            onChange={(v) => update("bookingDepositsEnabled", v)}
          />

          {!s.bookingDepositsEnabled ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-200">
              Deposits are off. Bookings submit for free as before. Turn this on once you've set up Stripe + deployed the edge functions (see <span className="font-mono">/supabase/functions</span>).
            </div>
          ) : null}

          <div className={cn("space-y-2", !s.bookingDepositsEnabled && "opacity-50 pointer-events-none")}>
            <ToggleRow
              label="Require deposit to submit a booking"
              hint="When on, customers must pay the deposit before their booking is created. When off, the booking page submits like before."
              checked={s.bookingDepositRequired ?? false}
              onChange={(v) => update("bookingDepositRequired", v)}
            />
            <ToggleRow
              label="Auto-confirm bookings after deposit paid"
              hint="When OFF (recommended), paid bookings still need your manual approval. When ON, they jump straight to Confirmed."
              checked={s.bookingAutoConfirmAfterDeposit ?? false}
              onChange={(v) => update("bookingAutoConfirmAfterDeposit", v)}
            />
            <ToggleRow
              label="Deposit applies toward final total"
              hint="Customers see the deposit subtracted from the estimated total. Almost always ON."
              checked={s.bookingDepositAppliesToTotal ?? true}
              onChange={(v) => update("bookingDepositAppliesToTotal", v)}
            />
            <ToggleRow
              label="Allow booking without deposit (escape hatch)"
              hint="If on, customers see a 'submit without deposit' option. Most setups leave this OFF."
              checked={s.bookingAllowWithoutDeposit ?? false}
              onChange={(v) => update("bookingAllowWithoutDeposit", v)}
            />
          </div>

          <div className={cn("grid gap-4 sm:grid-cols-2", !s.bookingDepositsEnabled && "opacity-50 pointer-events-none")}>
            <Field label="Deposit amount ($)" hint="Server-authoritative. Customers cannot influence this.">
              <Input
                type="number"
                min="0"
                step="1"
                value={((s.bookingDepositAmountCents ?? 3000) / 100).toString()}
                onChange={(e) =>
                  update(
                    "bookingDepositAmountCents",
                    Math.max(0, Math.round(Number(e.target.value || 0) * 100))
                  )
                }
                placeholder="30"
              />
            </Field>
          </div>

          <Field
            label="Disclaimer text on booking review"
            hint="Shown above the Pay Deposit button. Leave blank for the default."
          >
            <Textarea
              rows={3}
              value={s.bookingDepositDisclaimer ?? ""}
              onChange={(e) => update("bookingDepositDisclaimer", e.target.value || undefined)}
              placeholder={
                s.bookingAutoConfirmAfterDeposit
                  ? "A $30 deposit is required to reserve your appointment. This deposit goes toward your final detail price."
                  : "A $30 deposit is required to reserve your appointment request. This deposit goes toward your final detail price. Your appointment will be reviewed and confirmed after submission. Final pricing may vary based on vehicle condition at inspection."
              }
            />
          </Field>

          <Field label="Refund policy" hint="Shown under the deposit disclaimer on /book.">
            <Textarea
              rows={2}
              value={s.bookingDepositRefundPolicy ?? ""}
              onChange={(e) => update("bookingDepositRefundPolicy", e.target.value || undefined)}
              placeholder="Deposits are refundable up to 24 hours before your appointment."
            />
          </Field>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-[11px] text-blue-700 dark:text-blue-200 leading-relaxed">
            <p className="font-semibold mb-1">Deployment checklist</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Run <span className="font-mono">supabase/phase_7_deposits.sql</span> in Supabase SQL Editor.</li>
              <li>
                Set Stripe secrets:{" "}
                <span className="font-mono">supabase secrets set STRIPE_SECRET_KEY=sk_test_… APP_URL=https://jmdetailing.vercel.app</span>
              </li>
              <li>
                Deploy edge functions:{" "}
                <span className="font-mono">supabase functions deploy stripe-checkout</span> and{" "}
                <span className="font-mono">supabase functions deploy stripe-webhook --no-verify-jwt</span>
              </li>
              <li>In Stripe dashboard → Developers → Webhooks: add the webhook endpoint URL pointing at your stripe-webhook function. Copy the signing secret and run <span className="font-mono">supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…</span></li>
              <li>Test in Stripe test mode using card 4242 4242 4242 4242.</li>
            </ol>
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

/* ─────────────────────────────────────────────
   Phase 6B: Reusable single-image uploader
   Used for the booking-page hero image AND the booking-page logo/favicon.
───────────────────────────────────────────── */
function SingleImageUploader({
  label,
  hint,
  value,
  onChange,
  aspectRatio = "4/3",
  recommendation,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  aspectRatio?: "square" | "4/3";
  recommendation?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aspectClass = aspectRatio === "square" ? "aspect-square w-32" : "aspect-[4/3] w-full";

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadBookingPhoto(file);
      onChange(url);
      toast.success(`${label} updated`);
    } catch (e) {
      console.error("Upload failed:", e);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />

      {value ? (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
          <div className={cn("rounded-lg overflow-hidden border", aspectClass)}>
            <img src={value} alt={label} className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Replace image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => onChange(undefined)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition-all",
            uploading
              ? "border-primary bg-primary/5 cursor-wait"
              : dragOver
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/30 hover:border-foreground/40 hover:bg-muted/50"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="font-medium">Uploading…</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <p className="font-medium">Click or drop an image</p>
              {recommendation ? (
                <p className="text-[11px] text-muted-foreground">{recommendation}</p>
              ) : null}
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 6B: Featured photos picker
───────────────────────────────────────────── */
function FeaturedPhotosPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, dispatch } = useStore();
  const photos = data.photos ?? [];
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function isPublic(storagePath: string) {
    return storagePath.startsWith("http://") || storagePath.startsWith("https://");
  }

  const selectedPhotos = selectedIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  }

  /** Upload one or more files to the public booking-uploads bucket, create
   *  Photo metadata for each, and auto-add them to the featured selection. */
  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      toast.error("Pick image files only.");
      return;
    }
    setUploading(true);
    const newIds: string[] = [];
    try {
      for (const file of list) {
        try {
          const url = await uploadBookingPhoto(file);
          const id = makeId();
          dispatch({
            type: "addPhoto",
            photo: {
              id,
              storagePath: url,
              type: "marketing",
              tags: ["booking-featured"],
              notes: "Booking page featured image",
              createdAt: new Date().toISOString(),
            },
          });
          newIds.push(id);
        } catch (err) {
          console.error("Upload failed:", file.name, err);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      if (newIds.length) {
        onChange([...selectedIds, ...newIds]);
        toast.success(`Uploaded ${newIds.length} photo${newIds.length === 1 ? "" : "s"}`);
      }
    } finally {
      setUploading(false);
    }
  }

  const eligibleCount = photos.filter((p) => isPublic(p.storagePath)).length;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Featured photos
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Drop images here or click to upload — they'll appear on /book in the gallery. You can also pick from existing photos below.
        </p>
      </div>

      {/* Big drop zone */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        disabled={uploading}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition-all",
          uploading
            ? "border-primary bg-primary/5 cursor-wait"
            : dragOver
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/30 hover:border-foreground/40 hover:bg-muted/50"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="font-medium">Uploading…</p>
          </>
        ) : (
          <>
            <CloudUpload className="h-6 w-6 text-muted-foreground" />
            <p className="font-medium">Click to upload or drag-drop images</p>
            <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP · multiple supported</p>
          </>
        )}
      </button>

      {/* Selected (in order) */}
      {selectedPhotos.length > 0 ? (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Selected ({selectedPhotos.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedPhotos.map((p, i) => (
              <div key={p.id} className="relative shrink-0 w-24">
                <PhotoImage
                  storagePath={p.storagePath}
                  className="aspect-[4/5] w-full rounded-md object-cover border"
                />
                <span className="absolute top-1 left-1 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5 font-bold">
                  {i + 1}
                </span>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="h-6 w-6 rounded border flex items-center justify-center disabled:opacity-30 hover:bg-accent"
                    aria-label="Move left"
                  >
                    <ArrowUp className="h-3 w-3 -rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === selectedPhotos.length - 1}
                    className="h-6 w-6 rounded border flex items-center justify-center disabled:opacity-30 hover:bg-accent"
                    aria-label="Move right"
                  >
                    <ArrowDown className="h-3 w-3 -rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="h-6 w-6 rounded border flex items-center justify-center text-destructive hover:bg-destructive/10"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Available photos grid */}
      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-center text-muted-foreground">
          No photos yet. Upload some on the Photos page or via /book to use them as featured.
        </p>
      ) : (
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">
            All photos ({photos.length}) — {eligibleCount} eligible for /book
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
            {photos.map((p) => {
              const selected = selectedIds.includes(p.id);
              const pub = isPublic(p.storagePath);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "relative aspect-square rounded-md overflow-hidden text-left transition-all",
                    selected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "border border-border hover:border-foreground/30"
                  )}
                  title={pub ? "Public photo — will render on /book" : "Private photo — won't render until bucket is updated"}
                >
                  <PhotoImage
                    storagePath={p.storagePath}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {selected ? (
                    <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shadow">
                      ✓
                    </span>
                  ) : null}
                  {!pub ? (
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-amber-300 text-center py-0.5 font-medium">
                      Private
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Phase 6B: FAQ editor
───────────────────────────────────────────── */
function FaqEditor({
  faqs,
  onChange,
}: {
  faqs: Array<{ q: string; a: string }>;
  onChange: (next: Array<{ q: string; a: string }>) => void;
}) {
  function update(idx: number, patch: Partial<{ q: string; a: string }>) {
    const next = [...faqs];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(faqs.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...faqs, { q: "", a: "" }]);
  }
  function move(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= faqs.length) return;
    const next = [...faqs];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FAQ</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Override the default questions on /book. Empty list = use defaults.
        </p>
      </div>

      {faqs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-center text-muted-foreground">
          Using default FAQs. Click below to add a custom question.
        </p>
      ) : (
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Question {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="h-7 w-7 rounded border flex items-center justify-center disabled:opacity-30 hover:bg-accent"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === faqs.length - 1}
                    className="h-7 w-7 rounded border flex items-center justify-center disabled:opacity-30 hover:bg-accent"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="h-7 w-7 rounded border flex items-center justify-center text-destructive hover:bg-destructive/10"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <Input
                value={f.q}
                onChange={(e) => update(i, { q: e.target.value })}
                placeholder="Question (e.g. Do you come to me?)"
              />
              <Textarea
                rows={2}
                value={f.a}
                onChange={(e) => update(i, { a: e.target.value })}
                placeholder="Answer…"
              />
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add question
      </Button>
    </div>
  );
}
