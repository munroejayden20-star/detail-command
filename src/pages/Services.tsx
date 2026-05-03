import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Sparkles, Tag, Percent, DollarSign, Flame } from "lucide-react";
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
import { toast } from "sonner";
import { useStore, makeId } from "@/store/store";
import { cn } from "@/lib/utils";
import type { Service, ServiceDiscount } from "@/lib/types";

function discountText(d: ServiceDiscount): string {
  const base = d.type === "percent" ? `${d.value}% OFF` : `$${d.value} OFF`;
  return d.label ? `${d.label} — ${base}` : base;
}

function applyDisc(price: number, d: ServiceDiscount): number {
  if (d.type === "percent") return Math.round(price * (1 - d.value / 100));
  return Math.max(0, price - d.value);
}

function isDiscExpired(d: ServiceDiscount): boolean {
  return !!d.expiry && new Date(d.expiry) < new Date();
}

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
        description="Edit your menu, suggested prices, durations, and special discounts."
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
              onEdit={() => { setEditing(s); setOpen(true); }}
              onDelete={() => {
                if (window.confirm(`Delete "${s.name}"?`)) {
                  dispatch({ type: "deleteService", id: s.id });
                  toast.success("Service deleted");
                }
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
              onEdit={() => { setEditing(s); setOpen(true); }}
              onDelete={() => {
                if (window.confirm(`Delete add-on "${s.name}"?`)) {
                  dispatch({ type: "deleteService", id: s.id });
                  toast.success("Add-on deleted");
                }
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
  const disc = service.discount;
  const activeDisc = disc?.active && !isDiscExpired(disc) ? disc : null;

  return (
    <div className="group rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-soft">
      {activeDisc && (
        <div className="mb-2 flex items-center gap-1.5">
          <Flame className="h-3 w-3 text-amber-500" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {discountText(activeDisc)}
            {activeDisc.expiry && (
              <span className="ml-1 font-normal text-amber-500/80">
                · ends {new Date(activeDisc.expiry).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        </div>
      )}
      {disc && !activeDisc && (
        <div className="mb-2">
          <span className="text-[10px] text-muted-foreground">
            {isDiscExpired(disc) ? "Discount expired" : "Discount inactive"}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{service.name}</p>
          {service.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{service.description}</p>
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
        <div className="flex items-baseline gap-2">
          {activeDisc ? (
            <>
              <span className="text-sm text-muted-foreground line-through">
                ${service.priceLow}{service.priceHigh !== service.priceLow ? `–$${service.priceHigh}` : ""}
              </span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                ${applyDisc(service.priceLow, activeDisc)}
                {service.priceHigh !== service.priceLow ? `–$${applyDisc(service.priceHigh, activeDisc)}` : ""}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold">
              ${service.priceLow}{service.priceHigh !== service.priceLow ? `–$${service.priceHigh}` : ""}
            </span>
          )}
        </div>
        <Badge variant="outline">{service.durationMinutes} min</Badge>
      </div>
    </div>
  );
}

const BLANK_SERVICE: Service = {
  id: "",
  name: "",
  description: "",
  priceLow: 80,
  priceHigh: 120,
  durationMinutes: 90,
  isAddon: false,
};

const BLANK_DISCOUNT: ServiceDiscount = {
  active: true,
  type: "percent",
  value: 10,
};

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
    service ? { ...service } : { ...BLANK_SERVICE, id: makeId() }
  );

  useEffect(() => {
    if (open) {
      setForm(service ? { ...service } : { ...BLANK_SERVICE, id: makeId() });
    }
  }, [open, service]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = {
      ...form,
      discount:
        form.discount?.active
          ? form.discount
          : form.discount
          ? { ...form.discount, active: false }
          : undefined,
    };
    if (service) {
      dispatch({ type: "updateService", id: service.id, patch: cleaned });
      toast.success("Service saved");
    } else {
      dispatch({ type: "addService", service: cleaned });
      toast.success("Service added");
    }
    onOpenChange(false);
  }

  const disc = form.discount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>Used in appointment forms and the booking page.</DialogDescription>
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

          {/* ── Discount section ─────────────────────────────────── */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <label className="flex items-center justify-between text-sm cursor-pointer">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Special discount</span>
              </div>
              <Switch
                checked={!!disc?.active}
                onCheckedChange={(v) => {
                  if (v) {
                    setForm({ ...form, discount: { ...BLANK_DISCOUNT, ...(disc ?? {}) , active: true } });
                  } else {
                    setForm({ ...form, discount: disc ? { ...disc, active: false } : undefined });
                  }
                }}
              />
            </label>

            {disc?.active && (
              <div className="space-y-3 pt-1 border-t">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(["percent", "fixed"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, discount: { ...disc, type: t } })}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        disc.type === t
                          ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      {t === "percent" ? (
                        <><Percent className="h-3.5 w-3.5" /> % Off</>
                      ) : (
                        <><DollarSign className="h-3.5 w-3.5" /> $ Off</>
                      )}
                    </button>
                  ))}
                </div>

                {/* Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>
                      {disc.type === "percent" ? "Percent off" : "Dollars off"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={disc.type === "percent" ? 100 : undefined}
                      value={disc.value}
                      onChange={(e) =>
                        setForm({ ...form, discount: { ...disc, value: Number(e.target.value) } })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Expires{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      type="date"
                      value={disc.expiry ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discount: { ...disc, expiry: e.target.value || undefined },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Label */}
                <div className="space-y-1.5">
                  <Label>
                    Promo label{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    placeholder='e.g. "Spring Sale", "New Customer Deal"'
                    value={disc.label ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        discount: { ...disc, label: e.target.value || undefined },
                      })
                    }
                  />
                </div>

                {/* Preview */}
                {disc.value > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {disc.label || (disc.type === "percent" ? `${disc.value}% OFF` : `$${disc.value} OFF`)}
                      {" "}— customers will see{" "}
                      <span className="line-through text-muted-foreground">
                        ${form.priceLow}
                      </span>{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ${applyDisc(form.priceLow, disc)}
                      </span>{" "}
                      on the booking page
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

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
