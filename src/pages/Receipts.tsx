import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Search, Receipt as ReceiptIcon, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import type { Receipt, ReceiptPaymentMethod } from "@/lib/types";
import { RECEIPT_PAYMENT_METHODS } from "@/lib/types";
import { formatCents, RECEIPT_DISCLAIMER } from "@/lib/receipts";
import { ReceiptViewModal } from "@/components/receipts/ReceiptViewModal";
import { SectionHeader } from "@/components/ui/section-header";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function ReceiptsPage() {
  const { data } = useStore();
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"all" | ReceiptPaymentMethod>("all");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "voided">("active");
  const [paymentFilter, setPaymentFilter] =
    useState<"all" | "paid" | "partial" | "unpaid">("all");
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Open the receipt view modal when an id is passed in the URL (from search palette)
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const found = (data.receipts ?? []).find((r) => r.id === id);
    if (found) setSelected(found);
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, data.receipts, setSearchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.receipts ?? [])
      .filter((r) => (statusFilter === "all" ? true : r.receiptStatus === statusFilter))
      .filter((r) => (methodFilter === "all" ? true : r.paymentMethod === methodFilter))
      .filter((r) => (paymentFilter === "all" ? true : r.paymentStatus === paymentFilter))
      .filter((r) => {
        if (!q) return true;
        const fields = [
          r.receiptNumber,
          r.customerSnapshot?.name,
          r.customerSnapshot?.phone,
          r.vehicleSnapshot?.make,
          r.vehicleSnapshot?.model,
          r.notes,
          ...(r.lineItems ?? []).map((li) => li.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return fields.includes(q);
      })
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }, [data.receipts, search, methodFilter, statusFilter, paymentFilter]);

  const totals = useMemo(() => {
    const active = (data.receipts ?? []).filter((r) => r.receiptStatus === "active");
    const collected = active.reduce((sum, r) => sum + r.amountPaidCents, 0);
    const outstanding = active.reduce((sum, r) => sum + r.remainingBalanceCents, 0);
    const avg = active.length ? Math.round(collected / active.length) : 0;
    return {
      count: active.length,
      collected,
      outstanding,
      avg,
    };
  }, [data.receipts]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Receipts"
        description={`All receipts you've issued. ${totals.count} active.`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receipts" value={totals.count} hint="Active receipts" />
        <Stat
          label="Collected"
          value={formatCents(totals.collected)}
          trend={totals.collected > 0 ? "up" : "neutral"}
          hint="Amount paid in"
        />
        <Stat
          label="Outstanding"
          value={formatCents(totals.outstanding)}
          trend={totals.outstanding > 0 ? "down" : "up"}
          hint={totals.outstanding > 0 ? "Still owed" : "All collected"}
        />
        <Stat label="Avg receipt" value={formatCents(totals.avg)} hint="Across active" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, vehicle, receipt #…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as typeof paymentFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as typeof methodFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any method</SelectItem>
            {RECEIPT_PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon className="h-5 w-5" />}
          title="No receipts yet"
          description="Mark an appointment complete to generate one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={cn(
                "group flex flex-col gap-2 rounded-md border border-border/80 bg-card p-4 text-left",
                "transition-[border-color,background-color] duration-fast",
                "hover:border-border hover:bg-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "sm:flex-row sm:items-center sm:gap-4"
              )}
            >
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ReceiptIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {r.customerSnapshot?.name ?? "Unknown customer"}
                    </p>
                    <PaymentStatusBadge
                      status={r.paymentStatus}
                      voided={r.receiptStatus === "voided"}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                    {r.receiptNumber} · {format(parseISO(r.createdAt), "MMM d, yyyy")}
                    {r.vehicleSnapshot?.make
                      ? ` · ${r.vehicleSnapshot.year ?? ""} ${r.vehicleSnapshot.make} ${r.vehicleSnapshot.model ?? ""}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatCents(r.totalCents, r.currency)}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {r.paymentMethod === "apple_pay" ? "Apple Pay" : r.paymentMethod}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{RECEIPT_DISCLAIMER}</p>

      {selected ? (
        <ReceiptViewModal
          open={true}
          receipt={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function PaymentStatusBadge({
  status,
  voided,
}: {
  status: "paid" | "partial" | "unpaid";
  voided: boolean;
}) {
  if (voided) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
        Voided
      </span>
    );
  }
  const map = {
    paid: {
      label: "Paid",
      classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    partial: {
      label: "Partial",
      classes: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    unpaid: {
      label: "Unpaid",
      classes: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        m.classes
      )}
    >
      {m.label}
    </span>
  );
}
