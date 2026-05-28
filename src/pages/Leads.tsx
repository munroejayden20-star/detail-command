import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format, formatISO, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Trash2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useStore, makeId } from "@/store/store";
import { useRegisterIrisContext } from "@/components/iris/PageContext";
import { ReachOutDialog } from "@/components/contact/ReachOutDialog";
import {
  LEAD_STATUSES,
  type Lead,
  type LeadSource,
  type LeadStatus,
} from "@/lib/types";
import { cn, truncate } from "@/lib/utils";
import { LuxAmbient, LuxEmptyState } from "@/components/dashboard/lux/primitives";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "dealership", label: "Dealership" },
  { value: "referral", label: "Referral" },
  { value: "google", label: "Google" },
  { value: "other", label: "Other" },
];

/** Status columns in pipeline left→right order. Tone classes are applied to a
 *  4px top rail on each column to encode status visually without competing
 *  with the obsidian surface beneath. */
const STATUS_COLUMNS: { value: LeadStatus; label: string; tone: string; railShadow: string }[] = [
  { value: "new", label: "New", tone: "bg-sky-400", railShadow: "0 0 12px rgba(56,189,248,0.35)" },
  { value: "contacted", label: "Contacted", tone: "bg-amber-400", railShadow: "0 0 12px rgba(251,191,36,0.35)" },
  { value: "waiting", label: "Waiting", tone: "bg-violet-400", railShadow: "0 0 12px rgba(167,139,250,0.35)" },
  { value: "booked", label: "Booked", tone: "bg-emerald-400", railShadow: "0 0 12px rgba(52,211,153,0.35)" },
  { value: "lost", label: "Lost", tone: "bg-rose-400", railShadow: "0 0 12px rgba(251,113,133,0.35)" },
];

export function LeadsPage() {
  const { data, dispatch } = useStore();
  useRegisterIrisContext({ page: "leads", label: "Leads" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Open the edit dialog when a lead id is passed in the URL (from search palette)
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const found = data.leads.find((l) => l.id === id);
    if (found) {
      setEditing(found);
      setOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, data.leads, setSearchParams]);

  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    STATUS_COLUMNS.forEach((s) => map.set(s.value, []));
    data.leads.forEach((l) => {
      map.get(l.status)?.push(l);
    });
    return map;
  }, [data.leads]);

  function openNew() {
    setEditing(undefined);
    setOpen(true);
  }

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-3rem)] bg-obsidian-950 px-4 pt-6 pb-12 text-platinum-100 sm:-mx-6 sm:px-6 md:-mx-10 md:-mt-6 md:px-10 md:pt-9 md:pb-16">
      <LuxAmbient />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative space-y-6"
      >
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-ember-300">
              Pipeline · {data.leads.length}
            </p>
            <h1 className="mt-1.5 font-sans text-3xl font-extralight leading-tight tracking-tight text-platinum-50 sm:text-4xl">
              Leads
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-platinum-300/80">
              Track inquiries that haven't booked yet.
            </p>
          </div>
          <NewLeadButton onClick={openNew} />
        </section>

        {data.leads.length === 0 ? (
          <LuxEmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No leads yet"
            description="Track your first lead — anyone who messages you about a detail."
            action={<NewLeadButton onClick={openNew} small />}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {STATUS_COLUMNS.map((col) => {
              const leads = grouped.get(col.value) ?? [];
              return (
                <LeadColumn
                  key={col.value}
                  label={col.label}
                  tone={col.tone}
                  railShadow={col.railShadow}
                  count={leads.length}
                >
                  {leads.length === 0 ? (
                    <p className="px-1 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/45">
                      Empty
                    </p>
                  ) : (
                    leads.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        onClick={() => {
                          setEditing(l);
                          setOpen(true);
                        }}
                      />
                    ))
                  )}
                </LeadColumn>
              );
            })}
          </div>
        )}
      </motion.div>

      <LeadDialog open={open} onOpenChange={setOpen} lead={editing} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function NewLeadButton({ onClick, small = false }: { onClick: () => void; small?: boolean }) {
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
      <span className="relative">New lead</span>
    </motion.button>
  );
}

