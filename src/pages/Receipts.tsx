import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search, Receipt as ReceiptIcon, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
          <p className="text-sm text-muted-foreground">
            All receipts you've issued. {totals.count} active.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receipts" value={String(totals.count)} />
        <StatCard label="Collected" value={formatCents(totals.collected)} tone="emerald" />
        <StatCard label="Outstanding" value={formatCents(totals.outstanding)} tone="amber" />
        <StatCard label="Avg receipt" value={formatCents(totals.avg)} />
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ReceiptIcon className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No receipts yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mark an appointment complete to generate one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ReceiptIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {r.customerSnapshot?.name ?? "Unknown customer"}
                    </p>
                    <PaymentStatusBadge status={r.paymentStatus} voided={r.receiptStatus === "voided"} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.receiptNumber} · {format(parseISO(r.createdAt), "MMM d, yyyy")}
                    {r.vehicleSnapshot?.make
                      ? ` · ${r.vehicleSnapshot.year ?? ""} ${r.vehicleSnapshot.make} ${r.vehicleSnapshot.model ?? ""}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="font-mono text-sm font-semibold">
                  {formatCents(r.totalCents, r.currency)}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {r.paymentMethod === "apple_pay"
                    ? "Apple Pay"
                    : r.paymentMethod}
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold tracking-tight",
            tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
            tone === "amber" && "text-amber-600 dark:text-amber-400"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
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
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        Voided
      </span>
    );
  }
  const map = {
    paid: { label: "Paid", classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" },
    partial: { label: "Partial", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
    unpaid: { label: "Unpaid", classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200" },
  } as const;
  const m = map[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", m.classes)}>
      {m.label}
    </span>
  );
}
