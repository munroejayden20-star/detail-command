import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/ui/section-header";
import { useStore, makeId } from "@/store/store";
import type { Service } from "@/lib/types";

export function ServicesPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | undefined>();

  const packages = data.services.filter((s) => !s.isAddon);
  const addons = data.services.filter((s) => s.isAddon);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Services & Pricing"
        description="Edit your menu, suggested prices, and durations."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus className="h-4 w-4" /> New service
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Service packages
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={() => {
                setEditing(s);
                setOpen(true);
              }}
              onDelete={() => {
                if (window.confirm(`Delete "${s.name}"?`)) dispatch({ type: "deleteService", id: s.id });
              }}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Add-ons
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {addons.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={() => {
                setEditing(s);
                setOpen(true);
              }}
              onDelete={() => {
                if (window.confirm(`Delete add-on "${s.name}"?`)) dispatch({ type: "deleteService", id: s.id });
              }}
            />
          ))}
        </CardContent>
      </Card>

      <ServiceDialog open={open} onOpenChange={setOpen} service={editing} />
    </div>
  );
}

function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{service.name}</p>
          {service.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
              {service.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold">
          ${service.priceLow}
          {service.priceHigh !== service.priceLow ? `–$${service.priceHigh}` : ""}
        </span>
        <Badge variant="outline">{service.durationMinutes} min</Badge>
      </div>
    </div>
  );
}

function ServiceDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState<Service>(() =>
    service ?? {
      id: makeId(),
      name: "",
      description: "",
      priceLow: 80,
      priceHigh: 120,
      durationMinutes: 90,
      isAddon: false,
    }
  );

  useEffect(() => {
    if (open) {
      setForm(
        service ?? {
          id: makeId(),
          name: "",
          description: "",
          priceLow: 80,
          priceHigh: 120,
          durationMinutes: 90,
          isAddon: false,
        }
      );
    }
  }, [open, service]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (service) {
      dispatch({ type: "updateService", id: service.id, patch: form });
    } else {
      dispatch({ type: "addService", service: form });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>Used in appointment forms and pricing estimates.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sname">Name</Label>
            <Input
              id="sname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sdesc">Description</Label>
            <Textarea
              id="sdesc"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's included…"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slow">Price low</Label>
              <Input
                id="slow"
                type="number"
                min="0"
                value={form.priceLow}
                onChange={(e) => setForm({ ...form, priceLow: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shigh">Price high</Label>
              <Input
                id="shigh"
                type="number"
                min="0"
                value={form.priceHigh}
                onChange={(e) => setForm({ ...form, priceHigh: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sdur">Duration (min)</Label>
              <Input
                id="sdur"
                type="number"
                min="0"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="font-medium">Is this an add-on?</span>
            <Switch
              checked={!!form.isAddon}
              onCheckedChange={(v) => setForm({ ...form, isAddon: v })}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{service ? "Save" : "Add service"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
