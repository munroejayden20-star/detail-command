/* ============================================================================
 * PhotosPage — admin gallery, cinematic retreat.
 *
 * Photos look BEST on a dark surface — contrast amplifies. The page chrome
 * (filters, header, empty state) gets the cinematic treatment; the gallery
 * itself (PhotoGallery component) renders untouched — it already produces
 * its own card chrome and would be a separate scope to re-skin.
 *
 * Customer + date filters use native <select> elements rather than shadcn
 * Select. shadcn's Radix-driven trigger reads its colors from the light-mode
 * CSS vars (bg-background, border-input) which look wrong against obsidian.
 * Native selects respect the dark wrapper styling and avoid the bridge.
 * ========================================================================== */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ImageIcon, Search } from "lucide-react";
import { PhotoUploader } from "@/components/photos/PhotoUploader";
import { PhotoGallery } from "@/components/photos/PhotoGallery";
import { useStore } from "@/store/store";
import { PHOTO_TYPES, type Photo, type PhotoType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LuxAmbient, LuxEmptyState } from "@/components/dashboard/lux/primitives";

type TypeFilter = "all" | PhotoType;
type DateFilter = "all" | "7d" | "30d" | "90d";

const DATE_FILTERS: { value: DateFilter; label: string; days: number | null }[] = [
  { value: "all", label: "All time", days: null },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

export function PhotosPage() {
  const { data } = useStore();
  const photos: Photo[] = data.photos ?? [];
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...photos];
    if (typeFilter !== "all") list = list.filter((p) => p.type === typeFilter);
    if (customerFilter !== "all") {
      list =
        customerFilter === "none"
          ? list.filter((p) => !p.customerId)
          : list.filter((p) => p.customerId === customerFilter);
    }
    const dateMeta = DATE_FILTERS.find((d) => d.value === dateFilter);
    if (dateMeta?.days != null) {
      const cutoff = Date.now() - dateMeta.days * 24 * 60 * 60 * 1000;
      list = list.filter((p) => +new Date(p.createdAt) >= cutoff);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => {
        const cust = p.customerId
          ? data.customers.find((c) => c.id === p.customerId)?.name ?? ""
          : "";
        return (
          (p.notes ?? "").toLowerCase().includes(q) ||
          (p.vehicle ?? "").toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
          cust.toLowerCase().includes(q)
        );
      });
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [photos, typeFilter, customerFilter, dateFilter, query, data.customers]);

  const counts = useMemo(() => {
    const m = new Map<TypeFilter, number>();
    m.set("all", photos.length);
    PHOTO_TYPES.forEach((t) => m.set(t.value, 0));
    photos.forEach((p) => m.set(p.type, (m.get(p.type) ?? 0) + 1));
    return m;
  }, [photos]);

  const hasFilters =
    typeFilter !== "all" || customerFilter !== "all" || dateFilter !== "all" || !!query;

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-3rem)] bg-obsidian-950 px-4 pt-6 pb-12 text-platinum-100 sm:-mx-6 sm:px-6 md:-mx-10 md:-mt-6 md:px-10 md:pt-9 md:pb-16">
      <LuxAmbient />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative space-y-6"
      >
        {/* ═══ Hero ═══ */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-ember-300">
              Gallery · {photos.length}
            </p>
            <h1 className="mt-1.5 font-sans text-3xl font-extralight leading-tight tracking-tight text-platinum-50 sm:text-4xl">
              Photos
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-platinum-300/80">
              Before/after, vehicle shots, damage proof — searchable across every job.
            </p>
          </div>
          <div className="shrink-0">
            <PhotoUploader
              label="Upload photos"
              onUploaded={() => {
                /* dispatch refreshes the gallery */
              }}
            />
          </div>
        </section>

        {/* ═══ First-run dropzone ═══ */}
        {photos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.015] p-2">
            <PhotoUploader variant="dropzone" label="Drop your first photos here" />
          </div>
        ) : null}

        {/* ═══ Filters ═══ */}
        {photos.length > 0 ? (
          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_180px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-platinum-300/55" />
                <input
                  placeholder="Search notes, vehicle, customer, tags…"
                  className="block w-full appearance-none rounded-full border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-[13px] text-platinum-50 placeholder:text-platinum-300/45 backdrop-blur-sm outline-none transition-all duration-200 focus:border-ember-400/55 focus:bg-white/[0.05] focus:[box-shadow:0_0_0_4px_rgba(221,41,20,0.08)]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <DarkSelect
                value={customerFilter}
                onChange={(v) => setCustomerFilter(v)}
              >
                <option value="all">All customers</option>
                <option value="none">Unlinked photos</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={dateFilter}
                onChange={(v) => setDateFilter(v as DateFilter)}
              >
                {DATE_FILTERS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </DarkSelect>
              {hasFilters ? (
                <button
                  onClick={() => {
                    setTypeFilter("all");
                    setCustomerFilter("all");
                    setDateFilter("all");
                    setQuery("");
                  }}
                  className="rounded-full border border-dashed border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/70 transition-colors hover:border-white/25 hover:text-platinum-100"
                >
                  Reset
                </button>
              ) : (
                <span />
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={typeFilter === "all"}
                label={`All (${counts.get("all") ?? 0})`}
                onClick={() => setTypeFilter("all")}
              />
              {PHOTO_TYPES.map((t) => {
                const n = counts.get(t.value) ?? 0;
                if (n === 0 && typeFilter !== t.value) return null;
                return (
                  <FilterChip
                    key={t.value}
                    active={typeFilter === t.value}
                    label={`${t.label} (${n})`}
                    onClick={() => setTypeFilter(t.value)}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ═══ Gallery ═══ */}
        {filtered.length === 0 && photos.length > 0 ? (
          <LuxEmptyState
            icon={<ImageIcon className="h-5 w-5" />}
            title="Nothing matches"
            description="Try a different filter combo, or reset."
          />
        ) : (
          <PhotoGallery photos={filtered} />
        )}
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function DarkSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block h-10 w-full cursor-pointer appearance-none rounded-full border border-white/10 bg-white/[0.03] py-2 pl-4 pr-9 text-[13px] text-platinum-50 backdrop-blur-sm outline-none transition-all duration-200 focus:border-ember-400/55 focus:bg-white/[0.05] focus:[box-shadow:0_0_0_4px_rgba(221,41,20,0.08)] [&>option]:bg-obsidian-900 [&>option]:text-platinum-100"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-platinum-300/65"
      />
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-all duration-200",
        active
          ? "border-ember-400/45 bg-ember-500/10 text-platinum-50"
          : "border-white/10 bg-white/[0.02] text-platinum-300/75 hover:border-white/20 hover:bg-white/[0.04] hover:text-platinum-100",
      )}
    >
      {label}
    </button>
  );
}
