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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { useStore } from "@/store/store";
import {
  customerAppointmentCount,
  customerLifetimeValue,
} from "@/lib/selectors";
import { cn, formatCurrency, initials, phoneFmt, vehicleStr } from "@/lib/utils";

type Filter = "all" | "repeat" | "monthly";

export function CustomersPage() {
  const { data } = useStore();
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
    <div className="space-y-5">
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
        <div className="flex gap-1.5">
          {(
            [
              { v: "all", label: `All (${data.customers.length})` },
              { v: "repeat", label: `Repeat (${data.customers.filter((c) => c.isRepeat).length})` },
              { v: "monthly", label: `Monthly (${data.customers.filter((c) => c.isMonthlyMaintenance).length})` },
            ] as { v: Filter; label: string }[]
          ).map((f) => (
            <Button
              key={f.v}
              variant={filter === f.v ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.v)}
            >
              {f.label}
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
                className="group rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-soft">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold">{c.name}</p>
                      {c.isRepeat ? (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      ) : null}
                      {c.isMonthlyMaintenance ? (
                        <Repeat className="h-3.5 w-3.5 text-emerald-500" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {phoneFmt(c.phone)}
                    </p>
                    {c.email ? (
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </p>
                    ) : null}
                  </div>
                </div>
                {c.vehicles[0] ? (
                  <div className="mt-3 flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
                    <Car className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{vehicleStr(c.vehicles[0])}</span>
                    {c.vehicles.length > 1 ? (
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        +{c.vehicles.length - 1}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Lifetime: </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(ltv)}
                    </span>
                  </div>
                  <div className={cn("text-muted-foreground")}>
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
