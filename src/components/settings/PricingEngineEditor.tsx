/* ============================================================================
 * Pricing engine editor — admin UI for the customer-facing pricing engine.
 *
 * Mounts on the Settings page. Edits `settings.pricing_config` (JSONB column
 * added by phase_o_pricing_engine.sql). Save is explicit, not auto — a stray
 * keystroke shouldn't immediately flip pricing on live customers. Reset and
 * Discard are available.
 *
 * Layout: five cards (Sizes, Conditions, Flags, Floors, Travel) + a live
 * preview chip showing what a synthetic sample quote would compute to with
 * the in-progress edits. The synthetic sample is intentionally NOT tied to a
 * real service from the user's catalog so the owner has a stable reference
 * across edits.
 * ========================================================================== */

import { useMemo, useState } from "react";
import { RotateCcw, Save, X } from "lucide-react";
import { useStore } from "@/store/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/config";
import { computeQuote } from "@/lib/pricing/engine";
import { mergePricingConfig } from "@/lib/pricing/merge";
import type { PricingConfig } from "@/lib/pricing/types";
import type { Settings } from "@/lib/types";

const VEHICLE_LABELS: { key: string; label: string }[] = [
  { key: "compact",   label: "Compact / coupe / hatchback" },
  { key: "sedan",     label: "Sedan (baseline · 1.0)" },
  { key: "suv_truck", label: "SUV / truck" },
  { key: "van_xl",    label: "Van / XL" },
];

const CONDITION_LABELS: { key: string; label: string }[] = [
  { key: "light",   label: "Light" },
  { key: "average", label: "Average (baseline · 1.0)" },
  { key: "heavy",   label: "Heavy" },
];

const FLAG_LABELS: { key: "petHair" | "stains" | "heavyDirt"; label: string }[] = [
  { key: "petHair",   label: "Pet hair" },
  { key: "stains",    label: "Stains" },
  { key: "heavyDirt", label: "Heavy dirt / mud" },
];

