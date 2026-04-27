import { useMemo, useState } from "react";
import { ImageIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoUploader } from "@/components/photos/PhotoUploader";
import { PhotoGallery } from "@/components/photos/PhotoGallery";
import { useStore } from "@/store/store";
import { PHOTO_TYPES, type Photo, type PhotoType } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    <div className="space-y-5">
      <SectionHeader
        title="Photos"
        description="Before/after, vehicle shots, damage proof — searchable across every job."
        actions={
          <PhotoUploader
            label="Upload photos"
            onUploaded={() => {
              // No-op — store update via dispatch refreshes the gallery
            }}
          />
        }
      />

      {photos.length === 0 ? (
        <PhotoUploader
          variant="dropzone"
          label="Drop your first photos here"
        />
      ) : null}

      {/* Filter row */}
      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px_220px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes, vehicle, customer, tags…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              value={customerFilter}
              onValueChange={(v) => setCustomerFilter(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="none">Unlinked photos</SelectItem>
                {data.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={dateFilter}
              onValueChange={(v) => setDateFilter(v as DateFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters ? (
              <button
                onClick={() => {
                  setTypeFilter("all");
                  setCustomerFilter("all");
                  setDateFilter("all");
                  setQuery("");
                }}
                className="rounded-md border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                Reset filters
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
        </div>
      ) : null}

      {/* Gallery */}
      {filtered.length === 0 && photos.length > 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-5 w-5" />}
          title="Nothing matches"
          description="Try a different filter combo or reset."
        />
      ) : (
        <PhotoGallery photos={filtered} />
      )}
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
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}