function LeadColumn({
  label,
  tone,
  railShadow,
  count,
  children,
}: {
  label: string;
  tone: string;
  railShadow: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative isolate overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/90 via-obsidian-900/92 to-obsidian-900/95 backdrop-blur-[12px] backdrop-saturate-150"
      style={{ borderRadius: 4 }}
    >
      {/* Top rail status accent */}
      <div
        className={cn("absolute inset-x-0 top-0 h-[3px]", tone)}
        style={{ boxShadow: railShadow }}
        aria-hidden
      />
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
      <div className="relative px-4 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-300/80">
            {label}
          </p>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-platinum-200/85">
            {count}
          </span>
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}

function LeadCard({ lead: l, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group/lux-lead relative w-full overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-all duration-150 hover:border-white/20 hover:bg-white/[0.04]"
    >
      {/* Hover ember rail */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px scale-y-0 bg-ember-400/70 transition-transform duration-200 group-hover/lux-lead:scale-y-100"
        style={{ transformOrigin: "center" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-sans text-[13px] font-light leading-tight text-platinum-50">
            {l.name}
          </p>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-platinum-300/80">
            {l.source}
          </span>
        </div>
        {l.vehicle ? (
          <p className="mt-1 truncate text-[11px] text-platinum-300/70">{l.vehicle}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-wider">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-0.5 uppercase tracking-[0.22em]",
              l.interest === "high"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : l.interest === "medium"
                ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/[0.03] text-platinum-300/65",
            )}
          >
            {l.interest}
          </span>
          {l.followUpDate ? (
            <span className="tabular-nums text-platinum-300/65">
              {format(parseISO(l.followUpDate), "MMM d")}
            </span>
          ) : null}
        </div>
        {l.notes ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-platinum-300/65">
            {truncate(l.notes, 90)}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function LeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead;
}) {
  const { dispatch } = useStore();
  const [reachOpen, setReachOpen] = useState(false);
  const [form, setForm] = useState<Lead>(() =>
    lead ?? {
      id: makeId(),
      name: "",
      phone: "",
      source: "facebook",
      vehicle: "",
      interest: "medium",
      status: "new",
      notes: "",
      createdAt: formatISO(new Date()),
    }
  );

  useEffect(() => {
    if (open) {
      setForm(
        lead ?? {
          id: makeId(),
          name: "",
          phone: "",
          source: "facebook",
          vehicle: "",
          interest: "medium",
          status: "new",
          notes: "",
          createdAt: formatISO(new Date()),
        }
      );
    }
  }, [open, lead]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lead) {
      dispatch({ type: "updateLead", id: lead.id, patch: form });
    } else {
      dispatch({ type: "addLead", lead: form });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!lead) return;
    if (window.confirm("Delete this lead?")) {
      dispatch({ type: "deleteLead", id: lead.id });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>Track potential customers from first contact.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lname">Name</Label>
              <Input
                id="lname"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lphone">Phone</Label>
              <Input
                id="lphone"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lveh">Vehicle</Label>
              <Input
                id="lveh"
                value={form.vehicle ?? ""}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                placeholder="2020 Toyota RAV4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest</Label>
              <Select
                value={form.interest}
                onValueChange={(v) => setForm({ ...form, interest: v as Lead["interest"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lcontacted">Last contacted</Label>
              <Input
                id="lcontacted"
                type="date"
                value={form.lastContacted ? form.lastContacted.slice(0, 10) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lastContacted: e.target.value ? formatISO(new Date(e.target.value)) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lfollow">Follow-up date</Label>
              <Input
                id="lfollow"
                type="date"
                value={form.followUpDate ? form.followUpDate.slice(0, 10) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    followUpDate: e.target.value ? formatISO(new Date(e.target.value)) : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lnotes">Notes</Label>
            <Textarea
              id="lnotes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What they said, what they're interested in…"
            />
          </div>

          {form.phone ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setReachOpen(true)}
            >
              <MessageSquare className="h-4 w-4" /> Reach out (text · call · email)
            </Button>
          ) : null}

          <DialogFooter className="!justify-between">
            {lead ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{lead ? "Save changes" : "Add lead"}</Button>
            </div>
          </DialogFooter>
        </form>
        <ReachOutDialog
          open={reachOpen}
          onOpenChange={setReachOpen}
          contact={{
            name: form.name || "Lead",
            phone: form.phone ?? null,
            vehicle: form.vehicle ?? null,
            followUpNotes: form.notes ?? null,
            lastContacted: form.lastContacted
              ? form.lastContacted.slice(0, 10)
              : null,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
