import { useState, useEffect } from "react";
import { formatISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useStore, makeId } from "@/store/store";
import type { Customer, Vehicle } from "@/lib/types";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
}

const EMPTY_VEHICLE: Vehicle = { year: "", make: "", model: "", color: "" };

export function CustomerDialog({ open, onOpenChange, customer }: CustomerDialogProps) {
  const { dispatch } = useStore();
  const [form, setForm] = useState<Customer>(() =>
    customer ?? {
      id: makeId(),
      name: "",
      phone: "",
      email: "",
      address: "",
      vehicles: [{ ...EMPTY_VEHICLE }],
      notes: "",
      isRepeat: false,
      isMonthlyMaintenance: false,
      createdAt: formatISO(new Date()),
    }
  );

  useEffect(() => {
    if (open) {
      setForm(
        customer ?? {
          id: makeId(),
          name: "",
          phone: "",
          email: "",
          address: "",
          vehicles: [{ ...EMPTY_VEHICLE }],
          notes: "",
          isRepeat: false,
          isMonthlyMaintenance: false,
          createdAt: formatISO(new Date()),
        }
      );
    }
  }, [open, customer]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      vehicles: form.vehicles.filter((v) => v.make || v.model),
    };
    if (customer) {
      dispatch({ type: "updateCustomer", id: customer.id, patch: payload });
      toast.success("Customer saved");
    } else {
      dispatch({ type: "addCustomer", customer: payload });
      toast.success("Customer added");
    }
    onOpenChange(false);
  }

  function updateVehicle(idx: number, patch: Partial<Vehicle>) {
    setForm((f) => ({
      ...f,
      vehicles: f.vehicles.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  }

  function addVehicle() {
    setForm((f) => ({ ...f, vehicles: [...f.vehicles, { ...EMPTY_VEHICLE }] }));
  }

  function removeVehicle(idx: number) {
    setForm((f) => ({ ...f, vehicles: f.vehicles.filter((_, i) => i !== idx) }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>Contact info, vehicles, and notes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr">Address</Label>
              <Input
                id="addr"
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Vehicles</h4>
              <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
                + Add vehicle
              </Button>
            </div>
            {form.vehicles.map((v, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input
                    value={v.year}
                    placeholder="Year"
                    onChange={(e) => updateVehicle(idx, { year: e.target.value })}
                  />
                  <Input
                    value={v.make}
                    placeholder="Make"
                    onChange={(e) => updateVehicle(idx, { make: e.target.value })}
                  />
                  <Input
                    value={v.model}
                    placeholder="Model"
                    onChange={(e) => updateVehicle(idx, { model: e.target.value })}
                  />
                  <Input
                    value={v.color}
                    placeholder="Color"
                    onChange={(e) => updateVehicle(idx, { color: e.target.value })}
                  />
                </div>
                <Textarea
                  value={v.conditionNotes ?? ""}
                  onChange={(e) => updateVehicle(idx, { conditionNotes: e.target.value })}
                  placeholder="Condition notes…"
                />
                {form.vehicles.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVehicle(idx)}
                    className="text-destructive"
                  >
                    Remove vehicle
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Gate code, dog at home, best time to call…"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="font-medium">Repeat customer</span>
              <Switch
                checked={!!form.isRepeat}
                onCheckedChange={(v) => setForm({ ...form, isRepeat: v })}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="font-medium">Monthly maintenance</span>
              <Switch
                checked={!!form.isMonthlyMaintenance}
                onCheckedChange={(v) => setForm({ ...form, isMonthlyMaintenance: v })}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{customer ? "Save changes" : "Add customer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
