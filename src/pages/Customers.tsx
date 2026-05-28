/* ============================================================================
 * CustomersPage — admin CRM index, cinematic retreat.
 *
 * Same data logic as before (same selectors, same dispatch, same dialog).
 * Visual chrome converted from shadcn Card/Button/EmptyState to the
 * dashboard-local lux primitives + a few inline glass surfaces tailored
 * to a list-heavy page.
 *
 * The customer cards intentionally use a manual surface (not LuxCard) so
 * the per-card hover/ember-rail interaction can be tuned independently
 * of the broader stat-card vocabulary.
 * ========================================================================== */

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Repeat,
  Star,
  Car,
  Users,
} from "lucide-react";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { useRegisterIrisContext } from "@/components/iris/PageContext";
import { useStore } from "@/store/store";
import {
  customerAppointmentCount,
  customerLifetimeValue,
} from "@/lib/selectors";
import { cn, formatCurrency, initials, phoneFmt, vehicleStr } from "@/lib/utils";
import { LuxAmbient, LuxEmptyState } from "@/components/dashboard/lux/primitives";

type Filter = "all" | "repeat" | "monthly";

export function CustomersPage() {
  const { data } = useStore();
  useRegisterIrisContext({ page: "customers", label: "Customers" });
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...data.customers];
    if (filter === "repeat") list = list.filter((c) => c.isRepeat);
    if (filter === "monthly") list = list.filter((c) => c.isMonthlyMaintenance);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q) ||
          c.vehicles.some((v) =>
            (v.make + v.model + v.year).toLowerCase().includes(q),
          )
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.customers, query, filter]);

  const filters: { v: Filter; label: string; count: number }[] = [
    { v: "all", label: "All", count: data.customers.length },
    { v: "repeat", label: "Repeat", count: data.customers.filter((c) => c.isRepeat).length },
    { v: "monthly", label: "Monthly", count: data.customers.filter((c) => c.isMonthlyMaintenance).length },
  ];

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-3rem)] bg-obsidian-950 px-4 pt-6 pb-12 text-platinum-100 sm:-mx-6 sm:px-6 md:-mx-10 md:-mt-6 md:px-10 md:pt-9 md:pb-16">
      <LuxAmbient />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative space-y-6"
      >
        {/* ═══ Header band ═══ */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-ember-300">
              Roster · {data.customers.length}
            </p>
            <h1 className="mt-1.5 font-sans text-3xl font-extralight leading-tight tracking-tight text-platinum-50 sm:text-4xl">
              Customers
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-platinum-300/80">
              Your CRM. Search, filter, and track lifetime value.
            </p>
          </div>
          <NewCustomerButton onClick={() => setOpen(true)} />
        </section>

        {/* ═══ Controls — search + filter ═══ */}
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-platinum-300/55" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value) {
                  params.set("q", e.target.value);
                } else {
                  params.delete("q");
                }
                setParams(params, { replace: true });
              }}
              placeholder="Search by name, phone, address, vehicle…"
              className="block w-full appearance-none rounded-full border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-[13px] text-platinum-50 placeholder:text-platinum-300/45 backdrop-blur-sm outline-none transition-all duration-200 focus:border-ember-400/55 focus:bg-white/[0.05] focus:[box-shadow:0_0_0_4px_rgba(221,41,20,0.08)]"
            />
          </div>
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <FilterPill
                key={f.v}
                active={filter === f.v}
                onClick={() => setFilter(f.v)}
                label={f.label}
                count={f.count}
              />
            ))}
          </div>
        </section>

        {/* ═══ Grid ═══ */}
        {filtered.length === 0 ? (
          <LuxEmptyState
            icon={<Users className="h-5 w-5" />}
            title={data.customers.length === 0 ? "No customers yet" : "No customers match"}
            description={
              data.customers.length === 0
                ? "Add your first customer to start tracking jobs and lifetime value."
                : "Try a different search, or add a new customer."
            }
            action={
              <NewCustomerButton onClick={() => setOpen(true)} small />
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => {
              const ltv = customerLifetimeValue(data, c.id);
              const count = customerAppointmentCount(data, c.id);
              return <CustomerCard key={c.id} customer={c} ltv={ltv} apptCount={count} />;
            })}
          </div>
        )}
      </motion.div>

      <CustomerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function NewCustomerButton({
  onClick,
  small = false,
}: {
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group/lux-btn relative inline-flex shrink-0 items-center gap-2 overflow-hidden border border-ember-500/35 bg-gradient-to-b from-ember-500/12 via-ember-500/8 to-ember-500/14 font-medium uppercase tracking-[0.22em] text-platinum-50 backdrop-blur-md transition-all duration-200 hover:border-ember-400/55 hover:from-ember-500/18 hover:to-ember-500/22",
        small ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]",
      )}
      style={{ borderRadius: 999 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
        style={{
          background: "linear-gradient(180deg, rgba(255,220,200,0.18) 0%, transparent 100%)",
        }}
      />
      <Plus className="relative h-3.5 w-3.5 text-ember-300" />
      <span className="relative">New customer</span>
    </motion.button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-all duration-200",
        active
          ? "border-ember-400/45 bg-ember-500/10 text-platinum-50 [box-shadow:inset_0_0_0_1px_rgba(248,114,72,0.12)]"
          : "border-white/10 bg-white/[0.02] text-platinum-300/75 hover:border-white/20 hover:bg-white/[0.04] hover:text-platinum-100",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums tracking-wider",
          active ? "bg-ember-500/15 text-ember-200" : "bg-white/[0.05] text-platinum-300/65",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CustomerCard({
  customer: c,
  ltv,
  apptCount,
}: {
  customer: ReturnType<typeof useStore>["data"]["customers"][number];
  ltv: number;
  apptCount: number;
}) {
  return (
    <Link
      to={`/customers/${c.id}`}
      className="group/lux-card relative isolate block overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/90 via-obsidian-900/92 to-obsidian-900/95 p-4 backdrop-blur-[12px] backdrop-saturate-150 transition-all duration-200 hover:border-white/20"
      style={{ borderRadius: 4 }}
    >
      {/* Carbon weave */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)",
          backgroundSize: "8px 8px",
        }}
      />
      {/* Ember rail on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px scale-y-0 bg-ember-400/70 transition-transform duration-200 group-hover/lux-card:scale-y-100"
        style={{ transformOrigin: "center" }}
      />
      {/* Top hairline */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 50%, transparent 100%)",
        }}
      />

      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-ember-500/80 to-ember-700/80 text-sm font-semibold text-platinum-50 [box-shadow:0_6px_18px_-8px_rgba(221,41,20,0.45)]">
            {initials(c.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-sans text-[14px] font-light leading-tight text-platinum-50">
                {c.name}
              </p>
              {c.isRepeat ? (
                <Star
                  className="h-3.5 w-3.5 shrink-0 fill-ember-300 text-ember-300"
                  aria-label="Repeat customer"
                />
              ) : null}
              {c.isMonthlyMaintenance ? (
                <Repeat
                  className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                  aria-label="Monthly maintenance"
                />
              ) : null}
            </div>
            <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-platinum-300/70">
              <Phone className="h-3 w-3" />
              {phoneFmt(c.phone)}
            </p>
            {c.email ? (
              <p className="inline-flex max-w-full items-center gap-1.5 text-[11px] text-platinum-300/65">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{c.email}</span>
              </p>
            ) : null}
          </div>
        </div>

        {c.vehicles[0] ? (
          <div className="mt-3 flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-platinum-200/85">
            <Car className="h-3.5 w-3.5 shrink-0 text-platinum-300/65" />
            <span className="truncate">{vehicleStr(c.vehicles[0])}</span>
            {c.vehicles.length > 1 ? (
              <span className="ml-auto rounded-full border border-white/[0.10] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums text-platinum-300/70">
                +{c.vehicles.length - 1}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-platinum-300/65">
              LTV
            </span>
            <span className="font-sans text-[13.5px] font-light tabular-nums text-platinum-50">
              {formatCurrency(ltv)}
            </span>
          </div>
          <div className="font-mono text-[11px] tabular-nums text-platinum-300/65">
            {apptCount} appt{apptCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </Link>
  );
}
