import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Repeat,
  Star,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { useRegisterIrisContext } from "@/components/iris/PageContext";
import { useStore } from "@/store/store";
import {
  customerAppointmentCount,
  customerLifetimeValue,
} from "@/lib/selectors";
import { cn, formatCurrency, initials, phoneFmt, vehicleStr } from "@/lib/utils";

type Filter = "all" | "repeat" | "monthly";

export function CustomersPage() {
  const { data } = useStore();
  useRegisterIrisContext({ page: "customers", label: "Customers" });
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...data.customers];
    if (filter === "repeat") list = list.filter((c) => c.isRepeat);
    if (filter === "monthly") list = list.filter((c) => c.isMonthlyMaintenance);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q) ||
          c.vehicles.some((v) =>
            (v.make + v.model + v.year).toLowerCase().includes(q)
          )
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.customers, query, filter]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Customers"
        description="Your CRM. Search, filter, and track lifetime value."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New customer
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) {
                params.set("q", e.target.value);
              } else {
                params.delete("q");
              }
              setParams(params, { replace: true });
            }}
            placeholder="Search by name, phone, address, vehicle…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              { v: "all", label: "All", count: data.customers.length },
              { v: "repeat", label: "Repeat", count: data.customers.filter((c) => c.isRepeat).length },
              { v: "monthly", label: "Monthly", count: data.customers.filter((c) => c.isMonthlyMaintenance).length },
            ] as { v: Filter; label: string; count: number }[]
          ).map((f) => (
            <Button
              key={f.v}
              variant={filter === f.v ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.v)}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  filter === f.v
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {f.count}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={data.customers.length === 0 ? "No customers yet" : "No customers match"}
          description={
            data.customers.length === 0
              ? "Add your first customer to start tracking jobs and lifetime value."
              : "Try a different search, or add a new customer."
          }
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add your first customer
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const ltv = customerLifetimeValue(data, c.id);
            const count = customerAppointmentCount(data, c.id);
            return (
              <Link
                key={c.id}
                to={`/customers/${c.id}`}
                className={cn(
                  "group rounded-md border border-border/80 bg-card p-4",
                  "transition-[border-color,background-color,box-shadow] duration-fast",
                  "hover:border-border hover:bg-hover hover:shadow-soft",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-semibold text-white shadow-soft">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold leading-tight">
                        {c.name}
                      </p>
                      {c.isRepeat ? (
                        <Star
                          className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500"
                          aria-label="Repeat customer"
                        />
                      ) : null}
                      {c.isMonthlyMaintenance ? (
                        <Repeat
                          className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                          aria-label="Monthly maintenance"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      <Phone className="h-3 w-3" />
                      {phoneFmt(c.phone)}
                    </p>
                    {c.email ? (
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-full">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                {c.vehicles[0] ? (
                  <div className="mt-3 flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs">
                    <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{vehicleStr(c.vehicles[0])}</span>
                    {c.vehicles.length > 1 ? (
                      <Badge variant="outline" className="ml-auto">
                        +{c.vehicles.length - 1}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      LTV
                    </span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCurrency(ltv)}
                    </span>
                  </div>
                  <div className="text-muted-foreground tabular-nums">
                    {count} appt{count === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CustomerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
