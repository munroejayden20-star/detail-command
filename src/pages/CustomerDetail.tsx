import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  Pencil,
  Trash2,
  Car,
  Repeat,
  Star,
  Plus,
  MessageSquare,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { ReachOutDialog } from "@/components/contact/ReachOutDialog";
import { CustomerIntelligencePanel } from "@/components/intelligence/CustomerIntelligencePanel";
import { useRegisterIrisContext } from "@/components/iris/PageContext";
import { PhotoGallery } from "@/components/photos/PhotoGallery";
import { PhotoUploader } from "@/components/photos/PhotoUploader";
import { AppointmentRow } from "@/components/appointments/AppointmentRow";
import { ReceiptViewModal } from "@/components/receipts/ReceiptViewModal";
import { formatCents } from "@/lib/receipts";
import type { Receipt } from "@/lib/types";
import { useStore } from "@/store/store";
import {
  customerAppointmentCount,
  customerLifetimeValue,
  jobDurationMinutes,
  formatDurationMinutes,
} from "@/lib/selectors";
import { cn, formatCurrency, initials, phoneFmt, vehicleStr } from "@/lib/utils";

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, dispatch } = useStore();
  const customer = data.customers.find((c) => c.id === id);
  useRegisterIrisContext(
    customer
      ? {
          page: "customer-detail",
          label: `Customer · ${customer.name}`,
          entity: { type: "customer", id: customer.id, name: customer.name },
        }
      : null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [newAppt, setNewAppt] = useState(false);
  const [reachOpen, setReachOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const customerReceipts = useMemo(() => {
    if (!id) return [];
    return (data.receipts ?? [])
      .filter((r) => r.customerId === id)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }, [data.receipts, id]);

  const receiptTotals = useMemo(() => {
    const active = customerReceipts.filter((r) => r.receiptStatus === "active");
    const totalSpentCents = active.reduce((s, r) => s + r.amountPaidCents, 0);
    const unpaidCents = active.reduce((s, r) => s + r.remainingBalanceCents, 0);
    const lastReceiptAt = active[0]?.createdAt;
    return { count: active.length, totalSpentCents, unpaidCents, lastReceiptAt };
  }, [customerReceipts]);

  if (!customer) {
    return (
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <EmptyState title="Customer not found" />
      </div>
    );
  }

  const appts = data.appointments
    .filter((a) => a.customerId === customer.id)
    .sort((a, b) => b.start.localeCompare(a.start));
  const photos = (data.photos ?? []).filter((p) => p.customerId === customer.id);
  const beforePhotos = photos.filter((p) => p.type === "before");
  const afterPhotos = photos.filter((p) => p.type === "after");
  const otherPhotos = photos.filter(
    (p) => p.type !== "before" && p.type !== "after"
  );
  const ltv = customerLifetimeValue(data, customer.id);
  const count = customerAppointmentCount(data, customer.id);
  // Average job time across this customer's timed jobs (Work Mode timer).
  const timedDurations = appts
    .map((a) => jobDurationMinutes(a))
    .filter((m): m is number => m != null);
  const avgJobMinutes = timedDurations.length
    ? Math.round(timedDurations.reduce((s, m) => s + m, 0) / timedDurations.length)
    : null;

  function handleDelete() {
    if (window.confirm(`Delete ${customer!.name}? Appointments will remain but reference a missing customer.`)) {
      dispatch({ type: "deleteCustomer", id: customer!.id });
      navigate("/customers");
    }
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/customers">
          <ArrowLeft className="h-4 w-4" /> All customers
        </Link>
      </Button>

      <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-soft">
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white shadow-soft">
                {initials(customer.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                    {customer.name}
                  </h1>
                  {customer.isRepeat ? (
                    <Badge variant="warning">
                      <Star className="h-3 w-3 fill-current" /> Repeat
                    </Badge>
                  ) : null}
                  {customer.isMonthlyMaintenance ? (
                    <Badge variant="success">
                      <Repeat className="h-3 w-3" /> Monthly
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground tabular-nums"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {phoneFmt(customer.phone)}
                  </a>
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {customer.email}
                    </a>
                  ) : null}
                  {customer.address ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {customer.address}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setReachOpen(true)}>
                <MessageSquare className="h-4 w-4" /> Reach out
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button size="sm" onClick={() => setNewAppt(true)}>
                <Plus className="h-4 w-4" /> Book job
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                aria-label="Delete customer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats strip — hairline-divided, runs full width like a profile band */}
        <div
          className={cn(
            "grid border-t border-border/60 divide-x divide-border/60 bg-muted/20",
            avgJobMinutes != null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
          )}
        >
          <SimpleStat label="Lifetime revenue" value={formatCurrency(ltv)} />
          <SimpleStat label="Total jobs" value={count} />
          <SimpleStat
            label="Last visit"
            value={
              appts.find((a) => a.status === "completed")
                ? format(
                    parseISO(
                      appts.find((a) => a.status === "completed")!.start
                    ),
                    "MMM d, yyyy"
                  )
                : "—"
            }
          />
          {avgJobMinutes != null ? (
            <SimpleStat
              label="Avg job time"
              value={formatDurationMinutes(avgJobMinutes)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Appointment history</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/calendar">
                <CalendarIcon className="h-4 w-4" /> Calendar
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {appts.length === 0 ? (
              <EmptyState
                title="No appointments yet"
                description="Book this customer's first job."
                action={
                  <Button size="sm" onClick={() => setNewAppt(true)}>
                    <Plus className="h-4 w-4" /> Book job
                  </Button>
                }
              />
            ) : (
              appts.map((a) => <AppointmentRow key={a.id} appointment={a} />)
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <CustomerIntelligencePanel customerId={customer.id} />

          <Card>
            <CardHeader>
              <CardTitle>Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer.vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles on file.</p>
              ) : (
                customer.vehicles.map((v, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">{vehicleStr(v)}</p>
                    </div>
                    {v.conditionNotes ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {v.conditionNotes}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {customer.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {customer.notes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Receipts & payment history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ReceiptIcon className="h-4 w-4" /> Receipts & payment history
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {receiptTotals.count} receipt{receiptTotals.count === 1 ? "" : "s"} ·{" "}
              {formatCents(receiptTotals.totalSpentCents)} collected
              {receiptTotals.unpaidCents > 0
                ? ` · ${formatCents(receiptTotals.unpaidCents)} outstanding`
                : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {customerReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No receipts yet for this customer.
            </p>
          ) : (
            <div className="space-y-2">
              {customerReceipts.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReceipt(r)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/80 bg-card px-3 py-2.5 text-left text-sm transition-[border-color,background-color] duration-fast hover:border-border hover:bg-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium leading-tight">
                      {r.receiptNumber}
                      {r.receiptStatus === "voided" ? (
                        <span className="inline-flex items-center rounded-full border border-slate-500/20 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                          Voided
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                      {format(parseISO(r.createdAt), "MMM d, yyyy")} ·{" "}
                      {r.paymentMethod === "apple_pay" ? "Apple Pay" : r.paymentMethod} ·{" "}
                      {r.paymentStatus}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatCents(r.totalCents, r.currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Photos</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {photos.length} total · {beforePhotos.length} before ·{" "}
              {afterPhotos.length} after
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <PhotoUploader
              defaultType="before"
              customerId={customer.id}
              vehicle={customer.vehicles[0] ? vehicleStr(customer.vehicles[0]) : undefined}
              label="Before"
            />
            <PhotoUploader
              defaultType="after"
              customerId={customer.id}
              vehicle={customer.vehicles[0] ? vehicleStr(customer.vehicles[0]) : undefined}
              label="After"
            />
            <PhotoUploader
              defaultType="general"
              customerId={customer.id}
              vehicle={customer.vehicles[0] ? vehicleStr(customer.vehicles[0]) : undefined}
              label="Other"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No photos yet. Upload before/after shots to build a portfolio for this customer.
            </p>
          ) : (
            <>
              {beforePhotos.length > 0 || afterPhotos.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Before
                    </p>
                    <PhotoGallery
                      photos={beforePhotos}
                      size="sm"
                      emptyText="No before shots."
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      After
                    </p>
                    <PhotoGallery
                      photos={afterPhotos}
                      size="sm"
                      emptyText="No after shots."
                    />
                  </div>
                </div>
              ) : null}
              {otherPhotos.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Vehicle / general
                  </p>
                  <PhotoGallery photos={otherPhotos} size="sm" />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <AppointmentDialog open={newAppt} onOpenChange={setNewAppt} />
      {selectedReceipt ? (
        <ReceiptViewModal
          open={true}
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      ) : null}
      <ReachOutDialog
        open={reachOpen}
        onOpenChange={setReachOpen}
        contact={{
          name: customer.name,
          phone: customer.phone,
          email: customer.email ?? null,
          address: customer.address ?? null,
          vehicle: customer.vehicles[0] ? vehicleStr(customer.vehicles[0]) : null,
          followUpNotes: customer.notes ?? null,
        }}
      />
    </div>
  );
}

function SimpleStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold leading-tight tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
