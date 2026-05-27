/* ============================================================================
 * STEP 3 — Vehicle (signature step)
 *
 * Renders a photographic plate of the selected size class. Image assets live
 * in `/public/cars/{value}.{jpg,webp}` (where `value` is the form's
 * `vehicleSize`). The owner controls which exact vehicle photo represents
 * each class — the configurator just references it by slot.
 *
 * The plate frames the image with the same editorial chrome the rest of the
 * page uses: hairline-bordered card, mono registration callouts, gradient
 * scrim top + bottom so the image fades into the page rather than sitting in
 * a hard-edged box. Crossfade with blur when the selection changes.
 * ========================================================================== */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FormState } from "./types";
import { CONDITION_OPTIONS, VEHICLE_SIZES } from "./types";
import { Field, SelectChips, StepHeader, ToggleRow, inputCls } from "./shared";

/**
 * Image catalogue per size slot. Each entry is a label + a list of candidate
 * image paths the plate will try in order; first one that loads wins. This
 * lets the owner drop in any of `compact.jpg`, `compact.webp`, or
 * `compact.png` without touching code.
 *
 * Suggested reference vehicles (the look the plate is composed around):
 *   compact   → Toyota Prius (current gen)
 *   sedan     → Tesla Model 3 Performance
 *   suv_truck → Lamborghini Urus
 *   van_xl    → cargo / box van
 *
 * The actual photo file is the owner's choice — drop one image per slot into
 * `public/cars/` and it appears here. Missing files fall back to an
 * "image not yet placed" state so the form remains usable.
 */
/* Iteration order here drives the "class · 0N" label on the plate. Sedan
 * sits first because it's the pricing baseline. */
const VEHICLE_IMAGE_SOURCES: Record<
  string,
  { label: string; sources: string[] }
> = {
  sedan: {
    label: "SEDAN",
    sources: ["/cars/sedan.webp", "/cars/sedan.jpg", "/cars/sedan.png"],
  },
  compact: {
    label: "COMPACT",
    sources: ["/cars/compact.webp", "/cars/compact.jpg", "/cars/compact.png"],
  },
  suv_truck: {
    label: "SUV / TRUCK",
    sources: ["/cars/suv_truck.webp", "/cars/suv_truck.jpg", "/cars/suv_truck.png"],
  },
  van_xl: {
    label: "VAN / XL",
    sources: ["/cars/van_xl.webp", "/cars/van_xl.jpg", "/cars/van_xl.png"],
  },
};

/**
 * Renders the photographic plate for the selected vehicle size. Caller is
 * responsible for only mounting this when `selected` is set — there is no
 * empty-state branch any more, the parent (`Step3Vehicle`) gates the mount.
 *
 * Width-capped at 460px so the plate sits comfortably inside the configurator
 * column without dominating the form. Aspect stays 16/9 for letterbox feel.
 */
function VehicleImagePlate({ selected }: { selected: string }) {
  const slot = VEHICLE_IMAGE_SOURCES[selected];
  // Hard guard — if the parent ever calls with an unknown key, render nothing
  // instead of crashing on `slot.sources`. Should not happen in practice.
  if (!slot) return null;

  return (
    <div
      className="relative w-full max-w-[460px] overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/85 via-obsidian-900/80 to-obsidian-950/90"
      style={{ borderRadius: 2 }}
    >
      {/* top callouts */}
      <div className="relative z-10 flex items-baseline justify-between px-4 pt-4 font-mono text-[9.5px] uppercase tracking-[0.32em] text-platinum-300/75">
        <span>plate · {selected.toUpperCase()}</span>
        <span className="text-platinum-300/55">ref</span>
      </div>

      {/* image stage */}
      <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1,    filter: "blur(0)"  }}
            exit   ={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <VehicleImage sources={slot.sources} label={slot.label} />
          </motion.div>
        </AnimatePresence>

        {/* top + bottom gradient scrims — fade image into page */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-obsidian-900/95 via-obsidian-900/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-obsidian-950/95 via-obsidian-950/40 to-transparent" />

        {/* corner ember brackets — slightly tighter for the smaller plate */}
        <span aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 border-l border-t border-ember-400/55" />
        <span aria-hidden className="pointer-events-none absolute right-2.5 top-2.5 h-3 w-3 border-r border-t border-ember-400/55" />
        <span aria-hidden className="pointer-events-none absolute left-2.5 bottom-2.5 h-3 w-3 border-l border-b border-ember-400/55" />
        <span aria-hidden className="pointer-events-none absolute right-2.5 bottom-2.5 h-3 w-3 border-r border-b border-ember-400/55" />

        {/* subtle film grain overlay so the photo feels developed, not stock */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "240px 240px",
          }}
        />
      </div>

      {/* bottom callouts */}
      <div className="relative z-10 flex items-baseline justify-between px-4 pb-4 pt-1.5 font-mono text-[9.5px] uppercase tracking-[0.32em] text-platinum-300/85">
        <span>{slot.label}</span>
        <span className="text-platinum-300/55">
          class · 0{Object.keys(VEHICLE_IMAGE_SOURCES).indexOf(selected) + 1}
        </span>
      </div>
    </div>
  );
}

