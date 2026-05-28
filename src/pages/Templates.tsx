import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Copy, Check, Trash2, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useStore, makeId } from "@/store/store";
import type { Template } from "@/lib/types";
import { TEMPLATE_TOKENS } from "@/lib/messageTemplate";
import { cn } from "@/lib/utils";
import { LuxAmbient, LuxEmptyState } from "@/components/dashboard/lux/primitives";

const TAGS = ["intro", "booking", "confirm", "follow_up", "other"];

export function TemplatesPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | undefined>();
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(t: Template) {
    navigator.clipboard?.writeText(t.body);
    toast.success("Template copied");
    setCopied(t.id);
    setTimeout(() => setCopied(null), 1500);
  }

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
              Library · {data.templates.length}
            </p>
            <h1 className="mt-1.5 font-sans text-3xl font-extralight leading-tight tracking-tight text-platinum-50 sm:text-4xl">
              Message templates
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-platinum-300/80">
              One-tap copy for the things you say all the time.
            </p>
          </div>
          <NewTemplateButton onClick={openNew} />
        </section>

        {data.templates.length === 0 ? (
          <LuxEmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No templates yet"
            description="Save your most-used messages once — copy them with one tap forever after."
            action={<NewTemplateButton onClick={openNew} small />}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                copied={copied === t.id}
                onCopy={() => copyText(t)}
                onEdit={() => {
                  setEditing(t);
                  setOpen(true);
                }}
                onDelete={() => {
                  if (window.confirm(`Delete "${t.title}"?`)) {
                    dispatch({ type: "deleteTemplate", id: t.id });
                    toast.success("Template deleted");
                  }
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function NewTemplateButton({ onClick, small = false }: { onClick: () => void; small?: boolean }) {
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
      <span className="relative">New template</span>
    </motion.button>
  );
}

function TemplateCard({
  template: t,
  copied,
  onCopy,
  onEdit,
  onDelete,
}: {
  template: Template;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group/lux-tpl relative isolate overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/90 via-obsidian-900/92 to-obsidian-900/95 p-5 backdrop-blur-[12px] backdrop-saturate-150 transition-all duration-200 hover:border-white/20"
      style={{ borderRadius: 4 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)",
          backgroundSize: "8px 8px",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px scale-y-0 bg-ember-400/70 transition-transform duration-200 group-hover/lux-tpl:scale-y-100"
        style={{ transformOrigin: "center" }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-sans text-[15px] font-light leading-tight text-platinum-50">
              {t.title}
            </p>
            <span className="mt-1.5 inline-block rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-platinum-300/75">
              {t.tag.replace("_", " ")}
            </span>
          </div>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover/lux-tpl:opacity-100">
            <button
              onClick={onEdit}
              className="rounded-md p-1.5 text-platinum-300/65 transition-colors hover:bg-white/[0.05] hover:text-platinum-100"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-platinum-300/65 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-platinum-200/85">
          {t.body}
        </p>
        <button
          onClick={onCopy}
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-all duration-200",
            copied
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-white/12 bg-white/[0.03] text-platinum-200/85 hover:border-ember-400/45 hover:bg-ember-500/10 hover:text-ember-200",
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy text
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState<Template>(() =>
    template ?? { id: makeId(), title: "", body: "", tag: "intro" }
  );

  useEffect(() => {
    if (open) {
      setForm(template ?? { id: makeId(), title: "", body: "", tag: "intro" });
    }
  }, [open, template]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (template) {
      dispatch({ type: "updateTemplate", id: template.id, patch: form });
      toast.success("Template saved");
    } else {
      dispatch({ type: "addTemplate", template: form });
      toast.success("Template added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Reusable messaging for customers and leads.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ttitle">Title</Label>
              <Input
                id="ttitle"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttag">Tag</Label>
              <select
                id="ttag"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
              >
                {TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tbody">Message</Label>
            <Textarea
              id="tbody"
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Hi {name}! Confirming your detail on {date} at {time}…"
              required
            />
            <div className="rounded-md border bg-muted/40 p-2.5 text-xs">
              <p className="mb-1.5 font-medium text-foreground">
                Placeholders — auto-fill when sent from a booking:
              </p>
              <div className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
                {TEMPLATE_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => setForm({ ...form, body: form.body + t.token })}
                    className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-accent"
                    title={`Insert ${t.token}`}
                  >
                    <code className="font-mono text-primary">{t.token}</code>
                    <span className="truncate text-muted-foreground">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{template ? "Save" : "Add template"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
