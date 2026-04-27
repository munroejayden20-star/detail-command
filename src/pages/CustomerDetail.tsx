import { useState } from "react";
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
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { ReachOutDialog } from "@/components/contact/ReachOutDialog";
import { AppointmentRow } from "@/components/appointments/AppointmentRow";
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

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <AppointmentDialog open={newAppt} onOpenChange={setNewAppt} />
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
