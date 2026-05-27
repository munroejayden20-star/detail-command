/* ============================================================================
 * STEP 6 — Access + Photos
 * ========================================================================== */

import { useEffect, useMemo, useRef } from "react";
import { Upload, X } from "lucide-react";
import type { FormState } from "./types";
import { StepHeader, ToggleRow } from "./shared";

export function Step6Access({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previews     = useMemo(() => form.photoFiles.map((f) => URL.createObjectURL(f)), [form.photoFiles]);

  // revoke previews on unmount to avoid memory leak
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step six"
        title="Site access & photos."
        body="A spigot, an outlet, and a 30-second walkaround — that's all."
      />

      <div className="border-t border-white/10">
        <ToggleRow
          label="Outdoor water spigot"
          hint="Standard garden hose hookup"
          checked={form.waterAccess}
          onChange={(v) => set({ waterAccess: v })}
        />
        <ToggleRow
          label="Standard 120V outlet"
          hint="Within 50 ft of where the car will sit"
          checked={form.powerAccess}
          onChange={(v) => set({ powerAccess: v })}
        />
      </div>

      {(!form.waterAccess || !form.powerAccess) && (
        <div className="border-l-2 border-copper-300 bg-copper-500/[0.06] px-4 py-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-copper-200">Note</p>
          <p className="mt-1 text-[13px] text-platinum-100">
            No worries — I'll bring extra gear and we'll plan the spot together before I arrive.
          </p>
        </div>
      )}

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
          Vehicle photos · optional · up to 4
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 4 - form.photoFiles.length);
            set({ photoFiles: [...form.photoFiles, ...files].slice(0, 4) });
            e.target.value = "";
          }}
        />

        {form.photoFiles.length < 4 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex w-full items-center justify-between border border-dashed border-white/15 bg-white/[0.015] px-5 py-5 text-left transition-colors hover:border-white/30"
            style={{ borderRadius: 2 }}
          >
            <span>
              <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ember-300">Add photos</span>
              <span className="mt-1 block text-[13px] text-platinum-200/85">Tap or drag — JPG, PNG, WebP</span>
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-obsidian-900">
              <Upload className="h-4 w-4 text-platinum-100" />
            </span>
          </button>
        )}

        {form.photoFiles.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {form.photoFiles.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden border border-white/10" style={{ borderRadius: 2 }}>
                <img src={previews[i]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => set({ photoFiles: form.photoFiles.filter((_, j) => j !== i) })}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-obsidian-950/85 backdrop-blur-md transition-colors hover:bg-ember-500/80"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5 text-platinum-50" />
                </button>
                <span className="absolute bottom-1.5 left-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-platinum-50/80">
                  /{String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