/**
 * VehicleImage — tries each candidate source in order. If they all fail
 * (file not in `/public/cars/`), renders a clean "missing asset" panel that
 * tells the owner exactly where to drop the file. Avoids showing a busted
 * broken-image icon to customers.
 */
function VehicleImage({ sources, label }: { sources: string[]; label: string }) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  // Reset state when the set of sources changes (i.e. selection switch).
  // Stable join() key — re-renders only fire when the array contents change.
  const key = sources.join("|");
  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [key]);

  if (failed) return <MissingAssetPanel label={label} />;

  return (
    <img
      key={`${key}-${idx}`}
      src={sources[idx]}
      alt={`${label} reference photo`}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx < sources.length - 1) {
          setIdx((i) => i + 1);
        } else {
          setFailed(true);
        }
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function MissingAssetPanel({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 50%, black 30%, transparent 80%)",
        }}
      />
      <p className="relative font-mono text-[10px] uppercase tracking-[0.34em] text-ember-300/85">
        Plate awaits
      </p>
      <p className="relative mt-2 font-sans text-base font-extralight text-platinum-100">
        Drop a <span className="font-display italic">{label}</span> photo
      </p>
      <p className="relative mt-2 max-w-[40ch] font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/60">
        public / cars / {label.toLowerCase().replace(/\s+\/\s+/g, "_").replace(/\s+/g, "_")}.jpg
      </p>
    </div>
  );
}

export function Step3Vehicle({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step three"
        title="Tell me about the vehicle."
        body="Helps me load the right products and set realistic time."
      />

      {/*
       * Plate is gated on selection — it only mounts once the user has picked
       * a size. AnimatePresence handles a smooth fade+lift entrance so the
       * layout doesn't pop. The plate never unmounts after that (size chips
       * can only switch values, not clear them).
       */}
      <AnimatePresence initial={false}>
        {form.vehicleSize ? (
          <motion.div
            key="vehicle-plate"
            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0,  filter: "blur(0)" }}
            exit   ={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <VehicleImagePlate selected={form.vehicleSize} />
          </motion.div>
        ) : null}
      </AnimatePresence>


      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
          Size <span className="text-ember-300">*</span>
        </p>
        <div className="mt-3">
          <SelectChips
            options={VEHICLE_SIZES}
            value={form.vehicleSize}
            onChange={(v) => set({ vehicleSize: v })}
            cols={4}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Year">
          <input className={inputCls} value={form.vehicleYear}  placeholder="2019"   inputMode="numeric" onChange={(e) => set({ vehicleYear: e.target.value })} />
        </Field>
        <Field label="Make">
          <input className={inputCls} value={form.vehicleMake}  placeholder="Toyota"               onChange={(e) => set({ vehicleMake:  e.target.value })} />
        </Field>
        <Field label="Model">
          <input className={inputCls} value={form.vehicleModel} placeholder="Camry"                onChange={(e) => set({ vehicleModel: e.target.value })} />
        </Field>
        <Field label="Color">
          <input className={inputCls} value={form.vehicleColor} placeholder="Black"                onChange={(e) => set({ vehicleColor: e.target.value })} />
        </Field>
      </div>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Interior</p>
        <div className="mt-3">
          <SelectChips
            options={CONDITION_OPTIONS}
            value={form.interiorCondition}
            onChange={(v) => set({ interiorCondition: v })}
          />
        </div>
      </div>
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Exterior</p>
        <div className="mt-3">
          <SelectChips
            options={CONDITION_OPTIONS}
            value={form.exteriorCondition}
            onChange={(v) => set({ exteriorCondition: v })}
          />
        </div>
      </div>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Additional notes</p>
        <div className="mt-1 border-t border-white/10">
          <ToggleRow label="Pet hair"        hint="Dog, cat, or other"           checked={form.petHair}   onChange={(v) => set({ petHair: v })} />
          <ToggleRow label="Stains"          hint="Visible seat/carpet stains"   checked={form.stains}    onChange={(v) => set({ stains: v })} />
          <ToggleRow label="Heavy dirt / mud" hint="Caked mud, heavy road grime" checked={form.heavyDirt} onChange={(v) => set({ heavyDirt: v })} />
        </div>
      </div>

      <Field label="Notes" hint="Anything specific I should know.">
        <textarea
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Cracked trim on driver side, dog rides shotgun, etc."
          value={form.vehicleNotes}
          onChange={(e) => set({ vehicleNotes: e.target.value })}
        />
      </Field>
    </div>
  );
}