function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PricingEngineEditor() {
  const { data, dispatch } = useStore();
  const saved = useMemo(
    () => mergePricingConfig(data.settings.pricingConfig as Partial<PricingConfig> | null | undefined),
    [data.settings.pricingConfig],
  );
  const [local, setLocal] = useState<PricingConfig>(saved);
  const dirty = !deepEqual(local, saved);

  function save() {
    dispatch({
      type: "updateSettings",
      patch: { pricingConfig: local } as Partial<Settings>,
    });
  }
  function discard() {
    setLocal(saved);
  }
  function resetAll() {
    setLocal(DEFAULT_PRICING_CONFIG);
  }

  return (
    <div className="space-y-5">
      {/* Live preview — synthetic $200 sedan/average package. Updates as
       *  the owner edits modifiers below. Anchors the owner's intuition. */}
      <LivePreview config={local} />

      <SizeCard config={local} onChange={setLocal} />
      <ConditionCard config={local} onChange={setLocal} />
      <FlagCard config={local} onChange={setLocal} />
      <FloorCard config={local} onChange={setLocal} />
      <TravelCard config={local} onChange={setLocal} />

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-background/95 px-1 py-3 backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetAll}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Reset all to defaults
        </Button>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="text-xs font-medium text-warning">Unsaved changes</span>
          ) : (
            <span className="text-xs text-muted-foreground">Up to date</span>
          )}
          {dirty ? (
            <Button type="button" variant="outline" size="sm" onClick={discard}>
              <X className="mr-2 h-3.5 w-3.5" />
              Discard
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={!dirty} onClick={save}>
            <Save className="mr-2 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Live preview ─────────────────────────────────────────────────────── */

function LivePreview({ config }: { config: PricingConfig }) {
  // Synthetic baseline: a $200 package, 240 min duration. Three scenarios
  // computed off the in-progress config so the owner sees ripple effects.
  const samplePackage = {
    id: "preview",
    name: "Sample · $200 package",
    priceLow: 200,
    priceHigh: 200,
    durationMinutes: 240,
    isAddon: false,
  } as const;
  const scenarios = [
    {
      label: "Sedan · clean",
      input: {
        packages: [samplePackage],
        addons: [],
        vehicleSize: "sedan",
        interiorCondition: "average",
        exteriorCondition: "average",
        flags: { petHair: false, stains: false, heavyDirt: false },
      },
    },
    {
      label: "SUV · heavy + pet hair",
      input: {
        packages: [samplePackage],
        addons: [],
        vehicleSize: "suv_truck",
        interiorCondition: "heavy",
        exteriorCondition: "average",
        flags: { petHair: true, stains: false, heavyDirt: false },
      },
    },
    {
      label: "Van · heavy + flags",
      input: {
        packages: [samplePackage],
        addons: [],
        vehicleSize: "van_xl",
        interiorCondition: "heavy",
        exteriorCondition: "heavy",
        flags: { petHair: true, stains: true, heavyDirt: true },
      },
    },
  ];

  return (
    <Card className="border-primary/30 bg-primary/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
        Live preview · synthetic $200 / 4hr sample
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scenarios.map((s) => {
          const q = computeQuote(s.input, config);
          return (
            <div key={s.label} className="rounded-md border border-border/60 bg-card px-3 py-2.5">
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">${q.estimate}</p>
              <p className="text-[10.5px] text-muted-foreground tabular-nums">
                {q.laborHours.toFixed(1)} hr · ${Math.round(q.effectiveHourlyRate)}/hr
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Section components ──────────────────────────────────────────────── */

function SectionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">{hint}</p>
      </div>
      {children}
    </Card>
  );
}

/**
 * Vehicle size modifiers. Material is hidden from the UI — most owners
 * won't tune it independently of price, and exposing it now creates churn.
 * Material multiplier still ships through the config (defaults from
 * DEFAULT_PRICING_CONFIG) so the engine carries it for future cost tracking.
 */
function SizeCard({
  config,
  onChange,
}: {
  config: PricingConfig;
  onChange: (c: PricingConfig) => void;
}) {
  function patch(key: string, field: "price" | "duration", value: number) {
    onChange({
      ...config,
      vehicleSize: {
        ...config.vehicleSize,
        [key]: {
          ...(config.vehicleSize[key] ?? DEFAULT_PRICING_CONFIG.vehicleSize[key] ?? { price: 1, duration: 1, material: 1 }),
          [field]: value,
        },
      },
    });
  }
  return (
    <SectionShell
      title="Vehicle size modifiers"
      hint="Multipliers applied to the package subtotal + labor minutes. 1.0 = no change. Sedan should stay at 1.0 so the configurator number matches the listed price for the most common case."
    >
      <div className="space-y-2.5">
        {VEHICLE_LABELS.map(({ key, label }) => {
          const mod = config.vehicleSize[key] ?? { price: 1, duration: 1, material: 1 };
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2">
              <Label className="text-sm font-normal">{label}</Label>
              <NumField
                label="Price ×"
                value={mod.price}
                step={0.01}
                min={0.4}
                max={2.0}
                onChange={(v) => patch(key, "price", v)}
              />
              <NumField
                label="Time ×"
                value={mod.duration}
                step={0.01}
                min={0.4}
                max={2.0}
                onChange={(v) => patch(key, "duration", v)}
              />
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function ConditionCard({
  config,
  onChange,
}: {
  config: PricingConfig;
  onChange: (c: PricingConfig) => void;
}) {
  function patch(key: string, field: "price" | "duration", value: number) {
    onChange({
      ...config,
      condition: {
        ...config.condition,
        [key]: {
          ...(config.condition[key] ?? DEFAULT_PRICING_CONFIG.condition[key] ?? { price: 1, duration: 1 }),
          [field]: value,
        },
      },
    });
  }
  return (
    <SectionShell
      title="Condition modifiers"
      hint="Applied to the package subtotal. Engine takes the worse of interior + exterior so heavy on one side doesn't get double-charged with average on the other."
    >
      <div className="space-y-2.5">
        {CONDITION_LABELS.map(({ key, label }) => {
          const mod = config.condition[key] ?? { price: 1, duration: 1 };
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2">
              <Label className="text-sm font-normal">{label}</Label>
              <NumField label="Price ×" value={mod.price} step={0.01} min={0.5} max={2.0} onChange={(v) => patch(key, "price", v)} />
              <NumField label="Time ×" value={mod.duration} step={0.01} min={0.5} max={2.0} onChange={(v) => patch(key, "duration", v)} />
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function FlagCard({
  config,
  onChange,
}: {
  config: PricingConfig;
  onChange: (c: PricingConfig) => void;
}) {
  function patch(
    key: "petHair" | "stains" | "heavyDirt",
    field: "pricePct" | "durationMin",
    value: number,
  ) {
    onChange({
      ...config,
      flags: {
        ...config.flags,
        [key]: {
          ...config.flags[key],
          [field]: value,
        },
      },
    });
  }
  return (
    <SectionShell
      title="Condition flags"
      hint="Additive on top of the size + condition modifiers. Percentage of the package subtotal added to the price + flat labor minutes."
    >
      <div className="space-y-2.5">
        {FLAG_LABELS.map(({ key, label }) => {
          const f = config.flags[key];
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2">
              <Label className="text-sm font-normal">{label}</Label>
              <NumField label="+%" value={Math.round(f.pricePct * 1000) / 10} step={0.5} min={0} max={50}
                onChange={(v) => patch(key, "pricePct", v / 100)} />
              <NumField label="+min" value={f.durationMin} step={5} min={0} max={120}
                onChange={(v) => patch(key, "durationMin", v)} />
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function FloorCard({
  config,
  onChange,
}: {
  config: PricingConfig;
  onChange: (c: PricingConfig) => void;
}) {
  return (
    <SectionShell
      title="Floors & rounding"
      hint="Business protection. Labor floor bumps quotes up when the natural $/hr drops below your minimum sustainable rate. Min booking is a hard floor for tiny jobs."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumField
          label="Hourly minimum ($/hr)"
          value={config.hourlyMinRate}
          step={1}
          min={20}
          max={300}
          onChange={(v) => onChange({ ...config, hourlyMinRate: v })}
          stacked
        />
        <NumField
          label="Minimum booking ($)"
          value={config.minBookingPrice}
          step={5}
          min={0}
          max={500}
          onChange={(v) => onChange({ ...config, minBookingPrice: v })}
          stacked
        />
        <NumField
          label="Round to nearest ($)"
          value={config.rounding}
          step={1}
          min={1}
          max={50}
          onChange={(v) => onChange({ ...config, rounding: v })}
          stacked
        />
      </div>
    </SectionShell>
  );
}

function TravelCard({
  config,
  onChange,
}: {
  config: PricingConfig;
  onChange: (c: PricingConfig) => void;
}) {
  return (
    <SectionShell
      title="Travel policy"
      hint="Surfaces on the customer's quote breakdown as informational text. Engine does NOT auto-bill miles into the estimate (requires geocoding — deferred). Owner confirms travel along with final on-site pricing."
    >
      <label className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-card px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Show travel policy on quotes</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">When off, the policy line is hidden from customers.</p>
        </div>
        <Switch
          checked={!!config.travel.enabled}
          onCheckedChange={(v) => onChange({ ...config, travel: { ...config.travel, enabled: !!v } })}
        />
      </label>

      {config.travel.enabled ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label="Free radius (miles)"
            value={config.travel.freeRadiusMiles}
            step={1}
            min={0}
            max={100}
            onChange={(v) => onChange({ ...config, travel: { ...config.travel, freeRadiusMiles: v } })}
            stacked
          />
          <NumField
            label="Per-mile rate ($)"
            value={config.travel.perMileRate}
            step={0.05}
            min={0}
            max={10}
            onChange={(v) => onChange({ ...config, travel: { ...config.travel, perMileRate: v } })}
            stacked
          />
          <NumField
            label="Max billable miles"
            value={config.travel.maxMiles}
            step={5}
            min={config.travel.freeRadiusMiles}
            max={200}
            onChange={(v) => onChange({ ...config, travel: { ...config.travel, maxMiles: v } })}
            stacked
          />
        </div>
      ) : null}
    </SectionShell>
  );
}

/* ─── Reusable number input with right-aligned label ───────────────────── */

function NumField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  stacked,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="font-mono tabular-nums"
        />
      </div>
    );
  }
  return (
    <label className="flex items-center gap-2">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-24 font-mono text-sm tabular-nums"
      />
    </label>
  );
}
