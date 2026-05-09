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
} from "@/lib/selectors";
import { formatCurrency, initials, phoneFmt, vehicleStr } from "@/lib/utils";

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, dispatch } = useStore();
  const customer = data.customers.find((c) => c.id === id);
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

      <div className="rounded-xl border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base font-semibold text-white shadow-soft">
              {initials(customer.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
                {customer.isRepeat ? (
                  <Badge variant="soft">
                    <Star className="mr-1 h-3 w-3" /> Repeat
                  </Badge>
                ) : null}
                {customer.isMonthlyMaintenance ? (
                  <Badge variant="soft">
                    <Repeat className="mr-1 h-3 w-3" /> Monthly
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {phoneFmt(customer.phone)}
                </a>
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-foreground"
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setReachOpen(true)}>
              <MessageSquare className="h-4 w-4" /> Reach out
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button onClick={() => setNewAppt(true)}>
              <Plus className="h-4 w-4" /> Book job
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.receiptNumber}
                      {r.receiptStatus === "voided" ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Voided
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {format(parseISO(r.createdAt), "MMM d, yyyy")} ·{" "}
                      {r.paymentMethod === "apple_pay" ? "Apple Pay" : r.paymentMethod} ·{" "}
                      {r.paymentStatus}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold">
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
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
