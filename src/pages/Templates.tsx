import { useState, useEffect } from "react";
import { Plus, Copy, Check, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Template } from "@/lib/types";

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

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Message templates"
        description="One-tap copy for the things you say all the time."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {data.templates.map((t) => (
          <Card key={t.id} className="group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <Badge variant="outline" className="mt-1 capitalize text-[10px]">
                    {t.tag.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditing(t);
                      setOpen(true);
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${t.title}"?`)) {
                        dispatch({ type: "deleteTemplate", id: t.id });
                        toast.success("Template deleted");
                      }
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {t.body}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => copyText(t)}
              >
                {copied === t.id ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy text
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
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
              placeholder="The text customers will see…"
              required
            />
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
